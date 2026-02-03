BEGIN;

CREATE TABLE res_user_last_context (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES res_users(id),
  organization_id UUID REFERENCES res_organizations(id),
  workspace_id UUID REFERENCES res_workspaces(id),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
