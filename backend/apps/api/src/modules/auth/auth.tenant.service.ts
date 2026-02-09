import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

export interface TenantRecord {
  id: number;
  uuid: string;
  slug: string;
}

@Injectable()
export class AuthTenantService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(PG_POOL) private readonly pool: Pool
  ) {}

  async resolveTenantOrFail(request?: FastifyRequest): Promise<TenantRecord> {
    const multiTenantEnabled =
      (this.configService.get<string>("MULTI_TENANT_ENABLED") ?? "false").toLowerCase() === "true";

    if (multiTenantEnabled) {
      return this.resolveMultiTenant(request);
    }

    const defaultTenantEnabled =
      (this.configService.get<string>("TENANT_DEFAULT_ENABLED") ?? "false").toLowerCase() === "true";

    if (defaultTenantEnabled) {
      return this.resolveDefaultTenant();
    }

    return this.resolveTenantFromRequest(request);
  }

  private async resolveMultiTenant(request?: FastifyRequest): Promise<TenantRecord> {
    const tenantId = this.getTenantIdFromHeader(request);
    if (tenantId) {
      const tenant = await this.findTenantById(tenantId);
      if (tenant) return tenant;
    }

    const tenantSlug = this.getTenantSlugFromHeader(request);
    if (tenantSlug) {
      const tenant = await this.findTenantBySlug(tenantSlug);
      if (tenant) return tenant;
    }

    const hostSlug = this.extractTenantSlugFromHost(request);
    if (hostSlug) {
      const tenant = await this.findTenantBySlug(hostSlug);
      if (tenant) return tenant;
    }

    throw new BadRequestException("Code 1: Tenant não encontrado");
  }

  private async resolveDefaultTenant(): Promise<TenantRecord> {
    const defaultTenantId = this.configService.get<string>("TENANT_DEFAULT_ID")?.trim();
    const defaultTenantSlug = this.configService.get<string>("TENANT_DEFAULT_SLUG")?.trim();

    if (defaultTenantId) {
      const tenant = await this.findTenantById(defaultTenantId);
      if (tenant) return tenant;
    }

    if (defaultTenantSlug) {
      const tenant = await this.findTenantBySlug(defaultTenantSlug);
      if (tenant) return tenant;
    }

    throw new BadRequestException("Code 2: Tenant padrão não encontrado");
  }

  private async resolveTenantFromRequest(request?: FastifyRequest): Promise<TenantRecord> {
    const tenantId = this.getTenantIdFromHeader(request);
    if (tenantId) {
      const tenant = await this.findTenantById(tenantId);
      if (tenant) return tenant;
    }

    const tenantSlug = this.getTenantSlugFromHeader(request);
    if (tenantSlug) {
      const tenant = await this.findTenantBySlug(tenantSlug);
      if (tenant) return tenant;
    }

    const hostSlug = this.extractTenantSlugFromHost(request);
    if (hostSlug) {
      const tenant = await this.findTenantBySlug(hostSlug);
      if (tenant) return tenant;
    }

    throw new BadRequestException("Code 3: Tenant não encontrado");
  }

  private getTenantIdFromHeader(request?: FastifyRequest): string | undefined {
    const header =
      (this.configService.get<string>("TENANT_HEADER") ?? "x-tenant-id").toLowerCase();
    const value = request?.headers?.[header];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private getTenantSlugFromHeader(request?: FastifyRequest): string | undefined {
    const value = request?.headers?.["x-tenant-slug"];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private extractTenantSlugFromHost(request?: FastifyRequest): string | undefined {
    const hostHeader = request?.headers?.host;
    if (!hostHeader) return undefined;

    const host = hostHeader.split(":")[0];
    if (!host) return undefined;

    const normalizedHost = host.trim().toLowerCase();
    if (normalizedHost === "localhost") return undefined;
    if (!normalizedHost.includes(".")) return undefined;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost)) return undefined;

    const [subdomain] = host.split(".");
    return subdomain?.trim() || undefined;
  }

  private async findTenantById(idOrUuid: string): Promise<TenantRecord | null> {
    const isNumericId = /^\d+$/.test(idOrUuid.trim());
    const result = await this.pool.query<{ id: number; uuid: string; slug: string }>(
      isNumericId
        ? "SELECT id, uuid, slug FROM tenants WHERE id = $1"
        : "SELECT id, uuid, slug FROM tenants WHERE uuid = $1",
      [isNumericId ? parseInt(idOrUuid, 10) : idOrUuid]
    );
    return result.rowCount && result.rowCount > 0 ? result.rows[0] : null;
  }

  private async findTenantBySlug(slug: string): Promise<TenantRecord | null> {
    const result = await this.pool.query<{ id: number; uuid: string; slug: string }>(
      "SELECT id, uuid, slug FROM tenants WHERE slug = $1",
      [slug]
    );
    return result.rowCount && result.rowCount > 0 ? result.rows[0] : null;
  }

  extractTenantSlug(request?: FastifyRequest): string | undefined {
    const headerSlug = this.getTenantSlugFromHeader(request);
    if (headerSlug) return headerSlug;
    return this.extractTenantSlugFromHost(request);
  }
}
