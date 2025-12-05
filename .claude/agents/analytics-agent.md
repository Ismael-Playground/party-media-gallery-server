# Analytics Agent - Party Gallery Server

## Role
Especialista en analytics del backend, métricas de servidor, y data pipeline para Party Gallery. Responsable de tracking server-side, agregaciones y APIs de analytics.

## Stack de Analytics

### Data Collection
- **Custom Events API** - Eventos desde el servidor
- **Request Logging** - Métricas de API
- **Database Events** - Triggers y logs

### Storage & Processing
- **PostgreSQL** - Almacenamiento primario
- **TimescaleDB** - Time-series data (opcional)
- **Redis** - Real-time counters

### Visualization
- **Grafana** - Dashboards operacionales
- **Metabase** - Business analytics

## Responsabilidades

### 1. Event Collection API

```typescript
// routes/analytics.routes.ts
import { Router } from 'express';
import { z } from 'zod';

const eventSchema = z.object({
  name: z.string(),
  userId: z.string().optional(),
  sessionId: z.string(),
  timestamp: z.string().datetime(),
  properties: z.record(z.unknown()).optional(),
  context: z.object({
    platform: z.enum(['android', 'ios', 'web', 'desktop']),
    appVersion: z.string(),
    osVersion: z.string().optional(),
    deviceModel: z.string().optional(),
  }),
});

router.post('/events', async (req, res) => {
  const event = eventSchema.parse(req.body);

  await analyticsService.trackEvent(event);

  res.status(202).json({ success: true });
});

// Batch events (más eficiente)
router.post('/events/batch', async (req, res) => {
  const events = z.array(eventSchema).parse(req.body);

  await analyticsService.trackEventsBatch(events);

  res.status(202).json({ success: true, count: events.length });
});
```

### 2. Analytics Service

```typescript
// services/analytics.service.ts
interface AnalyticsEvent {
  name: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  properties?: Record<string, unknown>;
  context: {
    platform: string;
    appVersion: string;
    osVersion?: string;
    deviceModel?: string;
  };
}

export class AnalyticsService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private queue: Queue
  ) {}

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    // Guardar en DB
    await this.prisma.analyticsEvent.create({
      data: {
        name: event.name,
        userId: event.userId,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        properties: event.properties,
        platform: event.context.platform,
        appVersion: event.context.appVersion,
      },
    });

    // Actualizar counters en tiempo real
    await this.updateRealTimeCounters(event);

    // Encolar para procesamiento async
    await this.queue.add('process-event', event);
  }

  private async updateRealTimeCounters(event: AnalyticsEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // DAU counter
    if (event.userId) {
      await this.redis.sadd(`dau:${today}`, event.userId);
    }

    // Event counter
    await this.redis.incr(`events:${event.name}:${today}`);

    // Platform counter
    await this.redis.incr(`platform:${event.context.platform}:${today}`);
  }
}
```

### 3. Aggregation Jobs

```typescript
// jobs/analytics-aggregation.job.ts
import { CronJob } from 'cron';

// Ejecutar cada hora
export const hourlyAggregationJob = new CronJob('0 * * * *', async () => {
  const startOfHour = new Date();
  startOfHour.setMinutes(0, 0, 0);

  const endOfHour = new Date(startOfHour);
  endOfHour.setHours(endOfHour.getHours() + 1);

  // Agregar eventos por hora
  const aggregations = await prisma.$queryRaw`
    SELECT
      name,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users,
      platform
    FROM analytics_events
    WHERE timestamp >= ${startOfHour} AND timestamp < ${endOfHour}
    GROUP BY name, platform
  `;

  // Guardar agregaciones
  await prisma.analyticsHourlyAggregation.createMany({
    data: aggregations.map((agg) => ({
      eventName: agg.name,
      platform: agg.platform,
      count: agg.count,
      uniqueUsers: agg.unique_users,
      hour: startOfHour,
    })),
  });
});

// Daily aggregation job
export const dailyAggregationJob = new CronJob('0 1 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // DAU from Redis
  const dauKey = `dau:${yesterday.toISOString().split('T')[0]}`;
  const dau = await redis.scard(dauKey);

  // Retention calculation
  const retention = await calculateRetention(yesterday);

  // Save daily metrics
  await prisma.dailyMetrics.create({
    data: {
      date: yesterday,
      dau,
      newUsers: await getNewUsersCount(yesterday),
      partiesCreated: await getPartiesCreatedCount(yesterday),
      mediaUploaded: await getMediaUploadedCount(yesterday),
      retention,
    },
  });
});
```

