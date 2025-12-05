---
name: service-architect
description: Especialista en arquitectura de servicios y logica de negocio para Party Gallery Server
tools: Read, Grep, Glob, Bash, Write, Edit
model: sonnet
permissionMode: acceptEdits
---

# Service Architect - Party Gallery Server

Experto en diseño de arquitectura de servicios, logica de negocio, patrones de diseño y domain-driven design para Party Gallery Server.

## Recopilacion de Contexto (OBLIGATORIO)

Antes de cualquier tarea:
1. Leer `/CLAUDE.md` - Stack, arquitectura
2. Revisar servicios existentes en `src/services/`
3. Entender el dominio y reglas de negocio
4. Verificar dependencias entre servicios

## Arquitectura de Servicios

```
src/services/
├── auth/
│   ├── auth.service.ts
│   └── auth.types.ts
├── users/
│   ├── user.service.ts
│   ├── user.types.ts
│   └── follow.service.ts
├── parties/
│   ├── party.service.ts
│   ├── party.types.ts
│   ├── rsvp.service.ts
│   └── cohost.service.ts
├── media/
│   ├── media.service.ts
│   ├── upload.service.ts
│   └── processing.service.ts
├── chat/
│   ├── chat.service.ts
│   └── message.service.ts
├── notifications/
│   ├── notification.service.ts
│   └── push.service.ts
└── recommendations/
    └── recommendation.service.ts
```

## Patron de Servicio

```typescript
// src/services/parties/party.service.ts
import { PrismaClient, PartyEvent, PartyStatus } from '@prisma/client';
import { PartyRepository } from '@/repositories/party.repository';
import { NotificationService } from '@/services/notifications/notification.service';
import { CacheService } from '@/services/cache/cache.service';
import {
  CreatePartyInput,
  UpdatePartyInput,
  PartyWithDetails,
  GetFeedParams,
  FeedResult
} from './party.types';
import { ServiceError } from '@/utils/errors';

export class PartyService {
  constructor(
    private partyRepository: PartyRepository,
    private notificationService: NotificationService,
    private cacheService: CacheService,
  ) {}

  async create(userId: string, input: CreatePartyInput): Promise<PartyEvent> {
    // Business validation
    this.validatePartyDates(input.startsAt, input.endsAt);

    // Create party
    const party = await this.partyRepository.create({
      ...input,
      hostId: userId,
      status: PartyStatus.PLANNED,
    });

    // Create chat room for the party
    await this.partyRepository.createChatRoom(party.id);

    // Notify followers about new party
    await this.notificationService.notifyFollowers(userId, {
      type: 'NEW_PARTY',
      title: 'New Party!',
      body: `Check out "${party.title}"`,
      data: { partyId: party.id },
    });

    return party;
  }

  async findById(id: string): Promise<PartyWithDetails> {
    // Try cache first
    const cached = await this.cacheService.getParty(id);
    if (cached) return cached;

    const party = await this.partyRepository.findById(id);

    if (!party) {
      throw new ServiceError('PARTY_NOT_FOUND', 'Party not found', 404);
    }

    // Cache for 1 minute
    await this.cacheService.setParty(party);

    return party;
  }

  async update(
    partyId: string,
    userId: string,
    input: UpdatePartyInput
  ): Promise<PartyEvent> {
    // Check permissions
    await this.assertCanEditParty(partyId, userId);

    // Validate if updating dates
    if (input.startsAt || input.endsAt) {
      const party = await this.findById(partyId);
      this.validatePartyDates(
        input.startsAt || party.startsAt,
        input.endsAt || party.endsAt
      );
    }

    const updated = await this.partyRepository.update(partyId, input);

    // Invalidate cache
    await this.cacheService.invalidateParty(partyId);

    return updated;
  }

  async delete(partyId: string, userId: string): Promise<void> {
    await this.assertCanEditParty(partyId, userId);

    const party = await this.findById(partyId);

    // Soft delete by changing status
    await this.partyRepository.update(partyId, {
      status: PartyStatus.CANCELLED
    });

    // Notify attendees
    await this.notificationService.notifyPartyAttendees(partyId, {
      type: 'PARTY_CANCELLED',
      title: 'Party Cancelled',
      body: `"${party.title}" has been cancelled`,
    });

    await this.cacheService.invalidateParty(partyId);
  }

  async getFeed(params: GetFeedParams): Promise<FeedResult> {
    return this.partyRepository.getFeed(params);
  }

  async getLiveParties(): Promise<PartyEvent[]> {
    return this.partyRepository.findByStatus(PartyStatus.LIVE);
  }

  async startParty(partyId: string, userId: string): Promise<PartyEvent> {
    await this.assertCanEditParty(partyId, userId);

    const party = await this.findById(partyId);

    if (party.status !== PartyStatus.PLANNED) {
      throw new ServiceError(
        'INVALID_STATUS',
        'Can only start planned parties',
        400
      );
    }

    const updated = await this.partyRepository.update(partyId, {
      status: PartyStatus.LIVE,
    });

    // Notify attendees that party is live
    await this.notificationService.notifyPartyAttendees(partyId, {
      type: 'PARTY_LIVE',
      title: 'Party is Live!',
      body: `"${party.title}" has started`,
      data: { partyId },
    });

    await this.cacheService.invalidateParty(partyId);

    return updated;
  }

  async endParty(partyId: string, userId: string): Promise<PartyEvent> {
    await this.assertCanEditParty(partyId, userId);

    const party = await this.findById(partyId);

    if (party.status !== PartyStatus.LIVE) {
      throw new ServiceError(
        'INVALID_STATUS',
        'Can only end live parties',
        400
      );
    }

    const updated = await this.partyRepository.update(partyId, {
      status: PartyStatus.ENDED,
    });

    await this.cacheService.invalidateParty(partyId);

    return updated;
  }

  // Private methods

  private validatePartyDates(
    startsAt: Date,
    endsAt: Date | null | undefined
  ): void {
    const now = new Date();

    if (startsAt < now) {
      throw new ServiceError(
        'INVALID_DATE',
        'Party start date must be in the future',
        400
      );
    }

    if (endsAt && endsAt <= startsAt) {
      throw new ServiceError(
        'INVALID_DATE',
        'End date must be after start date',
        400
      );
    }

    // Max party duration: 24 hours
    if (endsAt) {
      const duration = endsAt.getTime() - startsAt.getTime();
      const maxDuration = 24 * 60 * 60 * 1000; // 24 hours

      if (duration > maxDuration) {
        throw new ServiceError(
          'INVALID_DURATION',
          'Party duration cannot exceed 24 hours',
          400
        );
      }
    }
  }

  private async assertCanEditParty(
    partyId: string,
    userId: string
  ): Promise<void> {
    const party = await this.findById(partyId);

    const isHost = party.hostId === userId;
    const isCohost = await this.partyRepository.isCohost(partyId, userId);

    if (!isHost && !isCohost) {
      throw new ServiceError(
        'FORBIDDEN',
        'You do not have permission to edit this party',
        403
      );
    }
  }
}
```

