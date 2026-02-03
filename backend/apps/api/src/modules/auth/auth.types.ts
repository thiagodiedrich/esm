export type PermissionOverrideEffect = "allow" | "deny";

export interface PermissionOverride {
  permission: string;
  effect: PermissionOverrideEffect;
}

export interface AuthUserPayload {
  sub: string;
  tenant_id?: string;
  organization_id?: string;
  workspace_id?: string;
  permissions?: string[];
  permission_overrides?: PermissionOverride[];
}

export interface AuthUser extends AuthUserPayload {
  type: "user" | "service";
}