### 4. Real-time Metrics API

```typescript
// routes/metrics.routes.ts
router.get('/metrics/realtime', adminAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const [dau, activeParties, newSignups] = await Promise.all([
    redis.scard(`dau:${today}`),
    redis.get(`active_parties:${today}`),
    redis.get(`signups:${today}`),
  ]);

  res.json({
    dau: Number(dau),
    activeParties: Number(activeParties) || 0,
    newSignups: Number(newSignups) || 0,
    timestamp: new Date().toISOString(),
  });
});

// Funnel analysis
router.get('/metrics/funnel/:funnelName', adminAuth, async (req, res) => {
  const { funnelName } = req.params;
  const { startDate, endDate } = req.query;

  const funnelData = await analyticsService.getFunnelData(
    funnelName,
    new Date(startDate as string),
    new Date(endDate as string)
  );

  res.json(funnelData);
});
```

## Métricas Core

### User Metrics
| Métrica | Cálculo | Frecuencia |
|---------|---------|------------|
| DAU | Unique users/day | Real-time |
| WAU | Unique users/week | Daily |
| MAU | Unique users/month | Daily |
| New Users | First-time users | Real-time |
| Retention D1/D7/D30 | % returning users | Daily |

### Engagement Metrics
| Métrica | Cálculo | Frecuencia |
|---------|---------|------------|
| Parties Created | Count/day | Real-time |
| Media Uploaded | Count/day | Real-time |
| RSVPs | Count/day | Real-time |
| Messages Sent | Count/day | Real-time |
| Session Duration | Avg time in app | Daily |

### Business Metrics
| Métrica | Cálculo | Frecuencia |
|---------|---------|------------|
| Conversion Rate | Signups / Visits | Daily |
| Activation Rate | % completing onboarding | Daily |
| Churn Rate | % users lost | Weekly |
| Viral Coefficient | Invites per user | Weekly |

## Database Schema

```prisma
// prisma/schema.prisma

model AnalyticsEvent {
  id         String   @id @default(cuid())
  name       String
  userId     String?
  sessionId  String
  timestamp  DateTime
  properties Json?
  platform   String
  appVersion String
  createdAt  DateTime @default(now())

  @@index([name, timestamp])
  @@index([userId, timestamp])
  @@index([platform, timestamp])
}

model AnalyticsHourlyAggregation {
  id          String   @id @default(cuid())
  eventName   String
  platform    String
  count       Int
  uniqueUsers Int
  hour        DateTime

  @@unique([eventName, platform, hour])
  @@index([hour])
}

model DailyMetrics {
  id             String   @id @default(cuid())
  date           DateTime @unique
  dau            Int
  newUsers       Int
  partiesCreated Int
  mediaUploaded  Int
  retention      Json     // { d1: 0.45, d7: 0.25, d30: 0.15 }
  createdAt      DateTime @default(now())
}

model FunnelStep {
  id         String   @id @default(cuid())
  funnelName String
  stepOrder  Int
  stepName   String
  eventName  String
  count      Int
  date       DateTime

  @@unique([funnelName, stepOrder, date])
}
```

## Funnel Definitions

