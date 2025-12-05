---
name: ticket
description: Crear ticket estructurado para desarrollo autonomo por agentes en Party Gallery Server
---

# /ticket - Generador de Tickets Backend

Genera tickets con contexto completo para que agentes trabajen de forma autonoma.

## Formato de Ticket

```markdown
## Descripcion

{Descripcion breve y directa del problema o tarea. Maximo 2-3 oraciones.}

## Contexto para Agente

### Documentacion Requerida
| Documento | Proposito | Ruta |
|-----------|-----------|------|
| CLAUDE.md | Stack, arquitectura | `CLAUDE.md` |
| {Doc relevante} | {Para que} | `{ruta}` |

### Codigo de Referencia
| Archivo | Para que revisar |
|---------|------------------|
| `src/routes/{similar}/index.ts` | Ver patron de router |
| `src/services/{similar}/service.ts` | Ver patron de service |

### {Seccion Especifica del Contexto}
{Listas, tablas o codigo relevante para entender el problema}

## Subagentes Asignados
| Agente | Rol | Archivo |
|--------|-----|---------|
| `@api-developer` | {Rol especifico} | `.claude/agents/development/api-developer.md` |
| `@database-engineer` | {Rol especifico} | `.claude/agents/development/database-engineer.md` |

## Archivos a Crear
- `src/routes/{resource}/index.ts`
- `src/services/{resource}/{resource}.service.ts`
- `tests/{resource}/`

## Archivos a Modificar
- `src/routes/index.ts` - Registrar router
- `prisma/schema.prisma` - Si hay cambios de schema

## Criterios de Aceptacion
- [ ] Criterio 1
- [ ] Criterio 2
- [ ] Tests con >80% cobertura
- [ ] Code review aprobado

## Instrucciones de Implementacion
1. Paso 1
2. Paso 2
3. Paso 3
4. Paso 4
5. Verificar tests
6. Crear PR

## Estimacion
{N} horas

## Prioridad
P{1|2|3} - {Justificacion breve}
```

## Agentes Disponibles

### Development
| Agente | Archivo | Rol |
|--------|---------|-----|
| `@api-developer` | `.claude/agents/development/api-developer.md` | Endpoints REST, controllers |
| `@database-engineer` | `.claude/agents/development/database-engineer.md` | Prisma, migrations, queries |
| `@service-architect` | `.claude/agents/development/service-architect.md` | Logica de negocio, services |
| `@realtime-developer` | `.claude/agents/development/realtime-developer.md` | WebSocket, Socket.io |

### Testing
| Agente | Archivo | Rol |
|--------|---------|-----|
| `@api-test-agent` | `.claude/agents/testing/api-test-agent.md` | Tests de integracion |
| `@unit-test-agent` | `.claude/agents/testing/unit-test-agent.md` | Tests unitarios |

### Quality
| Agente | Archivo | Rol |
|--------|---------|-----|
| `@code-reviewer` | `.claude/agents/quality/code-reviewer.md` | Code review |
| `@debugger` | `.claude/agents/quality/debugger.md` | Debugging, investigacion |
| `@security-auditor` | `.claude/agents/quality/security-auditor.md` | Seguridad, vulnerabilidades |
| `@SOLID-CLEAN-CODE` | `.claude/agents/quality/SOLID-CLEAN-CODE.md` | Principios SOLID |

### Operations
| Agente | Archivo | Rol |
|--------|---------|-----|
| `@devops` | `.claude/agents/operations/devops.md` | CI/CD, Docker, deploy |
| `@infrastructure` | `.claude/agents/operations/infrastructure.md` | Cloud, Terraform |

## Ejemplos

### Feature - API Endpoint

```markdown
## Descripcion

Implementar endpoint `POST /api/v1/parties` para crear nuevos party events. El endpoint debe validar datos, verificar autenticacion, y crear el registro en la base de datos.

## Contexto para Agente

### Documentacion Requerida
| Documento | Proposito | Ruta |
|-----------|-----------|------|
| CLAUDE.md | Stack y patrones | `CLAUDE.md` |
| API Patterns | Patron de endpoints | `.claude/agents/development/api-developer.md` |

### Codigo de Referencia
| Archivo | Para que revisar |
|---------|------------------|
| `src/routes/users/index.ts` | Ver patron de router |
| `src/services/users/users.service.ts` | Ver patron de service |
| `src/routes/users/schemas.ts` | Ver validacion Zod |

### Request/Response
```json
// POST /api/v1/parties
// Request
{
  "title": "string",
  "venue": { "name": "string", "address": "string" },
  "startsAt": "2025-01-01T20:00:00Z"
}

