import { BadRequestException, Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest, FastifyReply } from "fastify";
import { RequestContextService } from "../observability/request-context.service";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly requestContext: RequestContextService,
    @Inject(PG_POOL) private readonly pool: Pool
  ) {}

  async use(req: FastifyRequest, _res: FastifyReply, next: () => void) {
    if (this.isPreflight(req)) {
      return next();
    }
    if (this.isPublicRoute(req)) {
      return next();
    }

    const enabled =
      (this.configService.get<string>("MULTI_TENANT_ENABLED") ?? "false").toLowerCase() === "true";
    if (!enabled) {
      return next();
    }

    const tenantHeader =
      (this.configService.get<string>("TENANT_HEADER") ?? "x-tenant-id").toLowerCase();
    const organizationHeader =
      (this.configService.get<string>("ORGANIZATION_HEADER") ?? "x-organization-id").toLowerCase();
    const workspaceHeader =
      (this.configService.get<string>("WORKSPACE_HEADER") ?? "x-workspace-id").toLowerCase();

    const headerTenant = this.getHeaderValue(req, tenantHeader);
    const headerOrganization = this.getHeaderValue(req, organizationHeader);
    const headerWorkspace = this.getHeaderValue(req, workspaceHeader);

    const tokenTenant = req.user?.tenant_id;
    const tokenOrganization = req.user?.organization_id;
    const tokenWorkspace = req.user?.workspace_id ?? undefined;

    if (req.user?.auth_type === "user") {
      if (!tokenTenant) {
        throw new BadRequestException("Tenant ausente no token.");
      }
      if (headerTenant && headerTenant !== tokenTenant) {
        throw new BadRequestException("Tenant do header nao corresponde ao token.");
      }
      if (headerOrganization && !tokenOrganization) {
        throw new BadRequestException("Organizacao ausente no token.");
      }
      if (headerOrganization && headerOrganization !== tokenOrganization) {
        throw new BadRequestException("Organizacao do header nao corresponde ao token.");
      }
      if (headerWorkspace && !tokenWorkspace) {
        throw new BadRequestException("Workspace ausente no token.");
      }
      if (headerWorkspace && headerWorkspace !== tokenWorkspace) {
        throw new BadRequestException("Workspace do header nao corresponde ao token.");
      }
    }

    if (headerTenant || headerOrganization || headerWorkspace) {
      if (headerTenant) {
        await this.ensureTenantExists(headerTenant, "id");
      }
      if (headerOrganization) {
        await this.ensureOrganizationExists(headerOrganization, headerTenant ?? tokenTenant ?? null);
      }
      if (headerWorkspace) {
        const orgId = headerOrganization ?? tokenOrganization ?? null;
        const tenantId = headerTenant ?? tokenTenant ?? null;
        await this.ensureWorkspaceExists(headerWorkspace, orgId, tenantId);
      }
      this.requestContext.updateUserContext({
        tenantId: headerTenant ?? undefined,
        organizationId: headerOrganization ?? undefined,
        workspaceId: headerWorkspace ?? undefined
      });
    }

    const tenantSlugHeader = this.getHeaderValue(req, "x-tenant-slug");
    const hostTenantSlug = this.extractTenantFromHost(req);
    const hostForDomain = this.getHostForDomain(req);

    let tenantResolved = false;

    if (tenantSlugHeader) {
      try {
        await this.ensureTenantExists(tenantSlugHeader, "slug");
        tenantResolved = true;
      } catch {
        if (hostForDomain) {
          try {
            await this.ensureTenantByDomain(hostForDomain);
            tenantResolved = true;
          } catch {
            throw new BadRequestException("Code 7: Tenant nao encontrado");
          }
        } else {
          throw new BadRequestException("Code 7: Tenant nao encontrado");
        }
      }
    }
    if (!tenantResolved && hostTenantSlug) {
      try {
        await this.ensureTenantExists(hostTenantSlug, "slug");
        tenantResolved = true;
      } catch {
        if (hostForDomain) {
          try {
            await this.ensureTenantByDomain(hostForDomain);
            tenantResolved = true;
          } catch {
            throw new BadRequestException("Code 7: Tenant nao encontrado");
          }
        } else {
          throw new BadRequestException("Code 7: Tenant nao encontrado");
        }
      }
    }
    if (!tenantResolved && hostForDomain?.length) {
      await this.ensureTenantByDomain(hostForDomain);
      tenantResolved = true;
    }

    if (!tokenTenant && !headerTenant && !tenantResolved) {
      throw new BadRequestException("Tenant nao informado.");
    }

    return next();
  }

  private isPreflight(req: FastifyRequest): boolean {
    const method =
      String((req as { method?: string }).method ?? (req.raw as { method?: string })?.method ?? "")
        .toUpperCase();
    return method === "OPTIONS";
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

  private getHeaderValue(req: FastifyRequest, headerName: string) {
    const value = req.headers[headerName];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    return undefined;
  }

  private extractTenantFromHost(req: FastifyRequest) {
    const hostHeader = req.headers.host;
    if (!hostHeader) {
      return undefined;
    }
    const host = hostHeader.split(":")[0];
    const [subdomain] = host.split(".");
    return subdomain?.trim() || undefined;
  }

  /** Retorna candidatos para match por domain: host completo (com porta), hostname (sem porta), subdominio se houver. */
  private getHostForDomain(req: FastifyRequest): string[] | undefined {
    const hostHeader = req.headers.host;
    if (!hostHeader || typeof hostHeader !== "string") {
      return undefined;
    }
    const raw = hostHeader.trim();
    if (!raw) return undefined;
    const hostname = raw.split(":")[0].trim();
    const parts = hostname.split(".");
    const subdomain = parts.length > 1 ? parts[0].trim() : undefined;
    const candidates = [raw, hostname];
    if (subdomain && !candidates.includes(subdomain)) {
      candidates.push(subdomain);
    }
    return candidates.length > 0 ? candidates : undefined;
  }

  /** Garante que existe um tenant cujo campo domain (lista separada por virgula) contem um dos candidatos. */
  private async ensureTenantByDomain(hostCandidates: string[]) {
    if (hostCandidates.length === 0) {
      throw new BadRequestException("Code 7: Tenant nao encontrado");
    }
    for (const candidate of hostCandidates) {
      const normalized = candidate.toLowerCase().trim();
      if (!normalized) continue;
      const result = await this.pool.query<{ id: number }>(
        `SELECT id FROM tenants
         WHERE domain IS NOT NULL AND domain != ''
         AND EXISTS (
           SELECT 1 FROM unnest(string_to_array(trim(both from domain), ',')) AS d(v)
           WHERE lower(trim(d.v)) = $1
         )
         LIMIT 1`,
        [normalized]
      );
      if ((result.rowCount ?? 0) > 0) {
        return;
      }
    }
    throw new BadRequestException("Code 7: Tenant nao encontrado");
  }

  private async ensureTenantExists(value: string, field: "id" | "slug") {
    const query = field === "id" ? "SELECT id FROM tenants WHERE uuid = $1" : "SELECT id FROM tenants WHERE slug = $1";
    const result = await this.pool.query(query, [value]);
    if ((result.rowCount ?? 0) === 0) {
      throw new BadRequestException("Code 7: Tenant nao encontrado");
    }
  }

  private async ensureOrganizationExists(value: string, tenantUuid: string | null) {
    const result = tenantUuid
      ? await this.pool.query(
          `SELECT o.id FROM res_organizations o
           JOIN tenants t ON t.id = o.tenant_id
           WHERE o.uuid = $1 AND t.uuid = $2`,
          [value, tenantUuid]
        )
      : await this.pool.query("SELECT id FROM res_organizations WHERE uuid = $1", [value]);
    if ((result.rowCount ?? 0) === 0) {
      throw new BadRequestException("Organizacao nao encontrada.");
    }
  }

  private async ensureWorkspaceExists(
    value: string,
    organizationUuid: string | null,
    tenantUuid: string | null
  ) {
    let result;
    if (organizationUuid) {
      result = await this.pool.query(
        `SELECT w.id FROM res_workspaces w
         JOIN res_organizations o ON o.id = w.organization_id
         WHERE w.uuid = $1 AND o.uuid = $2`,
        [value, organizationUuid]
      );
    } else if (tenantUuid) {
      result = await this.pool.query(
        `SELECT w.id FROM res_workspaces w
         JOIN res_organizations o ON o.id = w.organization_id
         JOIN tenants t ON t.id = o.tenant_id
         WHERE w.uuid = $1 AND t.uuid = $2`,
        [value, tenantUuid]
      );
    } else {
      result = await this.pool.query("SELECT id FROM res_workspaces WHERE uuid = $1", [value]);
    }
    if ((result.rowCount ?? 0) === 0) {
      throw new BadRequestException("Workspace nao encontrado.");
    }
  }
}
