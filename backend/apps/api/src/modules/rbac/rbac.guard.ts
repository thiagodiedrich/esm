import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { AuthUser } from "../auth/auth.types";
import { PERMISSION_METADATA_KEY } from "./rbac.constants";
import { PermissionRequirement } from "./rbac.decorators";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSION_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      throw new UnauthorizedException("Usuario nao autenticado.");
    }

    const permissionKey = `${requirement.resource}:${requirement.action}`;
    const overrides = user.permission_overrides ?? [];
    const override = overrides.find((item) => item.permission === permissionKey);

    if (override?.effect === "deny") {
      throw new ForbiddenException("Permissao negada por override.");
    }

    if (override?.effect === "allow") {
      return true;
    }

    if (user.permissions?.includes(permissionKey)) {
      return true;
    }

    throw new ForbiddenException("Permissao insuficiente.");
  }
}