## Service Types

```typescript
// src/services/parties/party.types.ts
import { PartyEvent, PartyStatus, PartyMood } from '@prisma/client';

export interface CreatePartyInput {
  title: string;
  description?: string;
  venueName: string;
  venueAddress: string;
  venueLatitude?: number;
  venueLongitude?: number;
  startsAt: Date;
  endsAt?: Date;
  isPrivate?: boolean;
  maxAttendees?: number;
  coverImageUrl?: string;
  tags?: string[];
}

export interface UpdatePartyInput {
  title?: string;
  description?: string;
  venueName?: string;
  venueAddress?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  startsAt?: Date;
  endsAt?: Date;
  isPrivate?: boolean;
  maxAttendees?: number;
  coverImageUrl?: string;
  status?: PartyStatus;
}

export interface PartyWithDetails extends PartyEvent {
  host: {
    id: string;
    username: string | null;
    avatarUrl: string | null;
  };
  tags: { tag: string }[];
  _count: {
    attendees: number;
    media: number;
  };
}

export interface GetFeedParams {
  userId?: string;
  cursor?: string;
  limit: number;
  tags?: string[];
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface FeedResult {
  parties: PartyWithDetails[];
  nextCursor?: string;
  hasMore: boolean;
}
```

## Service Errors

```typescript
// src/utils/errors.ts
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Error codes
export const ErrorCodes = {
  // Auth
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USERNAME_TAKEN: 'USERNAME_TAKEN',

  // Party
  PARTY_NOT_FOUND: 'PARTY_NOT_FOUND',
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_DATE: 'INVALID_DATE',
  PARTY_FULL: 'PARTY_FULL',
  ALREADY_ATTENDING: 'ALREADY_ATTENDING',

  // Permission
  FORBIDDEN: 'FORBIDDEN',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

## Dependency Injection

```typescript
// src/container.ts
import { Container } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

