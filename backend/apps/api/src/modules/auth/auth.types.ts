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
  organization_id?: string;
  workspace_id?: string | null;
  type?: "access" | "refresh";
  permissions?: string[];
  permission_overrides?: PermissionOverride[];
}

export interface AuthUser extends AuthUserPayload {
  auth_type: "user" | "service";
}
