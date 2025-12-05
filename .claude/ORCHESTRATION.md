# Sistema de Orquestacion de Agentes - Party Gallery Server

## Vision General

Este documento define el sistema de orquestacion de agentes Claude para el desarrollo autonomo de Party Gallery Server (Backend). El sistema permite que diferentes agentes especializados trabajen de forma coordinada a traves de tickets estructurados para desarrollar las APIs y servicios que soportan la aplicacion Party Gallery.

## Arquitectura del Sistema

```
                    ┌─────────────────────┐
                    │   TICKET MANAGER    │
                    │  (Genera tickets)   │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │  DESARROLLO  │   │   TESTING    │   │   DEVOPS     │
    │    AGENTS    │   │   AGENTS     │   │   AGENTS     │
    └──────────────┘   └──────────────┘   └──────────────┘
           │                   │                   │
           ├───────────────────┼───────────────────┤
           │                   │                   │
           ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │    REVIEW    │   │     QA       │   │   DEPLOY     │
    │    AGENTS    │   │   AGENTS     │   │   CHECK      │
    └──────────────┘   └──────────────┘   └──────────────┘
```

## Tipos de Agentes

### 1. Agentes de Desarrollo (Ejecutores)

| Agente | Rol | Cuando Usar |
|--------|-----|-------------|
| `api-developer` | REST/GraphQL APIs | Endpoints, controllers, routing |
| `database-engineer` | Base de datos | Schemas, migrations, queries |
| `service-architect` | Logica de negocio | Services, use cases, domain |
| `realtime-developer` | WebSockets/Events | Chat, notifications, live updates |
| `auth-specialist` | Autenticacion/Autorizacion | JWT, OAuth, permisos |

### 2. Agentes de Testing (Validadores)

| Agente | Rol | Cuando Usar |
|--------|-----|-------------|
| `api-test-agent` | Tests de API | Endpoint tests, integration |
| `unit-test-agent` | Tests unitarios | Service, repository tests |
| `load-test-agent` | Performance | Stress tests, benchmarks |
| `security-tester` | Seguridad | Penetration tests, OWASP |

### 3. Agentes de Calidad (Revisores)

| Agente | Rol | Cuando Usar |
|--------|-----|-------------|
| `code-reviewer` | Code review | Pre-merge, PR review |
| `SOLID-CLEAN-CODE` | Principios | Refactoring, arquitectura |
| `debugger` | Bugs | Investigacion, fixes |
| `security-auditor` | Seguridad | Audit de codigo, vulnerabilidades |

### 4. Agentes de Operaciones

| Agente | Rol | Cuando Usar |
|--------|-----|-------------|
| `devops` | CI/CD | Pipelines, builds, deploy |
| `infrastructure` | Cloud/Infra | Docker, K8s, cloud services |
| `monitoring` | Observabilidad | Logs, metrics, alerts |
| `documentation-updater` | Docs | API docs, README, OpenAPI |

## Flujo de Trabajo

### Flujo para Nuevo Endpoint API

```
1. TICKET CREADO
   │
   ├── /ticket genera estructura completa
   │
2. DISEÑO
   │
   ├── @service-architect diseña la solucion
   ├── Define modelos, DTOs, interfaces
   │
3. DESARROLLO
   │
   ├── @database-engineer crea migrations/schemas
   ├── @api-developer implementa endpoints
   ├── @auth-specialist configura permisos
   │
4. TESTING
   │
   ├── @unit-test-agent escribe tests unitarios
   ├── @api-test-agent escribe tests de integracion
   │
5. REVIEW
   │
   ├── @code-reviewer hace review
   ├── @security-auditor valida seguridad
   │
6. DEPLOY
   │
   ├── @devops valida CI/CD
   └── COMPLETADO
```

### Flujo para Bug Fix

```
1. BUG REPORTADO
   │
   ├── /ticket genera ticket de bug
   │
2. INVESTIGACION
   │
   ├── @debugger analiza el problema
   ├── Identifica causa raiz
   │
3. FIX
   │
   ├── @api-developer o @database-engineer implementa fix
   │
4. TESTING
   │
   ├── @unit-test-agent escribe test de regresion
   ├── @api-test-agent valida fix en endpoints
   │
5. REVIEW
   │
   ├── @code-reviewer aprueba
   └── MERGE
```

### Flujo para Feature de Real-time

```
1. TICKET CREADO
   │
   ├── /ticket genera estructura
   │
2. DESARROLLO
   │
   ├── @realtime-developer implementa WebSockets
   ├── @database-engineer configura pub/sub
   ├── @service-architect implementa eventos
   │
3. TESTING
   │
   ├── @api-test-agent tests de conexion
   ├── @load-test-agent tests de concurrencia
   │
4. REVIEW + DEPLOY
   │
   └── @devops configura scaling
```

## Estructura de Ticket

Todo ticket debe contener:

