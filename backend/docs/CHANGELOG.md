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
- Tabela `res_user_last_context` para remember_last_context.
- Login com bcrypt e tenant resolvido por Host/X-Tenant-Slug.
- Context switch com reemissao de tokens e regras de workspace.
- Menu backend (`GET /api/menu`) com cache e regras de bloqueio.
- Multi-DB com catalogo `DB_CATALOG__*` e roteamento por tenant.
- Kafka (kafkajs) com correlation id e toggle via `KAFKA_ENABLED`.
- Logs JSON estruturados e correlation id obrigatorio.
- Endpoint interno de usage metrics.
- Endpoint interno para ponteiros de tenant e status de migracao.

### Observacoes
- Esta versao cobre as Fases 0, 0.2, 1, 2, 3, 4, 5 e 6.
