import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";

@Catch()
export class ServiceExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ServiceExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return this.sendResponse(response, request, status, body);
    }

    const isDatabaseError = this.isDatabaseError(exception);
    const statusCode = isDatabaseError ? 503 : 500;
    const message = isDatabaseError
      ? "oops, falha de comunicacao com o banco de dados."
      : "oops, falha de comunicacao com o servico.";

    this.logger.error(message, (exception as Error)?.stack);

    return this.sendResponse(response, request, statusCode, {
      statusCode,
      message,
      error: isDatabaseError ? "DatabaseUnavailable" : "ServiceUnavailable",
      timestamp: new Date().toISOString(),
      path: request.url
    });
  }

  private setCorsHeadersIfAllowed(reply: FastifyReply, request: FastifyRequest): void {
    const origin = request.headers?.origin;
    if (typeof origin !== "string" || !origin.trim()) return;
    const raw = this.configService.get<string>("CORS_ORIGINS")?.trim();
    if (!raw) return;
    const allowed = raw.split(",").map((o) => o.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(origin.trim().toLowerCase())) return;

    const value = origin.trim();
    const res = reply as unknown as {
      header?: (name: string, value: string) => unknown;
      raw?: { setHeader?: (name: string, value: string) => void };
      setHeader?: (name: string, value: string) => void;
    };
    if (typeof res.header === "function") {
      res.header("Access-Control-Allow-Origin", value);
      res.header("Access-Control-Allow-Credentials", "true");
    } else if (typeof res.raw?.setHeader === "function") {
      res.raw.setHeader("Access-Control-Allow-Origin", value);
      res.raw.setHeader("Access-Control-Allow-Credentials", "true");
    } else if (typeof res.setHeader === "function") {
      res.setHeader("Access-Control-Allow-Origin", value);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }

  private sendResponse(
    response: FastifyReply,
    request: FastifyRequest,
    statusCode: number,
    body: unknown
  ) {
    this.setCorsHeadersIfAllowed(response, request);
    const reply = response as unknown as {
      status?: (code: number) => { send: (payload: unknown) => unknown };
      send?: (payload: unknown) => unknown;
      raw?: {
        statusCode?: number;
        setHeader?: (key: string, value: string) => void;
        end?: (payload?: string) => void;
      };
    };
    if (reply.status && typeof reply.status === "function") {
      return reply.status(statusCode).send(body);
    }
    if (reply.send && typeof reply.send === "function") {
      return reply.send(body);
    }
    const raw = reply.raw ?? (response as unknown as typeof reply.raw);
    if (raw) {
      raw.statusCode = statusCode;
      raw.setHeader?.("content-type", "application/json");
      raw.end?.(JSON.stringify(body));
    }
    return undefined;
  }

  private isDatabaseError(exception: unknown) {
    const error = exception as { code?: string; message?: string };
    if (!error) {
      return false;
    }
    const code = (error.code ?? "").toString();
    if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "57P01", "57P02", "57P03"].includes(code)) {
      return true;
    }
    const message = (error.message ?? "").toLowerCase();
    return (
      message.includes("database") ||
      message.includes("pg") ||
      message.includes("postgres") ||
      message.includes("connection") ||
      message.includes("econnrefused")
    );
  }
}
