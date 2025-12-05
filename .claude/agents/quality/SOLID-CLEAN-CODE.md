---
name: SOLID-CLEAN-CODE
description: Principios SOLID y Clean Code para Party Gallery Server
tools: Read, Grep, Glob
model: haiku
permissionMode: default
---

# SOLID y Clean Code - Party Gallery Server

Referencia de principios de diseño y codigo limpio para el backend de Party Gallery.

## Principios SOLID

### S - Single Responsibility Principle (SRP)

> Una clase debe tener una sola razon para cambiar.

**Aplicacion en Backend:**

```typescript
// MAL: Service hace demasiado
class BadPartyService {
  async createParty() { }
  async uploadMedia() { }
  async sendNotification() { }
  async processPayment() { }
  async generateAnalytics() { }
}

// BIEN: Responsabilidades separadas
class PartyService {
  async create() { }
  async update() { }
  async delete() { }
}

class MediaService {
  async upload() { }
  async process() { }
}

class NotificationService {
  async send() { }
}
```

**Regla:** Un Service = Un dominio de negocio

### O - Open/Closed Principle (OCP)

> Abierto para extension, cerrado para modificacion.

```typescript
// BIEN: Extensible via Strategy Pattern
interface NotificationStrategy {
  send(user: User, message: string): Promise<void>;
}

class PushNotificationStrategy implements NotificationStrategy {
  async send(user: User, message: string) {
    await fcm.send(user.deviceToken, message);
  }
}

class EmailNotificationStrategy implements NotificationStrategy {
  async send(user: User, message: string) {
    await email.send(user.email, message);
  }
}

class NotificationService {
  constructor(private strategies: NotificationStrategy[]) {}

  async notifyUser(user: User, message: string) {
    for (const strategy of this.strategies) {
      await strategy.send(user, message);
    }
  }
}

// Agregar nuevo canal sin modificar NotificationService
class SMSNotificationStrategy implements NotificationStrategy { }
```

### L - Liskov Substitution Principle (LSP)

> Subtipos deben ser sustituibles por sus tipos base.

```typescript
// Interface base
interface MediaProcessor {
  process(file: Buffer): Promise<ProcessedMedia>;
  getMetadata(): MediaMetadata;
}

// Subtipos intercambiables
class ImageProcessor implements MediaProcessor {
  async process(file: Buffer) {
    // Resize, compress
    return { type: 'image', url: '...' };
  }

  getMetadata() {
    return { width: 1920, height: 1080 };
  }
}

class VideoProcessor implements MediaProcessor {
  async process(file: Buffer) {
    // Transcode, thumbnail
    return { type: 'video', url: '...', thumbnailUrl: '...' };
  }

  getMetadata() {
    return { width: 1920, height: 1080, duration: 120 };
  }
}

// Funciona con cualquier MediaProcessor
async function handleUpload(processor: MediaProcessor, file: Buffer) {
  const result = await processor.process(file);
  const metadata = processor.getMetadata();
  // ...
}
```

### I - Interface Segregation Principle (ISP)

> Interfaces especificas son mejores que una general.

```typescript
// MAL: Interface inflada
interface IUserRepository {
  findById(id: string): Promise<User>;
  findByEmail(email: string): Promise<User>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  updateAvatar(id: string, url: string): Promise<void>;
  updateSettings(id: string, settings: Settings): Promise<void>;
  getFollowers(id: string): Promise<User[]>;
  getFollowing(id: string): Promise<User[]>;
  follow(userId: string, targetId: string): Promise<void>;
}

// BIEN: Interfaces segregadas
interface IUserReader {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}

interface IUserWriter {
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}

interface IUserProfileUpdater {
  updateAvatar(id: string, url: string): Promise<void>;
  updateSettings(id: string, settings: Settings): Promise<void>;
}

interface ISocialGraph {
  getFollowers(id: string): Promise<User[]>;
  getFollowing(id: string): Promise<User[]>;
  follow(userId: string, targetId: string): Promise<void>;
}
```

### D - Dependency Inversion Principle (DIP)

> Depender de abstracciones, no de implementaciones.

```typescript
// Interface (abstraccion)
interface IPartyRepository {
  findById(id: string): Promise<Party | null>;
  save(party: Party): Promise<Party>;
  delete(id: string): Promise<void>;
}

// Implementacion concreta
class PrismaPartyRepository implements IPartyRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.party.findUnique({ where: { id } });
  }

  async save(party: Party) {
    return this.prisma.party.create({ data: party });
  }

  async delete(id: string) {
    await this.prisma.party.delete({ where: { id } });
  }
}

// Service depende de abstraccion
class PartyService {
  constructor(private partyRepo: IPartyRepository) {} // Interface, no impl

  async getParty(id: string) {
    return this.partyRepo.findById(id);
  }
}

// DI container inyecta implementacion
container.bind<IPartyRepository>(PrismaPartyRepository);
container.bind(PartyService);
```

## Clean Code

### Nombres Significativos

```typescript
// MAL
const d = 86400;
function calc(p: Party[]): number { }
class Utils { }

// BIEN
const SECONDS_IN_DAY = 86400;
function calculateTotalAttendees(parties: Party[]): number { }
class DateFormatter { }
```

