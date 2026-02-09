import { BadRequestException, Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest, FastifyReply } from "fastify";

@Injectable()
export class CorsValidationMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: FastifyRequest, _res: FastifyReply, next: () => void) {
    const corsOriginsRaw = this.configService.get<string>("CORS_ORIGINS")?.trim();
    if (!corsOriginsRaw) {
      return next();
    }

    const origins = corsOriginsRaw
      .split(",")
      .map((o) => o.trim().toLowerCase())
      .filter(Boolean);
    if (origins.length === 0) {
      return next();
    }

    const origin = req.headers.origin;
    if (typeof origin !== "string" || !origin.trim()) {
      return next();
    }

    const normalizedOrigin = origin.trim().toLowerCase();
    const allowed = origins.some((o) => o === normalizedOrigin);
    if (!allowed) {
      throw new BadRequestException("0 - Cors Origins inválido");
    }

    next();
  }
}