// Response 201
{
  "success": true,
  "data": { "id": "uuid", "title": "string", ... }
}
```

## Subagentes Asignados
| Agente | Rol | Archivo |
|--------|-----|---------|
| `@database-engineer` | Verificar schema Prisma | `.claude/agents/development/database-engineer.md` |
| `@api-developer` | Implementar endpoint | `.claude/agents/development/api-developer.md` |
| `@api-test-agent` | Tests de integracion | `.claude/agents/testing/api-test-agent.md` |

## Archivos a Crear
- `src/routes/parties/index.ts`
- `src/routes/parties/handlers.ts`
- `src/routes/parties/schemas.ts`
- `src/services/parties/parties.service.ts`
- `tests/integration/parties/create.test.ts`

## Archivos a Modificar
- `src/routes/index.ts` - Registrar router
- `src/container.ts` - Registrar service

## Criterios de Aceptacion
- [ ] Endpoint funcional con validacion Zod
- [ ] Autenticacion requerida
- [ ] Errores manejados (400, 401, 500)
- [ ] Tests de integracion
- [ ] Code review aprobado

## Instrucciones de Implementacion
1. Crear Zod schemas para request/response
2. Crear service con logica de creacion
3. Crear handlers con validacion
4. Registrar router en index
5. Escribir tests de integracion
6. Ejecutar lint y typecheck

## Estimacion
4 horas

## Prioridad
P1 - Core feature para MVP
```

### Bug

```markdown
## Descripcion

Error 500 al llamar `GET /api/v1/parties/:id` con un ID valido. El error ocurre cuando el party tiene `endsAt: null`.

## Contexto para Agente

### Documentacion Requerida
| Documento | Proposito | Ruta |
|-----------|-----------|------|
| Debugging Guide | Proceso de debug | `.claude/agents/quality/debugger.md` |

### Codigo de Referencia
| Archivo | Para que revisar |
|---------|------------------|
| `src/routes/parties/handlers.ts` | Handler con el bug |
| `src/services/parties/parties.service.ts` | Logica de query |

### Stack Trace
```
TypeError: Cannot read property 'toISOString' of null
    at formatParty (src/services/parties/parties.service.ts:45)
    at getPartyById (src/services/parties/parties.service.ts:23)
```

## Subagentes Asignados
| Agente | Rol | Archivo |
|--------|-----|---------|
| `@debugger` | Investigar causa raiz | `.claude/agents/quality/debugger.md` |
| `@api-developer` | Implementar fix | `.claude/agents/development/api-developer.md` |
| `@api-test-agent` | Test de regresion | `.claude/agents/testing/api-test-agent.md` |

## Archivos a Modificar
- `src/services/parties/parties.service.ts` - Fix null handling

## Criterios de Aceptacion
- [ ] Bug reproducido en test
- [ ] Fix implementado
- [ ] Test de regresion escrito
- [ ] No regresiones en tests existentes

## Instrucciones de Implementacion
1. Escribir test que reproduce el bug
2. Identificar linea exacta del error
3. Agregar null check en formatParty
4. Verificar que test pasa
5. Ejecutar suite completa

## Estimacion
2 horas

## Prioridad
P1 - Afecta funcionalidad core
```

## Comandos

```bash
# Crear issue con labels en titulo
gh issue create --repo Ismael-Playground/party-media-gallery-server \
  --title "[P1][Feature] POST /api/v1/parties" \
  --body "$(cat ticket.md)"

# Agregar al proyecto
gh project item-add 2 --owner Ismael-Playground --url "$ISSUE_URL"
```

## Prioridades

| Prioridad | Cuando usar |
|-----------|-------------|
| P0 | Produccion caida, datos en riesgo |
| P1 | Feature core, bug importante |
| P2 | Mejora, tech debt |
| P3 | Nice to have |

---

*Template para Party Gallery Server*