```markdown
## [TYPE] Titulo descriptivo

### Descripcion
Que hacer y por que.

### Contexto para Agente

#### Documentacion Requerida (LEER PRIMERO)
| Documento | Ruta |
|-----------|------|
| CLAUDE.md | `/CLAUDE.md` |
| Arquitectura | `/docs/architecture.md` |

#### Codigo de Referencia (REVISAR)
| Archivo | Para que revisar |
|---------|------------------|
| `src/routes/similar.ts` | Ver patron existente |

### Subagentes Asignados
| Agente | Rol |
|--------|-----|
| `@api-developer` | Implementacion |
| `@api-test-agent` | Testing |

### Archivos a Crear/Modificar
- [ ] `src/routes/newEndpoint.ts`
- [ ] `src/services/newService.ts`

### API Specification
**Endpoint**: `[METHOD] /api/v1/resource`
**Request**:
\`\`\`json
{
  "field": "type"
}
\`\`\`
**Response**:
\`\`\`json
{
  "success": true,
  "data": {}
}
\`\`\`

### Criterios de Aceptacion
- [ ] Endpoint funcional con validacion
- [ ] Tests con cobertura >80%
- [ ] Documentacion OpenAPI actualizada

### Labels
- feature | bug | refactor
- priority:P1 | P2 | P3
```

## Auto-Routing de Tareas

| Patron en Ticket | Agente Asignado |
|------------------|-----------------|
| API, endpoint, controller | @api-developer |
| Database, migration, schema | @database-engineer |
| Service, business logic | @service-architect |
| WebSocket, real-time, events | @realtime-developer |
| Auth, JWT, permissions | @auth-specialist |
| Test API, integration | @api-test-agent |
| Test unit, mock | @unit-test-agent |
| Performance, load | @load-test-agent |
| Bug, crash, error | @debugger |
| Review, PR | @code-reviewer |
| Security, vulnerability | @security-auditor |
| Build, CI, deploy | @devops |
| Docker, K8s, infrastructure | @infrastructure |

## Comandos Slash Disponibles

| Comando | Uso |
|---------|-----|
| `/ticket` | Crear ticket estructurado |
| `/review` | Code review de cambios |
| `/test` | Ejecutar tests |
| `/docs` | Generar/actualizar documentacion API |
| `/deploy-check` | Verificar pre-deploy |

## Integracion con GitHub

### Proyecto GitHub

**URL del Proyecto:** https://github.com/orgs/Ismael-Playground/projects/2

Todos los tickets deben asignarse a este proyecto para tracking centralizado.

### Crear Issue y Asignar a Proyecto

```bash
# Crear issue
gh issue create --repo Ismael-Playground/party-media-gallery-server \
  --title "[Feature] Titulo descriptivo" \
  --body "$(cat ticket.md)" \
  --label "feature,backend,priority:P1"

# Obtener URL del issue creado y asignar al proyecto
ISSUE_URL=$(gh issue create --repo Ismael-Playground/party-media-gallery-server \
  --title "[Feature] Titulo" \
  --body "$(cat ticket.md)" \
  --label "feature" | tail -1)

# Agregar al proyecto (proyecto #2 de la org)
gh project item-add 2 --owner Ismael-Playground --url "$ISSUE_URL"
```

### Comando Rapido: Crear y Asignar

```bash
# Script completo para crear ticket y asignar al proyecto
create_ticket() {
  local title="$1"
  local body="$2"
  local labels="$3"

  # Crear issue
  local url=$(gh issue create \
    --repo Ismael-Playground/party-media-gallery-server \
    --title "$title" \
    --body "$body" \
    --label "$labels" | tail -1)

  # Asignar al proyecto #2
  gh project item-add 2 --owner Ismael-Playground --url "$url"

  echo "Ticket creado y asignado: $url"
}

# Uso:
# create_ticket "[Feature] Nueva API" "$(cat ticket.md)" "feature,backend"
```

### Labels Estandar

| Categoria | Labels |
|-----------|--------|
| Tipo | feature, bug, refactor, security, performance |
| Area | backend, api, database, auth, realtime, infrastructure |
| Prioridad | priority:P0, priority:P1, priority:P2, priority:P3 |
| Estado | needs-review, in-progress, blocked |

## Reglas de Coordinacion

1. **Un agente a la vez**: Solo un agente trabaja en un archivo
2. **Secuencia obligatoria**: Diseño -> Desarrollo -> Testing -> Review
3. **Tests primero**: No merge sin tests
4. **Documentacion**: Actualizar OpenAPI si cambia API publica
5. **Commit atomico**: Un commit por cambio logico
6. **Security first**: Review de seguridad obligatorio para auth/data

## Metricas de Exito

| Metrica | Objetivo |
|---------|----------|
| Cobertura de tests | >80% |
| Issues de lint | 0 |
| Build status | Green |
| PR review time | <24h |
| Bug regression | 0 |
| API response time | <200ms p95 |
| Security vulnerabilities | 0 critical |

---

*Ultima actualizacion: 2025-12-04*
