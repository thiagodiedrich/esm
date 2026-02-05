BEGIN;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  name VARCHAR,
  slug VARCHAR UNIQUE,
  db_strategy VARCHAR,
  control_plane_db VARCHAR,
  erp_db VARCHAR,
  telemetry_db VARCHAR,
  migration_status VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_partners (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  organization_id UUID,
  name VARCHAR,
  email VARCHAR,
  telephone VARCHAR,
  type VARCHAR,
  document VARCHAR,
  location_address VARCHAR,
  location_address_number VARCHAR,
  location_address_zip VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_organizations (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  partner_id UUID,
  name VARCHAR,
  is_default BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE res_partners ADD CONSTRAINT res_partners_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES res_organizations(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE res_organizations ADD CONSTRAINT res_organizations_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES res_partners(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS res_users (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  partner_id UUID REFERENCES res_partners(id),
  email VARCHAR,
  password_hash VARCHAR,
  is_active BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS res_workspaces (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  organization_id UUID REFERENCES res_organizations(id),
  name VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_roles (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_permissions (
  id UUID PRIMARY KEY,
  resource VARCHAR,
  action VARCHAR,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES res_users(id),
  role_id UUID REFERENCES res_roles(id),
  scope_type VARCHAR,
  scope_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_user_permission_overrides (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES res_users(id),
  permission_id UUID REFERENCES res_permissions(id),
  effect VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_products (
  id UUID PRIMARY KEY,
  code VARCHAR UNIQUE,
  name VARCHAR,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_product_modules (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES platform_products(id),
  code VARCHAR,
  name VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_plans (
  id UUID PRIMARY KEY,
  code VARCHAR UNIQUE,
  name VARCHAR,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_platform_products (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  product_id UUID REFERENCES platform_products(id),
  plan_id UUID REFERENCES platform_plans(id),
  is_active BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_platform_product_modules (
  id UUID PRIMARY KEY,
  tenant_product_id UUID REFERENCES tenant_platform_products(id),
  product_module_id UUID REFERENCES platform_product_modules(id),
  is_active BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_organization_settings (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES res_organizations(id),
  workspace_mode VARCHAR,
  remember_last_context BOOLEAN,
  menu_cache_ttl INTEGER,
  enable_mfa BOOLEAN,
  enable_oauth BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_usage_metrics (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  metric_key VARCHAR,
  metric_value BIGINT,
  period VARCHAR,
  source VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
