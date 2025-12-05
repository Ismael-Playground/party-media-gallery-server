# Sistema de Agentes Claude - Party Gallery Server

Sistema de agentes especializados para desarrollo autonomo de Party Gallery Server (Backend).

**GitHub Project:** https://github.com/orgs/Ismael-Playground/projects/2

Todos los tickets generados se asignan a este proyecto para tracking centralizado.

## Estructura

```
.claude/
├── ORCHESTRATION.md           # Sistema de orquestacion
├── README.md                  # Este archivo
├── IMPLEMENTATION_PLAN.md     # Plan de implementacion
├── agents/
│   ├── development/           # Agentes de desarrollo
│   │   ├── api-developer.md
│   │   ├── database-engineer.md
│   │   ├── service-architect.md
│   │   └── realtime-developer.md
│   ├── testing/               # Agentes de testing
│   │   ├── api-test-agent.md
│   │   └── unit-test-agent.md
│   ├── quality/               # Agentes de calidad
│   │   ├── code-reviewer.md
│   │   ├── debugger.md
│   │   ├── security-auditor.md
│   │   └── SOLID-CLEAN-CODE.md
│   └── operations/            # Agentes de operaciones
│       ├── devops.md
│       └── infrastructure.md
└── commands/
    └── ticket.md              # Generador de tickets
```

## Agentes Disponibles

### Desarrollo (Ejecutores)

| Agente | Descripcion | Uso |
|--------|-------------|-----|
| `api-developer` | REST/GraphQL APIs | Endpoints, controllers, validation |
| `database-engineer` | Database operations | Schemas, migrations, queries |
| `service-architect` | Business logic | Services, use cases, domain |
| `realtime-developer` | Real-time features | WebSockets, events, notifications |

### Testing (Validadores)

| Agente | Descripcion | Uso |
|--------|-------------|-----|
| `api-test-agent` | API integration tests | Supertest, endpoint validation |
| `unit-test-agent` | Unit tests | Jest/Vitest, mocking |

### Calidad (Revisores)

| Agente | Descripcion | Uso |
|--------|-------------|-----|
| `code-reviewer` | Code review | PRs, best practices |
| `debugger` | Debugging | Bugs, troubleshooting |
| `security-auditor` | Security review | Vulnerabilities, OWASP |
| `SOLID-CLEAN-CODE` | Principios | Refactoring, architecture |

### Operaciones

| Agente | Descripcion | Uso |
|--------|-------------|-----|
| `devops` | CI/CD | GitHub Actions, deploys |
| `infrastructure` | Cloud/Infra | Docker, cloud services |

## Comandos Slash

| Comando | Descripcion |
|---------|-------------|
| `/ticket` | Crear ticket estructurado para agentes |

## Flujo de Trabajo

```
1. Usuario crea ticket con /ticket
   │
2. Issue creado en GitHub repo
   │
3. Issue asignado al proyecto (Ismael-Playground/projects/2)
   │
4. Agentes de desarrollo implementan
   │
5. Agentes de testing validan
   │
6. Agentes de calidad revisan
   │
7. Merge a develop
```

### Comandos GitHub

```bash
# Ver proyecto
gh project view 2 --owner Ismael-Playground

# Ver issues del repo
gh issue list --repo Ismael-Playground/party-media-gallery-server

# Crear issue y asignar al proyecto
ISSUE_URL=$(gh issue create --repo Ismael-Playground/party-media-gallery-server \
  --title "[Feature] Titulo" --body "contenido" --label "feature" | grep -o 'https://.*')
gh project item-add 2 --owner Ismael-Playground --url "$ISSUE_URL"
```

## Uso Rapido

### Crear un ticket para nuevo endpoint

```
/ticket

Quiero implementar el endpoint de creacion de party que:
- Reciba datos del evento (titulo, fecha, ubicacion)
- Valide permisos del usuario
- Guarde en base de datos
- Envie notificaciones a seguidores
- Retorne el evento creado
```

El comando generara un ticket estructurado con:
- Documentacion a leer
- Codigo de referencia
- Agentes asignados
- Archivos a crear/modificar
- Criterios de aceptacion

### Invocar un agente especifico

Mencionar el agente en el prompt:

```
@api-developer implementa el endpoint POST /api/v1/parties
siguiendo el patron REST y los ejemplos en src/routes/users.ts
```

## Stack Tecnologico (Recomendado)

| Tecnologia | Version | Uso |
|------------|---------|-----|
| Node.js | 20+ LTS | Runtime |
| TypeScript | 5.x | Lenguaje |
| Express/Fastify | - | Framework HTTP |
| PostgreSQL | 15+ | Base de datos relacional |
| Redis | 7+ | Cache, sessions, pub/sub |
| Socket.io | 4.x | WebSockets |
| Prisma/Drizzle | - | ORM |
| Jest/Vitest | - | Testing |
| Firebase Admin | - | Auth, push notifications |

## Servicios a Implementar

### Core APIs
- Authentication (Firebase Auth integration)
- Users (profiles, follow system)
- Party Events (CRUD, RSVP)
- Media (upload, processing)
- Chat (real-time messaging)
- Notifications (push, in-app)

### Supporting Services
- Search (Algolia integration)
- Analytics (event tracking)
- Recommendations (party suggestions)
- Moderation (content filtering)

## Documentacion Relacionada

- `/CLAUDE.md` - Configuracion principal del proyecto
- `/.claude/ORCHESTRATION.md` - Sistema de orquestacion
- `/.claude/IMPLEMENTATION_PLAN.md` - Plan de implementacion
- `/docs/` - Documentacion tecnica

## Metricas de Exito

| Metrica | Objetivo |
|---------|----------|
| Cobertura de tests | >80% |
| Issues de lint | 0 |
| Build status | Green |
| PR review time | <24h |
| API response time | <200ms p95 |
| Uptime | 99.9% |

---

*Party Gallery Server - Sistema de Agentes Claude*
*Actualizado: 2025-12-04*
