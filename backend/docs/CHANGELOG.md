# Changelog

Todas as mudancas relevantes deste projeto serao documentadas aqui.

## v1.7.0 - 2026-02-04

### Adicionado
- Swagger atualizado para rotas de Telemetry e Storage internos.
- Guardrails no download interno (bucket fixo, rate-limit opcional, escopo por tenant).
- Filtro global de excecoes para respostas amigaveis quando servicos/DB caem.
- Retry de bootstrap para tolerar indisponibilidade do Postgres.

### Ajustado
- Login com fallback para TENANT_DEFAULT_ID quando multi-tenant estiver desligado.
- Resolucao de tenant ignora host localhost/IP para testes via Swagger.
- MinIO putObject com size correto e DTOs Swagger com tipagem strict.
- Composicao do Postgres sem shell para evitar execucao como root.

### Observacoes
- Esta versao cobre as Fases 0, 0.2, 1, 2, 3, 4, 5, 6 e 7 (base).

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
