-- Validações de unicidade: tenants, res_users, res_organizations.
-- tenants: id, uuid, slug, is_super_tenant (único no sistema).
-- res_users: id, uuid; is_super_tenant pode ter vários por tenant_id; is_super_admin único por (tenant_id, organization_id).
-- res_organizations: id, uuid, is_default único por tenant_id.

BEGIN;

-- tenants: id e uuid já são únicos via PRIMARY KEY e UNIQUE. slug já tem UNIQUE.
-- is_super_tenant: apenas 1 no sistema (idx_tenants_one_super_tenant na 2026020305).

-- res_users: id e uuid já únicos.
-- is_super_tenant: pode ter vários por tenant_id (um ou mais no tenant padrao do SaaS) - sem índice restritivo.
-- is_super_admin: único por (tenant_id, organization_id) - idx_res_users_one_super_admin_per_org na 2026020305.

-- res_organizations: id e uuid já únicos.
-- is_default: único por tenant_id (apenas 1 is_default por tenant).
CREATE UNIQUE INDEX IF NOT EXISTS idx_res_organizations_one_default_per_tenant
  ON res_organizations (tenant_id)
  WHERE is_default = true;

COMMIT;
