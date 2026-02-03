import { SetMetadata } from "@nestjs/common";
import { PERMISSION_METADATA_KEY } from "./rbac.constants";

export interface PermissionRequirement {
  resource: string;
  action: string;
}

export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_METADATA_KEY, { resource, action } satisfies PermissionRequirement);
