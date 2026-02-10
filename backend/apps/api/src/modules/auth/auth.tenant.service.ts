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

    const hostCandidates = this.getHostCandidatesForDomain(request);
    if (hostCandidates?.length) {
      const tenant = await this.findTenantByDomain(hostCandidates);
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

    const hostCandidates = this.getHostCandidatesForDomain(request);
    if (hostCandidates?.length) {
      const tenant = await this.findTenantByDomain(hostCandidates);
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

  /** Candidatos para match por domain: host completo (com porta), hostname (sem porta), subdominio se houver. */
  private getHostCandidatesForDomain(request?: FastifyRequest): string[] | undefined {
    const hostHeader = request?.headers?.host;
    if (!hostHeader || typeof hostHeader !== "string") return undefined;
    const raw = hostHeader.trim();
    if (!raw) return undefined;
    const hostname = raw.split(":")[0].trim();
    const parts = hostname.split(".");
    const subdomain = parts.length > 1 ? parts[0].trim() : undefined;
    const candidates = [raw, hostname];
    if (subdomain && !candidates.includes(subdomain)) candidates.push(subdomain);
    return candidates.length > 0 ? candidates : undefined;
  }

  /** Busca tenant cujo campo domain (lista separada por virgula) contem um dos candidatos. */
  private async findTenantByDomain(hostCandidates: string[]): Promise<TenantRecord | null> {
    for (const candidate of hostCandidates) {
      const normalized = candidate.toLowerCase().trim();
      if (!normalized) continue;
      const result = await this.pool.query<{ id: number; uuid: string; slug: string }>(
        `SELECT id, uuid, slug FROM tenants
         WHERE domain IS NOT NULL AND domain != ''
         AND EXISTS (
           SELECT 1 FROM unnest(string_to_array(trim(domain), ',')) AS d(v)
           WHERE lower(trim(d.v)) = $1
         )
         LIMIT 1`,
        [normalized]
      );
      if (result.rowCount && result.rowCount > 0) return result.rows[0];
    }
    return null;
  }

  extractTenantSlug(request?: FastifyRequest): string | undefined {
    const headerSlug = this.getTenantSlugFromHeader(request);
    if (headerSlug) return headerSlug;
    return this.extractTenantSlugFromHost(request);
  }
}