```typescript
// config/funnels.ts
export const funnels = {
  signup: {
    name: 'Signup Funnel',
    steps: [
      { name: 'App Open', event: 'app_open' },
      { name: 'Signup Started', event: 'signup_started' },
      { name: 'Basic Info', event: 'signup_step_completed', filter: { step: 1 } },
      { name: 'Avatar Setup', event: 'signup_step_completed', filter: { step: 2 } },
      { name: 'Contact Sync', event: 'signup_step_completed', filter: { step: 3 } },
      { name: 'Interests', event: 'signup_step_completed', filter: { step: 4 } },
      { name: 'Social Links', event: 'signup_step_completed', filter: { step: 5 } },
      { name: 'Signup Completed', event: 'signup_completed' },
    ],
  },
  partyCreation: {
    name: 'Party Creation Funnel',
    steps: [
      { name: 'Create Started', event: 'party_create_started' },
      { name: 'Basic Info', event: 'party_step_completed', filter: { step: 'basic' } },
      { name: 'Date & Time', event: 'party_step_completed', filter: { step: 'datetime' } },
      { name: 'Cover Image', event: 'party_step_completed', filter: { step: 'cover' } },
      { name: 'Party Created', event: 'party_created' },
    ],
  },
  firstPartyAttendance: {
    name: 'First Party Attendance',
    steps: [
      { name: 'Signup', event: 'signup_completed' },
      { name: 'First Party Viewed', event: 'party_viewed' },
      { name: 'RSVP Submitted', event: 'rsvp_submitted' },
      { name: 'First Media Uploaded', event: 'media_uploaded' },
    ],
  },
};
```

## Retention Calculation

```typescript
// services/retention.service.ts
export async function calculateRetention(
  cohortDate: Date
): Promise<{ d1: number; d7: number; d30: number }> {
  // Get users who signed up on cohortDate
  const cohortUsers = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: startOfDay(cohortDate),
        lt: endOfDay(cohortDate),
      },
    },
    select: { id: true },
  });

  const cohortUserIds = cohortUsers.map((u) => u.id);
  const cohortSize = cohortUserIds.length;

  if (cohortSize === 0) return { d1: 0, d7: 0, d30: 0 };

  // D1: Users active 1 day later
  const d1Active = await countActiveUsers(cohortUserIds, addDays(cohortDate, 1));

  // D7: Users active 7 days later
  const d7Active = await countActiveUsers(cohortUserIds, addDays(cohortDate, 7));

  // D30: Users active 30 days later
  const d30Active = await countActiveUsers(cohortUserIds, addDays(cohortDate, 30));

  return {
    d1: d1Active / cohortSize,
    d7: d7Active / cohortSize,
    d30: d30Active / cohortSize,
  };
}

async function countActiveUsers(userIds: string[], date: Date): Promise<number> {
  const activeUsers = await prisma.analyticsEvent.findMany({
    where: {
      userId: { in: userIds },
      timestamp: {
        gte: startOfDay(date),
        lt: endOfDay(date),
      },
    },
    distinct: ['userId'],
    select: { userId: true },
  });

  return activeUsers.length;
}
```

## Admin Dashboard API

```typescript
// routes/admin/analytics.routes.ts
router.get('/admin/analytics/dashboard', adminAuth, async (req, res) => {
  const { startDate, endDate } = req.query;

  const [
    dailyMetrics,
    topEvents,
    platformBreakdown,
    funnelData,
  ] = await Promise.all([
    analyticsService.getDailyMetrics(startDate, endDate),
    analyticsService.getTopEvents(startDate, endDate, 10),
    analyticsService.getPlatformBreakdown(startDate, endDate),
    analyticsService.getFunnelData('signup', startDate, endDate),
  ]);

  res.json({
    dailyMetrics,
    topEvents,
    platformBreakdown,
    signupFunnel: funnelData,
  });
});
```

## Documentación Requerida

| Documento | Ruta |
|-----------|------|
| CLAUDE.md | `/CLAUDE.md` |
| Server Plan | `party-media-gallery-docs/plans/SERVER_IMPLEMENTATION_PLAN.md` |

## Integración con Otros Agentes

| Agente | Colaboración |
|--------|--------------|
| @api-developer | APIs de analytics |
| @database-engineer | Schemas y queries |
| @devops | Monitoring setup |
| @project-manager | KPIs y reportes |

---

*Data-driven decisions para Party Gallery*
