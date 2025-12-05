# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Instructions

De ahora en adelante, actúa como mi asistente experto, con acceso a todo tu razonamiento y conocimiento. Siempre proporciona:
- Una respuesta clara y directa a mi solicitud.
- Una explicación paso a paso de cómo llegaste allí.
- Perspectivas o soluciones alternativas que tal vez no se me hayan ocurrido.
- Un resumen práctico o un plan de acción que pueda aplicar de inmediato.

Nunca des respuestas vagas. Si la pregunta es amplia, divídela en partes. Si te pido ayuda, actúa como un profesional en ese ámbito.

## Project Overview

Party Gallery Server es el backend para Party Gallery App. Provee APIs RESTful, servicios de tiempo real, y logica de negocio para soportar la aplicacion multiplataforma de compartir momentos de fiestas.

**Current Status**: Repository setup - implementation starting.

## Architecture

El proyecto sigue Clean Architecture con capas bien definidas:

```
src/
├── routes/           # HTTP handlers (controllers)
│   ├── auth/
│   ├── users/
│   ├── parties/
│   ├── media/
│   └── chat/
├── services/         # Business logic
│   ├── auth/
│   ├── users/
│   ├── parties/
│   ├── media/
│   ├── chat/
│   └── notifications/
├── repositories/     # Data access layer
├── models/           # Database schemas (Prisma)
├── middleware/       # Express middleware
├── websocket/        # WebSocket handlers (Socket.io)
├── config/           # Configuration
├── utils/            # Utilities
└── types/            # TypeScript types
```

**Key Patterns:**
- Repository pattern for data layer
- Service layer for business logic
- Thin controllers delegating to services
- Zod for input validation
- Dependency injection with container
- JWT authentication with Firebase

## Technology Stack

**Core:**
- Node.js 20 LTS
- TypeScript 5.x
- Express.js (or Fastify)
- Prisma ORM
- PostgreSQL 15+
- Redis 7+
- Socket.io 4.x

**Authentication:**
- Firebase Admin SDK
- JWT tokens

**Integrations:**
- Firebase Cloud Messaging (push notifications)
- Firebase Storage (media)
- Algolia (search)

**Testing:**
- Vitest / Jest
- Supertest
- Faker.js

**DevOps:**
- Docker
- GitHub Actions
- ESLint + Prettier

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run typecheck

# Database
npm run db:migrate     # Run migrations
npm run db:push        # Push schema changes
npm run db:studio      # Open Prisma Studio
npm run db:generate    # Generate Prisma client

# Docker
docker-compose up -d   # Start all services
docker-compose down    # Stop all services
```

## Code Style Requirements

- Follow ESLint configuration
- Use Prettier for formatting
- TypeScript strict mode
- No `any` types (use `unknown` if needed)
- Async/await over callbacks
- Explicit return types on functions
- camelCase for variables and functions
- PascalCase for classes and types
- SCREAMING_SNAKE_CASE for constants

## API Design Conventions

**REST Endpoints:**
```
GET    /api/v1/parties          # List (with pagination)
GET    /api/v1/parties/:id      # Get one
POST   /api/v1/parties          # Create
PUT    /api/v1/parties/:id      # Update
DELETE /api/v1/parties/:id      # Delete
```

**Response Format:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

**Error Format:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "path": "field", "message": "Validation error" }
  ]
}
```

## Core Domain Models

**User:**
- id, firebaseId, email, username
- firstName, lastName, bio, avatarUrl
- followersCount, followingCount

**PartyEvent:**
- id, hostId, title, description
- venue (name, address, coordinates)
- startsAt, endsAt, status (PLANNED/LIVE/ENDED/CANCELLED)
- tags, coverImageUrl, maxAttendees

**MediaContent:**
- id, partyId, uploaderId
- type (PHOTO/VIDEO/AUDIO)
- url, thumbnailUrl, metadata
- mood (HYPE/CHILL/WILD/ROMANTIC/CRAZY/ELEGANT)

**ChatRoom & ChatMessage:**
- Real-time event-specific chat
- Support for text and media messages

## Environment Variables

```bash
# Required
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...

# Firebase
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Optional
ALGOLIA_APP_ID=...
ALGOLIA_API_KEY=...
```

## Sistema de Agentes

Este proyecto utiliza un sistema de agentes Claude especializados para desarrollo autonomo.

**Documentacion:**
- `.claude/ORCHESTRATION.md` - Sistema de orquestacion
- `.claude/IMPLEMENTATION_PLAN.md` - Plan de implementacion
- `.claude/README.md` - Guia rapida

**Auto-Routing de Tareas:**

| Tipo de Tarea | Agente |
|---------------|--------|
| API, endpoints | @api-developer |
| Database, schemas | @database-engineer |
| Business logic | @service-architect |
| WebSocket, real-time | @realtime-developer |
| Tests API | @api-test-agent |
| Tests unitarios | @unit-test-agent |
| Bug, crash | @debugger |
| Review, PR | @code-reviewer |
| Security | @security-auditor |
| Build, CI, deploy | @devops |
| Docker, infra | @infrastructure |

**Comandos Slash:**

| Comando | Descripcion |
|---------|-------------|
| `/ticket` | Crear ticket estructurado para agentes |

**Flujo de Trabajo:**
```
1. /ticket genera estructura
2. Issue creado en GitHub y asignado al proyecto
3. Agentes de desarrollo implementan
4. Agentes de testing validan
5. Agentes de calidad revisan
6. Merge a develop
```

**GitHub Project:**
- URL: https://github.com/orgs/Ismael-Playground/projects/2
- Todos los tickets se asignan automaticamente a este proyecto

## Important Notes

- This backend supports Party Gallery App (Kotlin Multiplatform)
- Security first: validate all input, sanitize output
- Performance matters: use caching, optimize queries
- Real-time: WebSocket for chat and live events
- All endpoints should have tests
- Document API changes in OpenAPI spec

## Related Projects

- **Frontend App**: `../party-media-gallery-app/` - Kotlin Multiplatform app
- **GitHub Project**: https://github.com/orgs/Ismael-Playground/projects/2
