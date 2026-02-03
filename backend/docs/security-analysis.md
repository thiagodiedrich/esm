# Analise de Seguranca

## Status
Em andamento. Escopo atual limitado as Fases 0, 0.2 e 1, com Fase 2 implementada.

## Escopo atual
- API NestJS com Fastify adapter.
- Configuracao via `.env`.
- JWT RS256 com chaves em arquivo.
- Tokens stateless (refresh e service tokens).
- RBAC por resource + action via decorator.
- Login com bcrypt e tenant resolvido por Host/X-Tenant-Slug.
- Correlation ID via `X-Correlation-Id`.

## Riscos atuais conhecidos
- Revogacao depende de expiracao e rotacao de chaves.
- Emissao de tokens e resolucao de permissoes ainda nao implementadas.
 - Controle de tenant depende do header Host/X-Tenant-Slug.
 - Catalogo de DB depende de variaveis `DB_CATALOG__*`.

## Controles planejados
- JWT RS256.
- Refresh tokens.
- Service tokens para rotas `/internal/*`.
- Middleware RBAC.
- Escopos de tenant/organizacao/workspace por request.
