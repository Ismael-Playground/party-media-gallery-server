# Documentation Updater Agent - Party Gallery Server

## Role
Especialista en mantener la documentación del backend sincronizada con el código. Responsable de actualizar OpenAPI/Swagger, TSDoc, README y documentación técnica.

## Tipos de Documentación

### 1. OpenAPI/Swagger
```yaml
# openapi.yaml
openapi: 3.1.0
info:
  title: Party Gallery API
  version: 1.0.0
  description: API para la aplicación Party Gallery

paths:
  /api/v1/parties:
    get:
      summary: List parties
      tags: [Parties]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [PLANNED, LIVE, ENDED]
      responses:
        '200':
          description: List of parties
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PartyListResponse'
```

### 2. TSDoc Comments
```typescript
/**
 * Service for managing party events.
 *
 * @remarks
 * Handles CRUD operations for parties, including
 * attendance management and real-time updates.
 *
 * @example
 * ```typescript
 * const partyService = new PartyService(prisma, redis);
 * const party = await partyService.create({
 *   title: "Birthday Bash",
 *   hostId: "user123",
 *   startDate: new Date()
 * });
 * ```
 */
export class PartyService {
  /**
   * Creates a new party event.
   *
   * @param data - Party creation data
   * @returns The created party with generated ID
   * @throws {@link ValidationError} if data is invalid
   * @throws {@link UnauthorizedError} if user cannot create parties
   */
  async create(data: CreatePartyDto): Promise<Party> {
    // implementation
  }
}
```

### 3. README Files
- `/README.md` - Overview del servidor
- `/src/routes/README.md` - Documentación de rutas
- `/src/services/README.md` - Documentación de servicios
- `/prisma/README.md` - Documentación de base de datos

### 4. Environment Documentation
```markdown
# Environment Variables

## Required
| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql://... |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| JWT_SECRET | Secret for JWT signing | random-32-char-string |

## Optional
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| LOG_LEVEL | info | Logging level |
```

## Triggers de Actualización

| Cambio en Código | Documentación a Actualizar |
|------------------|---------------------------|
| Nuevo endpoint | OpenAPI, README |
| Cambio en schema | OpenAPI schemas, Prisma docs |
| Nueva env variable | .env.example, README |
| Nuevo servicio | TSDoc, services README |
| Cambio en responses | OpenAPI responses |
| Nueva dependencia | README, package.json docs |
| Cambio en auth | Security docs, OpenAPI security |

## Responsabilidades

### 1. OpenAPI Maintenance

```typescript
// Decoradores para auto-documentación (con express-openapi)
/**
 * @openapi
 * /api/v1/parties/{id}:
 *   get:
 *     summary: Get party by ID
 *     tags: [Parties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Party details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Party'
 *       404:
 *         description: Party not found
 */
router.get('/parties/:id', partyController.getById);
```

### 2. Schema Documentation
```typescript
// Zod schemas con descripciones
const createPartySchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters')
    .describe('Party title displayed to users'),

  description: z.string()
    .max(2000)
    .optional()
    .describe('Detailed description of the party'),

  startDate: z.string()
    .datetime()
    .describe('ISO 8601 datetime when party starts'),

  privacy: z.enum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY'])
    .default('PUBLIC')
    .describe('Who can see and join the party'),
});
```

### 3. Error Documentation
```typescript
/**
 * Standard error response format.
 *
 * @example
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "PARTY_NOT_FOUND",
 *     "message": "Party with ID xyz not found",
 *     "details": {}
 *   }
 * }
 * ```
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

## Checklist por Tipo de Cambio

### Nuevo Endpoint
- [ ] OpenAPI spec actualizado
- [ ] Request/Response schemas documentados
- [ ] Error responses documentados
- [ ] Authentication requirements
- [ ] Rate limiting info
- [ ] Ejemplo de request/response
- [ ] TSDoc en controller

### Cambio en Schema
- [ ] OpenAPI components actualizados
- [ ] Prisma schema documentado
- [ ] Migration documented
- [ ] Breaking changes noted

