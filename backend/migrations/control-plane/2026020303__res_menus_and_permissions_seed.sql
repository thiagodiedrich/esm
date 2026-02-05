-- Menus na base de dados e permissões (funcionalidades) para controle de acesso.
-- Permite criar menus e acessos que a UI pode consumir depois.
--
-- Endpoints que já existem:
--   Admin: tenants (CRUD + PATCH status), plans (CRUD + PATCH status)
--   Tenant: organizations (CRUD), workspaces (CRUD), users (CRUD + PATCH password + PATCH status)
--
-- Endpoints que faltam criar (para as tabelas/ menus abaixo):
--   Admin: platform_products, platform_product_modules, tenant_platform_products,
--          tenant_usage_metrics (leitura), res_permissions (CRUD)
--   Tenant: res_partners (Contatos), res_roles, res_user_roles, res_user_permission_overrides,
--           res_organization_settings (por organização)

BEGIN;

-- Tabela de itens de menu (fonte única para menus + rotas + recurso/ação)
CREATE TABLE IF NOT EXISTS res_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES res_menus(id) ON DELETE SET NULL,
  label VARCHAR NOT NULL,
  icon VARCHAR,
  route VARCHAR,
  resource VARCHAR,
  action VARCHAR,
  product_code VARCHAR,
  product_module_code VARCHAR,
  sequence INT NOT NULL DEFAULT 0,
  scope VARCHAR NOT NULL DEFAULT 'tenant' CHECK (scope IN ('admin', 'tenant')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_res_menus_parent ON res_menus(parent_id);
CREATE INDEX IF NOT EXISTS idx_res_menus_scope ON res_menus(scope);

-- Seed: permissões (funcionalidades) por recurso e ação (idempotente: ignora se já existir)
INSERT INTO res_permissions (id, resource, action, description)
SELECT gen_random_uuid(), v.resource, v.action, v.description
FROM (VALUES
  ('admin.tenant', 'read', 'Listar e ver tenants'),
  ('admin.tenant', 'create', 'Criar tenant'),
  ('admin.tenant', 'update', 'Atualizar tenant'),
  ('admin.tenant', 'delete', 'Remover tenant'),
  ('admin.plan', 'read', 'Listar e ver planos'),
  ('admin.plan', 'create', 'Criar plano'),
  ('admin.plan', 'update', 'Atualizar plano'),
  ('admin.plan', 'delete', 'Remover plano'),
  ('admin.platform_product', 'read', 'Listar e ver produtos da plataforma'),
  ('admin.platform_product', 'create', 'Criar produto da plataforma'),
  ('admin.platform_product', 'update', 'Atualizar produto da plataforma'),
  ('admin.platform_product', 'delete', 'Remover produto da plataforma'),
  ('admin.platform_product_module', 'read', 'Listar e ver módulos/aplicativos'),
  ('admin.platform_product_module', 'create', 'Criar módulo/aplicativo'),
  ('admin.platform_product_module', 'update', 'Atualizar módulo/aplicativo'),
  ('admin.platform_product_module', 'delete', 'Remover módulo/aplicativo'),
  ('admin.tenant_platform_product', 'read', 'Ver produtos do tenant'),
  ('admin.tenant_platform_product', 'create', 'Atribuir produto ao tenant'),
  ('admin.tenant_platform_product', 'update', 'Atualizar produto do tenant'),
  ('admin.tenant_platform_product', 'delete', 'Remover produto do tenant'),
  ('admin.tenant_usage_metrics', 'read', 'Ver métricas de uso do tenant'),
  ('admin.permission', 'read', 'Listar e ver permissões'),
  ('admin.permission', 'create', 'Criar permissão'),
  ('admin.permission', 'update', 'Atualizar permissão'),
  ('admin.permission', 'delete', 'Remover permissão'),
  ('tenant.partner', 'read', 'Listar e ver contatos'),
  ('tenant.partner', 'create', 'Criar contato'),
  ('tenant.partner', 'update', 'Atualizar contato'),
  ('tenant.partner', 'delete', 'Remover contato'),
  ('tenant.organization', 'read', 'Listar e ver empresas'),
  ('tenant.organization', 'create', 'Criar empresa'),
  ('tenant.organization', 'update', 'Atualizar empresa'),
  ('tenant.organization', 'delete', 'Remover empresa'),
  ('tenant.user', 'read', 'Listar e ver usuários'),
  ('tenant.user', 'create', 'Criar usuário'),
  ('tenant.user', 'update', 'Atualizar usuário'),
  ('tenant.user', 'delete', 'Remover usuário'),
  ('tenant.workspace', 'read', 'Listar e ver workspaces'),
  ('tenant.workspace', 'create', 'Criar workspace'),
  ('tenant.workspace', 'update', 'Atualizar workspace'),
  ('tenant.workspace', 'delete', 'Remover workspace'),
  ('tenant.role', 'read', 'Listar e ver regras de acesso'),
  ('tenant.role', 'create', 'Criar regra'),
  ('tenant.role', 'update', 'Atualizar regra'),
  ('tenant.role', 'delete', 'Remover regra'),
  ('tenant.user_role', 'read', 'Ver vínculos usuário-regra'),
  ('tenant.user_role', 'create', 'Vincular regra ao usuário'),
  ('tenant.user_role', 'update', 'Atualizar vínculo'),
  ('tenant.user_role', 'delete', 'Remover vínculo usuário-regra'),
  ('tenant.user_permission_override', 'read', 'Ver overrides de permissão'),
  ('tenant.user_permission_override', 'create', 'Criar override de permissão'),
  ('tenant.user_permission_override', 'update', 'Atualizar override'),
  ('tenant.user_permission_override', 'delete', 'Remover override'),
  ('tenant.organization_settings', 'read', 'Ver configurações da empresa'),
  ('tenant.organization_settings', 'create', 'Criar configuração'),
  ('tenant.organization_settings', 'update', 'Atualizar configurações da empresa'),
  ('tenant.organization_settings', 'delete', 'Remover configuração')
) AS v(resource, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM res_permissions p WHERE p.resource = v.resource AND p.action = v.action
);

-- Seed: itens de menu (Admin) — só insere se ainda não existir menu admin
INSERT INTO res_menus (id, parent_id, label, icon, route, resource, action, sequence, scope)
SELECT gen_random_uuid(), NULL::uuid, 'Tenants', 'building', '/admin/tenants', 'admin.tenant', 'read', 10, 'admin' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'admin' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Planos', 'credit-card', '/admin/plans', 'admin.plan', 'read', 20, 'admin' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'admin' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Produtos (plataforma)', 'package', '/admin/platform-products', 'admin.platform_product', 'read', 30, 'admin' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'admin' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Aplicativos', 'grid', '/admin/product-modules', 'admin.platform_product_module', 'read', 40, 'admin' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'admin' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Produtos do tenant', 'layers', '/admin/tenant-products', 'admin.tenant_platform_product', 'read', 50, 'admin' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'admin' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Permissões', 'shield', '/admin/permissions', 'admin.permission', 'read', 60, 'admin' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'admin' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Métricas de uso', 'bar-chart', '/admin/usage-metrics', 'admin.tenant_usage_metrics', 'read', 70, 'admin' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'admin' LIMIT 1);

-- Seed: itens de menu (Tenant) — só insere se ainda não existir menu tenant
INSERT INTO res_menus (id, parent_id, label, icon, route, resource, action, sequence, scope)
SELECT gen_random_uuid(), NULL::uuid, 'Contatos', 'users', '/tenant/partners', 'tenant.partner', 'read', 10, 'tenant' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'tenant' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Empresas', 'building', '/tenant/organizations', 'tenant.organization', 'read', 20, 'tenant' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'tenant' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Usuários', 'user', '/tenant/users', 'tenant.user', 'read', 30, 'tenant' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'tenant' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Workspaces', 'folder', '/tenant/workspaces', 'tenant.workspace', 'read', 40, 'tenant' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'tenant' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Regras de acesso', 'lock', '/tenant/roles', 'tenant.role', 'read', 50, 'tenant' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'tenant' LIMIT 1)
UNION ALL SELECT gen_random_uuid(), NULL::uuid, 'Configurações da empresa', 'settings', '/tenant/organization-settings', 'tenant.organization_settings', 'read', 60, 'tenant' WHERE NOT EXISTS (SELECT 1 FROM res_menus WHERE scope = 'tenant' LIMIT 1);

COMMIT;
