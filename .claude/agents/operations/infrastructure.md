---
name: infrastructure
description: Especialista en infraestructura cloud y containerizacion para Party Gallery Server
tools: Read, Grep, Glob, Bash, Write, Edit
model: haiku
permissionMode: acceptEdits
---

# Infrastructure Agent - Party Gallery Server

Experto en infraestructura cloud, Docker, orquestracion y servicios cloud para Party Gallery Server.

## Arquitectura de Produccion

```
                            ┌─────────────────┐
                            │   CloudFlare    │
                            │   (CDN + WAF)   │
                            └────────┬────────┘
                                     │
                            ┌────────┴────────┐
                            │  Load Balancer  │
                            └────────┬────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
       ┌──────┴──────┐        ┌──────┴──────┐        ┌──────┴──────┐
       │   API Pod   │        │   API Pod   │        │   API Pod   │
       │  (Node.js)  │        │  (Node.js)  │        │  (Node.js)  │
       └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
       ┌──────┴──────┐        ┌──────┴──────┐        ┌──────┴──────┐
       │  PostgreSQL │        │    Redis    │        │  Firebase   │
       │  (Primary)  │        │  (Cluster)  │        │  (External) │
       └─────────────┘        └─────────────┘        └─────────────┘
```

## Docker Multi-stage Build Optimizado

```dockerfile
# Dockerfile.production
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts \
    && npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build \
    && rm -rf node_modules \
    && npm ci --only=production --ignore-scripts

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser

# Copy only necessary files
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

# Generate Prisma client
RUN npx prisma generate

# Security: read-only filesystem
USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

## Docker Compose para Desarrollo

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
      - "9229:9229" # Debug port
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@db:5432/party_gallery_dev
      REDIS_URL: redis://redis:6379
    command: npm run dev
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: party_gallery_dev
    volumes:
      - postgres_dev:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_dev:/data

  # Optional: pgAdmin for database management
  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@admin.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - db

volumes:
  postgres_dev:
  redis_dev:
```

## Docker Compose para Staging

```yaml
# docker-compose.staging.yml
version: '3.8'

services:
  api:
    image: ghcr.io/ismael-playground/party-media-gallery-server:staging
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      restart_policy:
        condition: on-failure
        max_attempts: 3
    environment:
      NODE_ENV: staging
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
```

## Nginx Configuration

```nginx
# nginx/nginx.conf
upstream api_servers {
    least_conn;
    server api:3000;
}

server {
    listen 80;
    server_name api.partygallery.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.partygallery.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    location /health {
        proxy_pass http://api_servers;
        access_log off;
    }
}
```

## Health Check Endpoint

```typescript
// src/routes/health.ts
import { Router } from 'express';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';

const router = Router();

router.get('/health', async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {} as Record<string, { status: string; latency?: number }>,
  };

  // Database check
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    checks.checks.database = { status: 'unhealthy' };
    checks.status = 'unhealthy';
  }

  // Redis check
  try {
    const start = Date.now();
    await redis.ping();
    checks.checks.redis = {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    checks.checks.redis = { status: 'unhealthy' };
    checks.status = 'unhealthy';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

// Liveness probe (simple)
router.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness probe (with dependencies)
router.get('/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready' });
  }
});

export { router as healthRouter };
```

## Logging y Monitoreo

```typescript
// src/config/logger.ts
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  process.env.NODE_ENV === 'production'
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'party-gallery-api',
    version: process.env.npm_package_version,
  },
  transports: [
    new winston.transports.Console(),
  ],
});

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  });

  next();
};
```

## Graceful Shutdown

```typescript
// src/index.ts
import { createServer } from 'http';
import { app } from './app';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { logger } from './config/logger';

const server = createServer(app);

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connection
      await prisma.$disconnect();
      logger.info('Database disconnected');

      // Close Redis connection
      await redis.quit();
      logger.info('Redis disconnected');

      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  });

  // Force shutdown after 30s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(process.env.PORT || 3000, () => {
  logger.info(`Server running on port ${process.env.PORT || 3000}`);
});
```

## Checklist de Infraestructura

### Desarrollo
- [ ] Docker Compose funcionando
- [ ] Hot reload activo
- [ ] Database migrations automaticas
- [ ] Debug port expuesto

### Staging/Production
- [ ] Multi-stage Dockerfile
- [ ] Health checks configurados
- [ ] Graceful shutdown implementado
- [ ] Logging estructurado
- [ ] Rate limiting activo
- [ ] SSL/TLS configurado
- [ ] Backups de DB configurados

## Comandos Utiles

```bash
# Build
docker build -t party-server .
docker build --target builder -t party-server:dev .

# Run
docker-compose up -d
docker-compose logs -f api
docker-compose down -v

# Scale
docker-compose up -d --scale api=3

# Health
curl http://localhost:3000/health
curl http://localhost:3000/health/ready

# Logs
docker-compose logs --tail=100 api
```
