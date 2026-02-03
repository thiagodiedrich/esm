import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { IS_PUBLIC_KEY } from "./auth.constants";
import { AuthService } from "./auth.service";

@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token Bearer ausente.");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const isInternal = request.url?.startsWith("/internal/");
    const payload = isInternal
      ? await this.authService.verifyServiceToken(token)
      : await this.authService.verifyUserToken(token);

    request.user = {
      auth_type: isInternal ? "service" : "user",
      ...payload
    };

    return true;
  }
}
