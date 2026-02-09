BEGIN;

CREATE TABLE IF NOT EXISTS res_role_permissions (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  role_id INTEGER NOT NULL REFERENCES res_roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES res_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_res_role_permissions_role ON res_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_res_role_permissions_permission ON res_role_permissions(permission_id);

COMMIT;
