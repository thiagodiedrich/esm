-- Tabela que associa regras (roles) a permissões.
-- Necessária para o GET /api/v1/menu poder filtrar itens por permissão do usuário
-- (permissões herdadas das roles + overrides em res_user_permission_overrides).

BEGIN;

CREATE TABLE IF NOT EXISTS res_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES res_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES res_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_res_role_permissions_role ON res_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_res_role_permissions_permission ON res_role_permissions(permission_id);

COMMIT;
