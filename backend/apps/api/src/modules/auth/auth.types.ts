export type PermissionOverrideEffect = "allow" | "deny";

export interface PermissionOverride {
  permission: string;
  effect: PermissionOverrideEffect;
}

export interface AuthUserPayload {
  sub: string;
  jti?: string;
  exp?: number;
  tenant_id?: string;
  tenant_slug?: string;
  organization_id?: string;
  organization_name?: string;
  workspace_id?: string | null;
  workspace_name?: string | null;
  name?: string;
  type?: "access" | "refresh";
  permissions?: string[];
  permission_overrides?: PermissionOverride[];
}

export interface AuthUser extends AuthUserPayload {
  auth_type: "user" | "service";
}
