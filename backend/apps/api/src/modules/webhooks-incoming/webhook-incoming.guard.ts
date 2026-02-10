import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";

/**
 * Guard para rotas de webhook incoming.
 * Se WEBHOOK_INCOMING_SECRET estiver definido, exige Authorization e compara com o secret.
 * Aceita "Bearer <secret>" ou header direto.
 * Se o secret nao estiver configurado, permite e nao bloqueia (util em dev).
 */
@Injectable()
export class WebhookIncomingGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get<string>("WEBHOOK_INCOMING_SECRET")?.trim();
    if (!secret) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;
    const raw = typeof authHeader === "string" ? authHeader : "";
    const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();

    if (!token || token !== secret) {
      throw new UnauthorizedException("Webhook authorization invalida ou ausente.");
    }
    return true;
  }
}