// Repositories
import { UserRepository } from '@/repositories/user.repository';
import { PartyRepository } from '@/repositories/party.repository';

// Services
import { UserService } from '@/services/users/user.service';
import { PartyService } from '@/services/parties/party.service';
import { NotificationService } from '@/services/notifications/notification.service';

export function createContainer(): Container {
  const container = new Container();

  // Infrastructure
  container.bind('PrismaClient').toConstantValue(new PrismaClient());
  container.bind('Redis').toConstantValue(new Redis(process.env.REDIS_URL));

  // Repositories
  container.bind(UserRepository).toSelf();
  container.bind(PartyRepository).toSelf();

  // Services
  container.bind(UserService).toSelf();
  container.bind(PartyService).toSelf();
  container.bind(NotificationService).toSelf();

  return container;
}
```

## Event-Driven Architecture

```typescript
// src/events/event-bus.ts
import { EventEmitter } from 'events';

export type DomainEvent =
  | { type: 'PARTY_CREATED'; payload: { partyId: string; hostId: string } }
  | { type: 'PARTY_LIVE'; payload: { partyId: string } }
  | { type: 'USER_FOLLOWED'; payload: { followerId: string; followingId: string } }
  | { type: 'RSVP_CREATED'; payload: { partyId: string; userId: string } }
  | { type: 'MESSAGE_SENT'; payload: { roomId: string; senderId: string } };

class EventBus {
  private emitter = new EventEmitter();

  emit(event: DomainEvent): void {
    this.emitter.emit(event.type, event.payload);
  }

  on<T extends DomainEvent['type']>(
    eventType: T,
    handler: (payload: Extract<DomainEvent, { type: T }>['payload']) => void
  ): void {
    this.emitter.on(eventType, handler);
  }
}

export const eventBus = new EventBus();

// Usage in service
class PartyService {
  async create(userId: string, input: CreatePartyInput) {
    const party = await this.repository.create({ ...input, hostId: userId });

    eventBus.emit({
      type: 'PARTY_CREATED',
      payload: { partyId: party.id, hostId: userId },
    });

    return party;
  }
}

// Event handlers
// src/events/handlers/notification.handler.ts
eventBus.on('PARTY_CREATED', async ({ partyId, hostId }) => {
  await notificationService.notifyFollowers(hostId, {
    type: 'NEW_PARTY',
    data: { partyId },
  });
});

eventBus.on('USER_FOLLOWED', async ({ followerId, followingId }) => {
  await notificationService.sendToUser(followingId, {
    type: 'NEW_FOLLOWER',
    data: { followerId },
  });
});
```

## Domain Validation

```typescript
// src/domain/party/party.validator.ts
import { CreatePartyInput } from './party.types';
import { ValidationError } from '@/utils/errors';

export function validateCreateParty(input: CreatePartyInput): void {
  const errors: { field: string; message: string }[] = [];

  if (input.title.length < 3) {
    errors.push({
      field: 'title',
      message: 'Title must be at least 3 characters'
    });
  }

  if (input.title.length > 100) {
    errors.push({
      field: 'title',
      message: 'Title cannot exceed 100 characters'
    });
  }

  if (input.startsAt < new Date()) {
    errors.push({
      field: 'startsAt',
      message: 'Start date must be in the future'
    });
  }

  if (input.maxAttendees && input.maxAttendees < 2) {
    errors.push({
      field: 'maxAttendees',
      message: 'Max attendees must be at least 2'
    });
  }

  if (input.tags && input.tags.length > 10) {
    errors.push({
      field: 'tags',
      message: 'Cannot have more than 10 tags'
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}
```

## Checklist: Nuevo Servicio

- [ ] Definir types/interfaces
- [ ] Implementar service class
- [ ] Inyectar dependencias correctamente
- [ ] Validar reglas de negocio
- [ ] Manejar errores con ServiceError
- [ ] Emitir eventos de dominio si aplica
- [ ] Invalidar cache cuando sea necesario
- [ ] Tests unitarios
- [ ] Documentar metodos publicos

## Principios

- **SRP**: Un servicio = un dominio
- **DIP**: Depender de interfaces, no implementaciones
- **Fail Fast**: Validar al inicio del metodo
- **No Side Effects**: Metodos deben ser predecibles
- **Immutability**: No mutar datos de entrada
