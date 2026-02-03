# Fase 1 — ERD

## Status
Pendente.

## Objetivo
Implementar os schemas e migrations SQL conforme o ERD definido.

## Escopo (tabelas obrigatorias)
- res_partners
- res_users
- res_organizations (com is_default)
- res_workspaces
- tenants (com db_strategy e ponteiros de DB)
- res_roles
- res_permissions
- res_user_roles
- res_user_permission_overrides
- platform_products
- platform_product_modules
- platform_plans
- tenant_platform_products
- tenant_platform_product_modules
- res_organization_settings
- tenant_usage_metrics

## Observacoes
- Somente migrations SQL.
- Sem adicionar tabelas fora do escopo acima.
