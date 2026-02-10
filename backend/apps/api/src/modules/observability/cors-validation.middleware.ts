import { BadRequestException, Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest, FastifyReply } from "fastify";

@Injectable()
export class CorsValidationMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: FastifyRequest, res: FastifyReply, next: () => void): void {
    if (this.isPreflight(req)) {
      this.sendPreflightResponse(req, res);
      return;
    }
    if (this.isPublicRoute(req)) {
      return next();
    }

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
      throw new BadRequestException("Code 0: Cors Origins inválido");
    }

    next();
  }

  private isPreflight(req: FastifyRequest): boolean {
    const method =
      String((req as { method?: string }).method ?? (req.raw as { method?: string })?.method ?? "")
        .toUpperCase();
    return method === "OPTIONS";
  }

  /**
   * Define header na resposta usando a API disponivel (Fastify reply ou Node raw).
   */
  private setHeader(
    res: FastifyReply,
    name: string,
    value: string
  ): void {
    const r = res as unknown as {
      header?: (n: string, v: string) => unknown;
      raw?: { setHeader?: (n: string, v: string) => void };
      setHeader?: (n: string, v: string) => void;
    };
    if (typeof r.header === "function") {
      r.header(name, value);
    } else if (typeof r.raw?.setHeader === "function") {
      r.raw.setHeader(name, value);
    } else if (typeof r.setHeader === "function") {
      r.setHeader(name, value);
    }
  }

  /**
   * Responde ao preflight OPTIONS com 204 e headers CORS (fallback se o hook em main.ts nao rodar).
   */
  private sendPreflightResponse(req: FastifyRequest, res: FastifyReply): void {
    const origin = req.headers.origin;
    const corsOriginsRaw = this.configService.get<string>("CORS_ORIGINS")?.trim();
    const allowedOrigins = corsOriginsRaw
      ? corsOriginsRaw.split(",").map((o) => o.trim().toLowerCase()).filter(Boolean)
      : [];
    const originAllowed =
      typeof origin === "string" &&
      origin.trim() &&
      allowedOrigins.some((o) => o === origin.trim().toLowerCase());

    if (originAllowed) {
      this.setHeader(res, "Access-Control-Allow-Origin", origin.trim());
      this.setHeader(res, "Access-Control-Allow-Credentials", "true");
    }
    this.setHeader(res, "Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    this.setHeader(
      res,
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Tenant-Id, X-Organization-Id, X-Workspace-Id, X-Tenant-Slug, X-Correlation-Id"
    );
    this.setHeader(res, "Access-Control-Max-Age", "86400");

    const reply = res as unknown as {
      status?: (code: number) => { send?: (payload?: unknown) => unknown };
      send?: (payload?: unknown) => unknown;
      raw?: { statusCode?: number; end?: (payload?: string) => void };
    };
    if (typeof reply.status === "function") {
      const sent = reply.status(204);
      if (typeof (sent as { send?: (p?: unknown) => unknown }).send === "function") {
        (sent as { send: (p?: unknown) => unknown }).send();
      }
    } else if (typeof reply.send === "function") {
      reply.send();
    } else if (reply.raw) {
      reply.raw.statusCode = 204;
      reply.raw.end?.();
    }
  }

  private isPublicRoute(req: FastifyRequest): boolean {
    const raw =
      this.configService.get<string>("API_PUBLIC_ROUTES")?.trim() ||
      process.env.API_PUBLIC_ROUTES?.trim();
    if (!raw) return false;
    const path = this.normalizePath(
      (req as { url?: string; routerPath?: string }).url ??
        (req as { routerPath?: string }).routerPath ??
        (req.raw as { url?: string } | undefined)?.url ??
        ""
    );
    const prefixes = raw.split(",").map((p) => this.normalizePath(p.trim())).filter(Boolean);
    return prefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
  }

  private normalizePath(p: string): string {
    const path = (p ?? "").split("?")[0].trim() || "/";
    const withSlash = path.startsWith("/") ? path : "/" + path;
    return withSlash.endsWith("/") && withSlash.length > 1 ? withSlash.slice(0, -1) : withSlash;
  }
}
