import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";
import { RequestContextService } from "./request-context.service";

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly requestContext: RequestContextService
  ) {}

  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const enabled =
      (this.configService.get<string>("AUDIT_LOG_ENABLED") ?? "false").toLowerCase() ===
      "true";

    if (!enabled) {
      return next();
    }

    const startedAt = Date.now();
    const logEntry = () => {
      const durationMs = Date.now() - startedAt;
      const user = req.user as { tenant_id?: string; organization_id?: string; workspace_id?: string };
      const correlationId = this.requestContext.getCorrelationId();

      const payload = {
        timestamp: new Date().toISOString(),
        level: "log",
        service: this.configService.get<string>("SERVICE_NAME") || "esm-api",
        correlation_id: correlationId,
        tenant_id: user?.tenant_id,
        organization_id: user?.organization_id,
        workspace_id: user?.workspace_id,
        message: "audit",
        context: "AuditMiddleware",
        data: {
          method: req.method,
          url: req.url,
          status_code: res.statusCode,
          duration_ms: durationMs,
          ip: req.ip
        }
      };

      process.stdout.write(`${JSON.stringify(payload)}\n`);
    };

    const raw = (res as unknown as { raw?: NodeJS.EventEmitter }).raw;
    if (raw && typeof raw.on === "function") {
      raw.on("finish", logEntry);
    } else if (typeof (res as unknown as NodeJS.EventEmitter).on === "function") {
      (res as unknown as NodeJS.EventEmitter).on("finish", logEntry);
    }
    next();
  }
}
