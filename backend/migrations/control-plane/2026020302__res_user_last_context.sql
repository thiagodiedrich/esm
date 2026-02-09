BEGIN;

CREATE TABLE IF NOT EXISTS res_user_last_context (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES res_users(id),
  organization_id INTEGER REFERENCES res_organizations(id),
  workspace_id INTEGER REFERENCES res_workspaces(id),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
