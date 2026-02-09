-- Regras de super tenant e super admin por tenant/org.
-- organization_id em res_users referencia res_organizations(id) - INTEGER.

BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_super_tenant BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_one_super_tenant
  ON tenants ((true))
  WHERE is_super_tenant = true;

ALTER TABLE res_users
  ADD COLUMN IF NOT EXISTS is_super_tenant BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE res_users
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES res_organizations(id) ON DELETE SET NULL;

ALTER TABLE res_users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- is_super_tenant: pode ter varios por tenant_id (um ou mais no tenant padrao do SaaS)

CREATE UNIQUE INDEX IF NOT EXISTS idx_res_users_one_super_admin_per_org
  ON res_users (tenant_id, organization_id)
  WHERE is_super_admin = true;

ALTER TABLE res_users
  DROP CONSTRAINT IF EXISTS chk_super_admin_has_org;

ALTER TABLE res_users
  ADD CONSTRAINT chk_super_admin_has_org
  CHECK (is_super_admin = false OR organization_id IS NOT NULL);

UPDATE tenants
SET is_super_tenant = true, updated_at = now()
WHERE (SELECT COUNT(*) FROM tenants) = 1
  AND id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1);

UPDATE res_users u
SET
  is_super_tenant = true,
  is_super_admin = true,
  organization_id = (SELECT o.id FROM res_organizations o WHERE o.tenant_id = u.tenant_id ORDER BY o.created_at LIMIT 1),
  updated_at = now()
WHERE u.tenant_id = (SELECT id FROM tenants WHERE is_super_tenant = true LIMIT 1)
  AND (SELECT COUNT(*) FROM res_users r WHERE r.tenant_id = u.tenant_id) = 1
  AND EXISTS (SELECT 1 FROM res_organizations o WHERE o.tenant_id = u.tenant_id);

COMMIT;
