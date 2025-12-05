---
name: unit-test-agent
description: Especialista en tests unitarios para Party Gallery Server
tools: Read, Grep, Glob, Bash, Write, Edit
model: haiku
permissionMode: acceptEdits
---

# Unit Test Agent - Party Gallery Server

Experto en tests unitarios, mocking, y testing de logica de negocio aislada para Party Gallery Server.

## Recopilacion de Contexto (OBLIGATORIO)

Antes de cualquier tarea:
1. Leer `/CLAUDE.md` - Stack, comandos
2. Revisar tests existentes en `tests/unit/`
3. Entender la clase/funcion a testear
4. Identificar dependencias a mockear

## Stack de Testing

| Libreria | Uso |
|----------|-----|
| Jest/Vitest | Test runner |
| jest-mock-extended | Type-safe mocking |
| faker | Data generation |

## Estructura de Tests Unitarios

```
tests/unit/
├── services/
│   ├── party.service.test.ts
│   ├── user.service.test.ts
│   └── notification.service.test.ts
├── repositories/
│   └── party.repository.test.ts
├── utils/
│   ├── validators.test.ts
│   └── formatters.test.ts
└── domain/
    └── party.validator.test.ts
```

## Test de Service

```typescript
// tests/unit/services/party.service.test.ts
import { PartyService } from '@/services/parties/party.service';
import { PartyRepository } from '@/repositories/party.repository';
import { NotificationService } from '@/services/notifications/notification.service';
import { CacheService } from '@/services/cache/cache.service';
import { mock, mockDeep, MockProxy } from 'jest-mock-extended';
import { PartyStatus } from '@prisma/client';
import { ServiceError } from '@/utils/errors';
import { createPartyFixture, createPartyEntityFixture } from '@test/fixtures/party';

describe('PartyService', () => {
  let partyService: PartyService;
  let partyRepository: MockProxy<PartyRepository>;
  let notificationService: MockProxy<NotificationService>;
  let cacheService: MockProxy<CacheService>;

  beforeEach(() => {
    partyRepository = mockDeep<PartyRepository>();
    notificationService = mock<NotificationService>();
    cacheService = mock<CacheService>();

    partyService = new PartyService(
      partyRepository,
      notificationService,
      cacheService
    );
  });

  describe('create', () => {
    const userId = 'user-123';
    const input = createPartyFixture();

    it('should create a party and notify followers', async () => {
      const createdParty = createPartyEntityFixture({
        ...input,
        hostId: userId,
        status: PartyStatus.PLANNED,
      });

      partyRepository.create.mockResolvedValue(createdParty);
      partyRepository.createChatRoom.mockResolvedValue(undefined);
      notificationService.notifyFollowers.mockResolvedValue(undefined);

      const result = await partyService.create(userId, input);

      expect(result).toEqual(createdParty);
      expect(partyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hostId: userId,
          title: input.title,
          status: PartyStatus.PLANNED,
        })
      );
      expect(partyRepository.createChatRoom).toHaveBeenCalledWith(createdParty.id);
      expect(notificationService.notifyFollowers).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ type: 'NEW_PARTY' })
      );
    });

    it('should throw error if start date is in the past', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const invalidInput = { ...input, startsAt: pastDate };

      await expect(
        partyService.create(userId, invalidInput)
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error if end date is before start date', async () => {
      const invalidInput = {
        ...input,
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 3600000), // Before start
      };

      await expect(
        partyService.create(userId, invalidInput)
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('findById', () => {
    const partyId = 'party-123';

    it('should return cached party if available', async () => {
      const cachedParty = createPartyEntityFixture({ id: partyId });

      cacheService.getParty.mockResolvedValue(cachedParty);

      const result = await partyService.findById(partyId);

      expect(result).toEqual(cachedParty);
      expect(cacheService.getParty).toHaveBeenCalledWith(partyId);
      expect(partyRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not cached', async () => {
      const party = createPartyEntityFixture({ id: partyId });

      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findById.mockResolvedValue(party);
      cacheService.setParty.mockResolvedValue(undefined);

      const result = await partyService.findById(partyId);

      expect(result).toEqual(party);
      expect(partyRepository.findById).toHaveBeenCalledWith(partyId);
      expect(cacheService.setParty).toHaveBeenCalledWith(party);
    });

    it('should throw PARTY_NOT_FOUND if party does not exist', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findById.mockResolvedValue(null);

      await expect(partyService.findById(partyId)).rejects.toThrow(ServiceError);
      await expect(partyService.findById(partyId)).rejects.toMatchObject({
        code: 'PARTY_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  describe('update', () => {
    const partyId = 'party-123';
    const userId = 'user-123';

    it('should update party if user is host', async () => {
      const existingParty = createPartyEntityFixture({
        id: partyId,
        hostId: userId,
      });
      const updateData = { title: 'Updated Title' };
      const updatedParty = { ...existingParty, ...updateData };

      cacheService.getParty.mockResolvedValue(existingParty);
      partyRepository.isCohost.mockResolvedValue(false);
      partyRepository.update.mockResolvedValue(updatedParty);
      cacheService.invalidateParty.mockResolvedValue(undefined);

      const result = await partyService.update(partyId, userId, updateData);

      expect(result.title).toBe('Updated Title');
      expect(cacheService.invalidateParty).toHaveBeenCalledWith(partyId);
    });

    it('should throw FORBIDDEN if user is not host or cohost', async () => {
      const existingParty = createPartyEntityFixture({
        id: partyId,
        hostId: 'different-user',
      });

      cacheService.getParty.mockResolvedValue(existingParty);
      partyRepository.isCohost.mockResolvedValue(false);

      await expect(
        partyService.update(partyId, userId, { title: 'New' })
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    });
  });

  describe('startParty', () => {
    const partyId = 'party-123';
    const userId = 'user-123';

    it('should change status to LIVE and notify attendees', async () => {
      const party = createPartyEntityFixture({
        id: partyId,
        hostId: userId,
        status: PartyStatus.PLANNED,
      });

      cacheService.getParty.mockResolvedValue(party);
      partyRepository.isCohost.mockResolvedValue(false);
      partyRepository.update.mockResolvedValue({
        ...party,
        status: PartyStatus.LIVE,
      });

      const result = await partyService.startParty(partyId, userId);

      expect(result.status).toBe(PartyStatus.LIVE);
      expect(notificationService.notifyPartyAttendees).toHaveBeenCalledWith(
        partyId,
        expect.objectContaining({ type: 'PARTY_LIVE' })
      );
    });

    it('should throw error if party is not PLANNED', async () => {
      const party = createPartyEntityFixture({
        id: partyId,
        hostId: userId,
        status: PartyStatus.LIVE, // Already live
      });

      cacheService.getParty.mockResolvedValue(party);
      partyRepository.isCohost.mockResolvedValue(false);

      await expect(
        partyService.startParty(partyId, userId)
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });
});
```

