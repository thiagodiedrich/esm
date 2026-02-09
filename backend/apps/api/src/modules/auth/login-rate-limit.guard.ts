import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";

/**
 * Rate limit por IP para POST /api/v1/auth/login.
 * Usa janela fixa de 1 minuto; configurável via LOGIN_RATE_LIMIT_PER_MINUTE.
 * Se 0 ou não definido, o guard não aplica limite (desligado).
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly store = new Map<
    string,
    { count: number; windowStart: number }
  >();
  private static readonly WINDOW_MS = 60_000;

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const limit = Number(
      this.configService.get<string>("LOGIN_RATE_LIMIT_PER_MINUTE") ?? 0
    );
    if (limit <= 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const ip = this.getClientIp(request);
    const now = Date.now();
    let entry = this.store.get(ip);

    if (!entry) {
      entry = { count: 0, windowStart: now };
      this.store.set(ip, entry);
    }

    if (now - entry.windowStart >= LoginRateLimitGuard.WINDOW_MS) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count += 1;
    if (entry.count > limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Muitas tentativas de login. Tente novamente em alguns minutos."
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  private getClientIp(req: FastifyRequest): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    return (req as { ip?: string }).ip ?? req.socket?.remoteAddress ?? "unknown";
  }
}
