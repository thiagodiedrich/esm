# Changelog

Todas as mudancas relevantes deste projeto serao documentadas aqui.

## v1.2.0 - 2026-02-03

### Adicionado
- Estrutura de monorepo com `apps/`, `modules/`, `packages/`, `workers/`.
- Bootstrap do API NestJS com Fastify adapter.
- Configuracao via `.env` e `ConfigModule` global.
- Endpoint de healthcheck em `/health`.
- Migration SQL da Fase 1 (ERD) no Control Plane.
- Autenticacao JWT RS256 com chaves em arquivo.
- Tokens stateless (refresh/service) e RBAC por decorator.

### Observacoes
- Esta versao cobre as Fases 0, 0.2, 1 e 2.