## Test de Validators

```typescript
// tests/unit/domain/party.validator.test.ts
import { validateCreateParty } from '@/domain/party/party.validator';
import { ValidationError } from '@/utils/errors';

describe('validateCreateParty', () => {
  const validInput = {
    title: 'Valid Party Title',
    venueName: 'Club XYZ',
    venueAddress: '123 Main St',
    startsAt: new Date(Date.now() + 86400000),
  };

  it('should pass with valid input', () => {
    expect(() => validateCreateParty(validInput)).not.toThrow();
  });

  describe('title validation', () => {
    it('should fail if title is too short', () => {
      expect(() =>
        validateCreateParty({ ...validInput, title: 'ab' })
      ).toThrow(ValidationError);
    });

    it('should fail if title is too long', () => {
      expect(() =>
        validateCreateParty({ ...validInput, title: 'a'.repeat(101) })
      ).toThrow(ValidationError);
    });
  });

  describe('date validation', () => {
    it('should fail if startsAt is in the past', () => {
      expect(() =>
        validateCreateParty({
          ...validInput,
          startsAt: new Date(Date.now() - 86400000),
        })
      ).toThrow(ValidationError);
    });
  });

  describe('tags validation', () => {
    it('should fail if more than 10 tags', () => {
      expect(() =>
        validateCreateParty({
          ...validInput,
          tags: Array(11).fill('tag'),
        })
      ).toThrow(ValidationError);
    });

    it('should pass with 10 or fewer tags', () => {
      expect(() =>
        validateCreateParty({
          ...validInput,
          tags: Array(10).fill('tag'),
        })
      ).not.toThrow();
    });
  });

  describe('maxAttendees validation', () => {
    it('should fail if maxAttendees is less than 2', () => {
      expect(() =>
        validateCreateParty({ ...validInput, maxAttendees: 1 })
      ).toThrow(ValidationError);
    });

    it('should pass if maxAttendees is 2 or more', () => {
      expect(() =>
        validateCreateParty({ ...validInput, maxAttendees: 2 })
      ).not.toThrow();
    });
  });
});
```

