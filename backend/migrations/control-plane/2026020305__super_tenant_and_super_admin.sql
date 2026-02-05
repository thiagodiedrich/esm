-- Regras de super tenant (empresa principal SaaS) e super admin por tenant/org.
--
-- 1) tenants: is_super_tenant (default false). Apenas um tenant no sistema pode ter is_super_tenant = true.
-- 2) res_users: is_super_tenant (default false). Um único usuário por tenant pode ter is_super_tenant = true.
--    Usuário is_super_tenant = true do tenant is_super_tenant = true tem acesso total (todos tenants, orgs, workspaces, rotas, menus).
-- 3) res_users: is_super_admin (default false), organization_id (nullable). Um único usuário por (tenant_id, organization_id) pode ter is_super_admin = true.
--    Esse usuário tem acesso total às organizations e workspaces do tenant e a todas as funcionalidades (rotas, menus, botões).

BEGIN;

-- tenants: is_super_tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_super_tenant BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_one_super_tenant
  ON tenants ((true))
  WHERE is_super_tenant = true;

-- res_users: is_super_tenant, is_super_admin, organization_id (escopo do super_admin)
ALTER TABLE res_users
  ADD COLUMN IF NOT EXISTS is_super_tenant BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE res_users
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES res_organizations(id) ON DELETE SET NULL;

ALTER TABLE res_users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Apenas um usuário por tenant pode ter is_super_tenant = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_res_users_one_super_tenant_per_tenant
  ON res_users (tenant_id)
  WHERE is_super_tenant = true;

-- Apenas um usuário por (tenant_id, organization_id) pode ter is_super_admin = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_res_users_one_super_admin_per_org
  ON res_users (tenant_id, organization_id)
  WHERE is_super_admin = true;

-- Quando is_super_admin = true, organization_id deve ser preenchido
ALTER TABLE res_users
  DROP CONSTRAINT IF EXISTS chk_super_admin_has_org;

ALTER TABLE res_users
  ADD CONSTRAINT chk_super_admin_has_org
  CHECK (is_super_admin = false OR organization_id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Atualização de dados (idempotente):
-- Se existir exatamente 1 tenant e 1 usuário (instalação nova típica), já marca
-- como super tenant / super admin para não depender só do bootstrap.
-- Caso haja vários tenants/usuários, o bootstrap (TENANT_MASTER_ADMIN_* no .env)
-- aplica os flags na subida do programa (primeira vez ou após migration).
-- ---------------------------------------------------------------------------
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
