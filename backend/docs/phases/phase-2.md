# Fase 2 — Security

## Status
Concluida.

## Objetivo
Implementar autenticacao, tokens e RBAC no backend.

## Escopo
- JWT RS256
- Refresh tokens
- Service tokens
- Middleware RBAC
- Sem logica de permissao no frontend

## Implementacao
- Tokens stateless (JWT) com RS256.
- Leitura de chaves via `.env` com `JWT_PRIVATE_KEY_PATH` e `JWT_PUBLIC_KEY_PATH`.
- Auth guard global para `/api/*` e `/internal/*`.
- RBAC via decorator `@RequirePermission(resource, action)`.
