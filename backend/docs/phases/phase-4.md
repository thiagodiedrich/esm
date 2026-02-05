# Fase 4 — Frontend Contracts

## Status
Concluida.

## Objetivo
Expor contratos backend para o frontend.

## Escopo
- Backend gera menu
- Acoes por RESOURCE
- Ocultar por padrao, bloquear apenas para upsell
- Cache de menu com TTL de `res_organization_settings`

## Implementacao
- Endpoint `GET /api/v1/menu`.
- Menu base definido em codigo e filtrado por RBAC.
- Itens bloqueados quando produto/modulo nao ativo.
- Cache por tenant + organizacao com TTL em segundos.
