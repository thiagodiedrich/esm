# Fase 3 — UI Flow (suporte backend)

## Status
Concluida.

## Objetivo
Fornecer suporte backend para o fluxo de UI.

## Escopo
- Login
- Context switch (tenant/org/workspace)
- Workspace opcional por organizacao
- Lembrar contexto opcional por organizacao

## Implementacao
- Login com email/senha (bcrypt cost 12) e tenant por `Host` ou `X-Tenant-Slug`.
- Access token 15 min e refresh token 7 dias (JWT RS256).
- Context switch em `POST /api/v1/context/switch` com reemissao de tokens.
- Regra de `workspace_mode` aplicada no login e no switch.
- Persistencia opcional de contexto em `res_user_last_context`.
