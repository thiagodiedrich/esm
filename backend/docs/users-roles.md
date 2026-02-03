# Users e Roles

## Status
Em andamento.

## Objetivo
Documentar o modelo de usuarios, roles e permissoes.

## Escopo previsto
- Tabelas do ERD: `res_users`, `res_roles`, `res_permissions`,
  `res_user_roles`, `res_user_permission_overrides`.
- RBAC por middleware (Fase 2).

## Implementado
- Decorator `@RequirePermission(resource, action)` para controle de acesso.
- Verificacao por `permissions` no JWT com overrides de permissao.
