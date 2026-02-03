# Fase 0 — Stack

## Status
Concluida.

## Objetivo
Inicializar o API com NestJS e Fastify, garantindo configuracao via `.env`.

## Implementacao
- NestJS com `FastifyAdapter` no bootstrap.
- `ConfigModule` global com leitura de `.env`.
- Rota `/health` para validacao basica.

## Arquivos
- `apps/api/src/main.ts`
- `apps/api/src/modules/app.module.ts`
- `apps/api/src/modules/app.controller.ts`
- `apps/api/.env`

## Validacao
- `npm run build:api`