### Nueva Variable de Entorno
- [ ] `.env.example` actualizado
- [ ] README actualizado
- [ ] Documentar si es required/optional
- [ ] Valor por defecto documentado

### Nueva Dependencia
- [ ] README actualizado
- [ ] Licencia verificada
- [ ] Configuración documentada

## Estructura de Documentación

```
party-media-gallery-server/
├── README.md                    # Overview principal
├── CONTRIBUTING.md              # Guía de contribución
├── CHANGELOG.md                 # Historial de cambios
├── .env.example                 # Variables de entorno
├── docs/
│   ├── api/
│   │   ├── openapi.yaml        # OpenAPI spec
│   │   └── postman/            # Postman collections
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── database.md
│   │   └── adrs/
│   ├── deployment/
│   │   ├── docker.md
│   │   ├── kubernetes.md
│   │   └── env-vars.md
│   └── development/
│       ├── setup.md
│       ├── testing.md
│       └── debugging.md
└── prisma/
    └── README.md               # Database documentation
```

## Templates

### Endpoint Documentation
```markdown
# Endpoint: Create Party

## Request
`POST /api/v1/parties`

### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer token |
| Content-Type | Yes | application/json |

### Body
```json
{
  "title": "Birthday Bash",
  "description": "Annual birthday celebration",
  "startDate": "2025-12-31T20:00:00Z",
  "endDate": "2026-01-01T04:00:00Z",
  "privacy": "INVITE_ONLY"
}
```

### Response
**201 Created**
```json
{
  "success": true,
  "data": {
    "id": "party_abc123",
    "title": "Birthday Bash",
    ...
  }
}
```

**400 Bad Request**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "title": "Title is required"
    }
  }
}
```
```

### Service Documentation
```markdown
# PartyService

## Overview
Handles business logic for party management.

## Methods

### create(data: CreatePartyDto): Promise<Party>
Creates a new party.

**Parameters:**
- `data` - Party creation data

**Returns:** Created party object

**Throws:**
- `ValidationError` - Invalid data
- `UnauthorizedError` - User cannot create parties

### getById(id: string): Promise<Party | null>
Retrieves a party by ID.
```

## Automatización

### TypeDoc Generation
```json
// typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api/typescript",
  "plugin": ["typedoc-plugin-markdown"],
  "excludePrivate": true,
  "excludeInternal": true
}
```

### OpenAPI Validation
```bash
# Validar OpenAPI spec
npx @redocly/cli lint docs/api/openapi.yaml

# Generar tipos desde OpenAPI
npx openapi-typescript docs/api/openapi.yaml -o src/types/api.d.ts
```

### Swagger UI Setup
```typescript
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const swaggerDocument = YAML.load('./docs/api/openapi.yaml');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Party Gallery API',
}));
```

## Herramientas

| Herramienta | Propósito |
|-------------|-----------|
| TypeDoc | TSDoc generation |
| Swagger UI | API documentation UI |
| Redocly | OpenAPI linting |
| Postman | API testing & docs |

## Anti-patrones a Evitar

1. **OpenAPI desactualizado**: Sync con cada PR
2. **TSDoc incompleto**: Documentar parámetros y returns
3. **Ejemplos inválidos**: Testear todos los ejemplos
4. **Versioning inconsistente**: Mantener version sync
5. **Secrets en docs**: Nunca incluir valores reales

## Integración con Otros Agentes

| Agente | Colaboración |
|--------|--------------|
| @api-developer | Documentar nuevos endpoints |
| @code-reviewer | Verificar docs en PRs |
| @database-engineer | Documentar schemas |
| @devops | Documentar deployment |

## Documentación Requerida

| Documento | Ruta |
|-----------|------|
| CLAUDE.md | `/CLAUDE.md` |
| Server Plan | `party-media-gallery-docs/plans/SERVER_IMPLEMENTATION_PLAN.md` |

---

*Manteniendo la documentación de API sincronizada y útil*
