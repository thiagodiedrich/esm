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

    if (tenantSlugHeader) {
      await this.ensureTenantExists(tenantSlugHeader, "slug");
    }
    if (hostTenantSlug) {
      await this.ensureTenantExists(hostTenantSlug, "slug");
    }

    if (!tokenTenant && !headerTenant && !tenantSlugHeader && !hostTenantSlug) {
      throw new BadRequestException("Tenant nao informado.");
    }

    return next();
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

  private async ensureTenantExists(value: string, field: "id" | "slug") {
    const query = field === "id" ? "SELECT id FROM tenants WHERE id = $1" : "SELECT id FROM tenants WHERE slug = $1";
    const result = await this.pool.query(query, [value]);
    if ((result.rowCount ?? 0) === 0) {
      throw new BadRequestException("Code 7: Tenant nao encontrado");
    }
  }

  private async ensureOrganizationExists(value: string, tenantId: string | null) {
    const result = tenantId
      ? await this.pool.query(
          "SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2",
          [value, tenantId]
        )
      : await this.pool.query("SELECT id FROM res_organizations WHERE id = $1", [value]);
    if ((result.rowCount ?? 0) === 0) {
      throw new BadRequestException("Organizacao nao encontrada.");
    }
  }

  private async ensureWorkspaceExists(
    value: string,
    organizationId: string | null,
    tenantId: string | null
  ) {
    let result;
    if (organizationId) {
      result = await this.pool.query(
        "SELECT id FROM res_workspaces WHERE id = $1 AND organization_id = $2",
        [value, organizationId]
      );
    } else if (tenantId) {
      result = await this.pool.query(
        `SELECT rw.id
         FROM res_workspaces rw
         JOIN res_organizations ro ON ro.id = rw.organization_id
         WHERE rw.id = $1 AND ro.tenant_id = $2`,
        [value, tenantId]
      );
    } else {
      result = await this.pool.query("SELECT id FROM res_workspaces WHERE id = $1", [value]);
    }
    if ((result.rowCount ?? 0) === 0) {
      throw new BadRequestException("Workspace nao encontrado.");
    }
  }
}
