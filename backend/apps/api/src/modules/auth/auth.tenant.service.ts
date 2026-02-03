import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

export interface TenantRecord {
  id: string;
  slug: string;
}

@Injectable()
export class AuthTenantService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async resolveTenantOrFail(request?: FastifyRequest): Promise<TenantRecord> {
    const tenantSlug = this.extractTenantSlug(request);
    if (!tenantSlug) {
      throw new BadRequestException("Tenant nao identificado.");
    }

    const result = await this.pool.query<TenantRecord>(
      "SELECT id, slug FROM tenants WHERE slug = $1",
      [tenantSlug]
    );

    if (result.rowCount === 0) {
      throw new BadRequestException("Tenant nao encontrado.");
    }

    return result.rows[0];
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

    const [subdomain] = host.split(".");
    return subdomain?.trim() || undefined;
  }
}
