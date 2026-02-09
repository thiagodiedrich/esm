BEGIN;

CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_id INTEGER REFERENCES tenants(id),
  organization_id INTEGER,
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
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_id INTEGER REFERENCES tenants(id),
  partner_id INTEGER,
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
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_id INTEGER REFERENCES tenants(id),
  partner_id INTEGER REFERENCES res_partners(id),
  email VARCHAR,
  password_hash VARCHAR,
  is_active BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS res_workspaces (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_id INTEGER REFERENCES tenants(id),
  organization_id INTEGER REFERENCES res_organizations(id),
  name VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_roles (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_id INTEGER REFERENCES tenants(id),
  name VARCHAR,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_permissions (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  resource VARCHAR,
  action VARCHAR,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_user_roles (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES res_users(id),
  role_id INTEGER REFERENCES res_roles(id),
  scope_type VARCHAR,
  scope_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_user_permission_overrides (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES res_users(id),
  permission_id INTEGER REFERENCES res_permissions(id),
  effect VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_products (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  code VARCHAR UNIQUE,
  name VARCHAR,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_product_modules (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  product_id INTEGER REFERENCES platform_products(id),
  code VARCHAR,
  name VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_plans (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  code VARCHAR UNIQUE,
  name VARCHAR,
  description VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_platform_products (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_id INTEGER REFERENCES tenants(id),
  product_id INTEGER REFERENCES platform_products(id),
  plan_id INTEGER REFERENCES platform_plans(id),
  is_active BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_platform_product_modules (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_product_id INTEGER REFERENCES tenant_platform_products(id),
  product_module_id INTEGER REFERENCES platform_product_modules(id),
  is_active BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS res_organization_settings (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  organization_id INTEGER REFERENCES res_organizations(id),
  workspace_mode VARCHAR,
  remember_last_context BOOLEAN,
  menu_cache_ttl INTEGER,
  enable_mfa BOOLEAN,
  enable_oauth BOOLEAN,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_usage_metrics (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tenant_id INTEGER REFERENCES tenants(id),
  metric_key VARCHAR,
  metric_value BIGINT,
  period VARCHAR,
  source VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