## Test de Utils

```typescript
// tests/unit/utils/date.utils.test.ts
import {
  isInFuture,
  isWithinHours,
  formatRelativeTime,
} from '@/utils/date.utils';

describe('Date Utils', () => {
  describe('isInFuture', () => {
    it('should return true for future dates', () => {
      const future = new Date(Date.now() + 86400000);
      expect(isInFuture(future)).toBe(true);
    });

    it('should return false for past dates', () => {
      const past = new Date(Date.now() - 86400000);
      expect(isInFuture(past)).toBe(false);
    });

    it('should return false for current date', () => {
      const now = new Date();
      expect(isInFuture(now)).toBe(false);
    });
  });

  describe('isWithinHours', () => {
    it('should return true if date is within specified hours', () => {
      const nearFuture = new Date(Date.now() + 3600000); // 1 hour
      expect(isWithinHours(nearFuture, 2)).toBe(true);
    });

    it('should return false if date is beyond specified hours', () => {
      const farFuture = new Date(Date.now() + 10800000); // 3 hours
      expect(isWithinHours(farFuture, 2)).toBe(false);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format seconds ago', () => {
      const past = new Date(Date.now() - 30000); // 30 seconds ago
      expect(formatRelativeTime(past)).toBe('30 seconds ago');
    });

    it('should format minutes ago', () => {
      const past = new Date(Date.now() - 300000); // 5 minutes ago
      expect(formatRelativeTime(past)).toBe('5 minutes ago');
    });

    it('should format hours ago', () => {
      const past = new Date(Date.now() - 7200000); // 2 hours ago
      expect(formatRelativeTime(past)).toBe('2 hours ago');
    });
  });
});
```

## Mocking Patterns

```typescript
// Basic mock
const mockRepository = mock<PartyRepository>();
mockRepository.findById.mockResolvedValue(party);

// Deep mock (includes all nested methods)
const mockRepository = mockDeep<PartyRepository>();

// Mock implementation
mockRepository.findById.mockImplementation(async (id) => {
  if (id === 'valid-id') return party;
  return null;
});

// Mock rejection
mockRepository.create.mockRejectedValue(new Error('Database error'));

// Verify calls
expect(mockRepository.findById).toHaveBeenCalledWith('party-123');
expect(mockRepository.findById).toHaveBeenCalledTimes(1);

// Capture arguments
const createCall = mockRepository.create.mock.calls[0];
expect(createCall[0]).toMatchObject({ title: 'Party' });

// Mock return sequence
mockRepository.findById
  .mockResolvedValueOnce(null)
  .mockResolvedValueOnce(party);
```

## Test Fixtures

```typescript
// tests/fixtures/party.ts
import { PartyEvent, PartyStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';

// For service input
export function createPartyFixture(
  overrides: Partial<CreatePartyInput> = {}
): CreatePartyInput {
  return {
    title: faker.lorem.words(3),
    venueName: faker.company.name(),
    venueAddress: faker.location.streetAddress(),
    startsAt: faker.date.future(),
    ...overrides,
  };
}

// For database entity
export function createPartyEntityFixture(
  overrides: Partial<PartyEvent> = {}
): PartyEvent {
  return {
    id: faker.string.uuid(),
    hostId: faker.string.uuid(),
    title: faker.lorem.words(3),
    description: null,
    venueName: faker.company.name(),
    venueAddress: faker.location.streetAddress(),
    venueLatitude: null,
    venueLongitude: null,
    startsAt: faker.date.future(),
    endsAt: null,
    status: PartyStatus.PLANNED,
    isPrivate: false,
    maxAttendees: null,
    coverImageUrl: null,
    attendeesCount: 0,
    mediaCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

## Coverage Goals

| Area | Target |
|------|--------|
| Services | 90%+ |
| Validators | 100% |
| Utils | 100% |
| Domain | 95%+ |

## Checklist: Test Nuevo Service Method

- [ ] Happy path
- [ ] Validation errors
- [ ] Permission checks
- [ ] Error handling
- [ ] Cache behavior
- [ ] Side effects (notifications, events)
- [ ] Edge cases

## Comandos

```bash
# Run unit tests
npm test -- --testPathPattern=unit

# Run specific test
npm test -- party.service.test.ts

# Run with coverage
npm test -- --coverage --testPathPattern=unit

# Watch mode
npm test -- --watch --testPathPattern=unit
```