### Funciones Pequenas

```typescript
// MAL: Funcion gigante
async function createPartyWithNotifications(data: CreatePartyInput) {
  // 100+ lineas haciendo de todo
}

// BIEN: Funciones pequenas y enfocadas
async function createParty(data: CreatePartyInput) {
  validatePartyData(data);
  const party = await saveParty(data);
  await createChatRoom(party.id);
  await notifyFollowers(party);
  await trackAnalytics('party_created', party);
  return party;
}

function validatePartyData(data: CreatePartyInput) { /* 10 lineas */ }
async function saveParty(data: CreatePartyInput) { /* 10 lineas */ }
async function createChatRoom(partyId: string) { /* 10 lineas */ }
async function notifyFollowers(party: Party) { /* 10 lineas */ }
```

### Evitar Numeros Magicos

```typescript
// MAL
if (video.durationMs > 120000) { }
if (attendees.length >= 500) { }

// BIEN
const MAX_VIDEO_DURATION_MS = 120000; // 2 minutes
const MAX_PARTY_ATTENDEES = 500;

if (video.durationMs > MAX_VIDEO_DURATION_MS) { }
if (attendees.length >= MAX_PARTY_ATTENDEES) { }
```

### Manejo de Errores

```typescript
// MAL: Error silenciado
async function getParty(id: string) {
  try {
    return await repository.findById(id);
  } catch (e) {
    console.log(e);
    return null; // Error perdido!
  }
}

// BIEN: Error explicito con tipos
class PartyNotFoundError extends Error {
  constructor(public partyId: string) {
    super(`Party ${partyId} not found`);
  }
}

async function getParty(id: string): Promise<Party> {
  const party = await repository.findById(id);
  if (!party) {
    throw new PartyNotFoundError(id);
  }
  return party;
}

// O usando Result type
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

async function getParty(id: string): Promise<Result<Party, PartyNotFoundError>> {
  const party = await repository.findById(id);
  if (!party) {
    return { ok: false, error: new PartyNotFoundError(id) };
  }
  return { ok: true, value: party };
}
```

### Composicion sobre Herencia

```typescript
// MAL: Herencia profunda
class BaseRepository { }
class CachedRepository extends BaseRepository { }
class AuditedCachedRepository extends CachedRepository { }
class PartyRepository extends AuditedCachedRepository { }

// BIEN: Composicion
class PartyRepository {
  constructor(
    private db: DatabaseClient,
    private cache: CacheService,
    private audit: AuditService
  ) {}

  async findById(id: string) {
    // Check cache
    const cached = await this.cache.get(`party:${id}`);
    if (cached) return cached;

    // Get from DB
    const party = await this.db.query('...');

    // Cache result
    await this.cache.set(`party:${id}`, party);

    // Audit
    await this.audit.log('party.read', { id });

    return party;
  }
}
```

### Inmutabilidad

```typescript
// MAL: Mutacion directa
function addTag(party: Party, tag: string) {
  party.tags.push(tag); // Muta el original!
  return party;
}

// BIEN: Crear nuevo objeto
function addTag(party: Party, tag: string): Party {
  return {
    ...party,
    tags: [...party.tags, tag]
  };
}
```

### Guard Clauses

```typescript
// MAL: Anidamiento profundo
async function updateParty(id: string, userId: string, data: UpdatePartyInput) {
  const party = await repository.findById(id);
  if (party) {
    if (party.hostId === userId) {
      if (party.status !== 'CANCELLED') {
        const updated = await repository.update(id, data);
        return updated;
      } else {
        throw new Error('Cannot update cancelled party');
      }
    } else {
      throw new Error('Not authorized');
    }
  } else {
    throw new Error('Party not found');
  }
}

// BIEN: Guard clauses
async function updateParty(id: string, userId: string, data: UpdatePartyInput) {
  const party = await repository.findById(id);

  if (!party) {
    throw new PartyNotFoundError(id);
  }

  if (party.hostId !== userId) {
    throw new UnauthorizedError('Not authorized to update this party');
  }

  if (party.status === 'CANCELLED') {
    throw new InvalidOperationError('Cannot update cancelled party');
  }

  return repository.update(id, data);
}
```

## Metricas de Calidad

| Metrica | Limite |
|---------|--------|
| Lineas por funcion | <= 30 |
| Lineas por clase | <= 300 |
| Parametros por funcion | <= 4 |
| Profundidad de anidamiento | <= 3 |
| Complejidad ciclomatica | <= 10 |
| Cobertura de tests | >= 80% |

## Checklist de Review

- [ ] Cada clase tiene una sola responsabilidad
- [ ] Nuevas funcionalidades extienden, no modifican
- [ ] Subtipos son intercambiables
- [ ] Interfaces son especificas
- [ ] Dependencias son abstracciones
- [ ] Nombres son descriptivos
- [ ] Funciones son pequenas
- [ ] Sin numeros magicos
- [ ] Errores manejados correctamente
- [ ] Composicion sobre herencia
- [ ] Inmutabilidad preferida
- [ ] Guard clauses usados
