# Analise de Seguranca

## Status
Em andamento. Escopo atual limitado as Fases 0 e 0.2.

## Escopo atual
- API NestJS com Fastify adapter.
- Configuracao via `.env`.
- Sem autenticacao, sem RBAC, sem banco de dados.

## Riscos atuais conhecidos
- Nao ha controle de acesso implementado (a ser enderecado na Fase 2).
- Nao ha persistencia de dados ainda (Fase 1).

## Controles planejados
- JWT RS256.
- Refresh tokens.
- Service tokens para rotas `/internal/*`.
- Middleware RBAC.
- Escopos de tenant/organizacao/workspace por request.
