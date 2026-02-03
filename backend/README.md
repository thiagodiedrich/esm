# esm

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
