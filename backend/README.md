# esm (backend)

**Versão estável: v1.9.0**

Backend da API ESM: NestJS + Fastify, multi-tenant, autenticação JWT, CORS e resolução de tenant por slug/domain.

## Fase 0 — Stack (NestJS + Fastify)

Implementado o bootstrap do API com NestJS e Fastify adapter, usando somente
configuracao via `.env`.

Estrutura criada:

- `apps/api/src/main.ts` com `NestFastifyApplication`
- `apps/api/src/modules/app.module.ts` com `ConfigModule`
- `apps/api/src/modules/app.controller.ts` com rota `/health`
- `apps/api/.env` com `NODE_ENV` e `PORT`

## Fase 0.2 — Monorepo

Estrutura de monorepo criada conforme o padrao:

- `apps/`
- `modules/`
- `packages/`
- `workers/`

### Como rodar o API (dev)

1. Instalar dependencias:
   - `npm install`
2. Subir API:
   - `npm run dev:api`

### Build e start

- `npm run build:api`
- `npm run start:api`

## Documentação

- **Rotas e Swagger:** `docs/swagger.md`
- **Resolução de tenant no login:** `docs/AI/LOGIN_E_RESOLUCAO_TENANT.md` (ordem: tenant_id → tenant_slug → subdomain → domain)
- **CORS:** `docs/AI/CORS_ESTRATEGIA.md` (tratamento único em `main.ts`; sem middleware de validação)
- **Changelog:** `docs/CHANGELOG.md`
- **Postman:** `docs/postman/ESM-API.postman_collection.json` — collection completa (Health, Auth, Context, Menu, Tenant CRUD, Admin, Internal)
