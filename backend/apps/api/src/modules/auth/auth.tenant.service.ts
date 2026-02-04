import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

export interface TenantRecord {
  id: string;
  slug: string;
}

@Injectable()
export class AuthTenantService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(PG_POOL) private readonly pool: Pool
  ) {}

  async resolveTenantOrFail(request?: FastifyRequest): Promise<TenantRecord> {
    const tenantHeader =
      (this.configService.get<string>("TENANT_HEADER") ?? "x-tenant-id").toLowerCase();
    const tenantIdHeader = request?.headers?.[tenantHeader];
    if (typeof tenantIdHeader === "string" && tenantIdHeader.trim()) {
      const result = await this.pool.query<TenantRecord>(
        "SELECT id, slug FROM tenants WHERE id = $1",
        [tenantIdHeader.trim()]
      );
      if (result.rowCount === 0) {
        throw new BadRequestException("Tenant nao encontrado.");
      }
      return result.rows[0];
    }

    const tenantSlug = this.extractTenantSlug(request);
    if (tenantSlug) {
      const result = await this.pool.query<TenantRecord>(
        "SELECT id, slug FROM tenants WHERE slug = $1",
        [tenantSlug]
      );
      if (result.rowCount === 0) {
        throw new BadRequestException("Tenant nao encontrado.");
      }
      return result.rows[0];
    }

    const multiTenantEnabled =
      (this.configService.get<string>("MULTI_TENANT_ENABLED") ?? "false").toLowerCase() ===
      "true";
    const defaultTenantEnabled =
      (this.configService.get<string>("TENANT_DEFAULT_ENABLED") ?? "false").toLowerCase() ===
      "true";

    if (!multiTenantEnabled && defaultTenantEnabled) {
      const defaultTenantId = this.configService.get<string>("TENANT_DEFAULT_ID")?.trim();
      if (!defaultTenantId) {
        throw new BadRequestException("TENANT_DEFAULT_ID nao configurado.");
      }
      const result = await this.pool.query<TenantRecord>(
        "SELECT id, slug FROM tenants WHERE id = $1",
        [defaultTenantId]
      );
      if (result.rowCount === 0) {
        throw new BadRequestException("Tenant nao encontrado.");
      }
      return result.rows[0];
    }

    throw new BadRequestException("Tenant nao identificado.");
  }

  extractTenantSlug(request?: FastifyRequest): string | undefined {
    const headerSlug = request?.headers["x-tenant-slug"];
    if (typeof headerSlug === "string" && headerSlug.trim()) {
      return headerSlug.trim();
    }

    const hostHeader = request?.headers.host;
    if (!hostHeader) {
      return undefined;
    }

    const host = hostHeader.split(":")[0];
    if (!host) {
      return undefined;
    }

    const normalizedHost = host.trim().toLowerCase();
    if (normalizedHost === "localhost") {
      return undefined;
    }
    if (!normalizedHost.includes(".")) {
      return undefined;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost)) {
      return undefined;
    }

    const [subdomain] = host.split(".");
    return subdomain?.trim() || undefined;
  }
}
