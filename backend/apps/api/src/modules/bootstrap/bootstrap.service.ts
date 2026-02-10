import { BadRequestException, Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { resolveUuidToId } from "../database/uuid-resolver";
import { BrandingService } from "../branding/branding.service";
import { StorageService } from "../storage/storage.service";
import { PG_POOL } from "../database/database.module";

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);
  private bootstrapRetryTimer: NodeJS.Timeout | null = null;
  private readonly bootstrapRetryMs = 10_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly brandingService: BrandingService,
    private readonly storageService: StorageService,
    @Inject(PG_POOL) private readonly pool: Pool
  ) {}

  async onApplicationBootstrap() {
    this.logWhiteLabelDefaults();
    this.logStorageConfig();
    try {
      await this.runBootstrapTasks();
    } catch (error) {
      this.logger.warn(
        `Bootstrap pendente: ${(error as Error).message}. Nova tentativa em ${this.bootstrapRetryMs / 1000}s.`
      );
      this.scheduleBootstrapRetry();
    }
  }

  private async runBootstrapTasks() {
    await this.bootstrapDefaultPlan();
    await this.bootstrapMasterAdmin();
  }

  private scheduleBootstrapRetry() {
    if (this.bootstrapRetryTimer) {
      return;
    }
    this.bootstrapRetryTimer = setTimeout(async () => {
      this.bootstrapRetryTimer = null;
      try {
        await this.runBootstrapTasks();
        this.logger.log("Bootstrap concluido apos reconexao.");
      } catch (error) {
        this.logger.warn(
          `Bootstrap ainda pendente: ${(error as Error).message}. Nova tentativa em ${this.bootstrapRetryMs / 1000}s.`
        );
        this.scheduleBootstrapRetry();
      }
    }, this.bootstrapRetryMs);
  }

  private logWhiteLabelDefaults() {
    const defaults = this.brandingService.getWhiteLabelDefaults();
    if (!defaults.enabled) {
      return;
    }

    this.logger.log(
      `White-label habilitado. App=${defaults.appName ?? "n/a"} Domain=${
        defaults.domain ?? "n/a"
      }`
    );
  }

  private logStorageConfig() {
    const storage = this.storageService.getConfig();
    if (storage.type === "minio") {
      this.logger.log(
        `Storage minio configurado. Endpoint=${storage.minio.endpoint ?? "n/a"} Bucket=${
          storage.minio.bucket ?? "n/a"
        }`
      );
      return;
    }
    if (storage.type === "local") {
      this.logger.log(`Storage local configurado. Path=${storage.localPath ?? "n/a"}`);
    }
  }

  private async bootstrapMasterAdmin() {
    const enabled =
      (this.configService.get<string>("TENANT_MASTER_ADMIN_ENABLED") ?? "false").toLowerCase() ===
      "true";
    if (!enabled) {
      return;
    }

    const defaults = await this.getTenantDefaultsAsync();
    if (!defaults) {
      return;
    }

    const name = this.configService.get<string>("TENANT_MASTER_ADMIN_NAME") ?? "Admin";
    const username = this.configService.get<string>("TENANT_MASTER_ADMIN_USERNAME") ?? "";
    const password = this.configService.get<string>("TENANT_MASTER_ADMIN_PASSWORD") ?? "";
    const email = this.configService.get<string>("TENANT_MASTER_ADMIN_EMAIL") ?? "";

    const masterAdminTenantId =
      this.parseUuid(this.configService.get<string>("TENANT_MASTER_ADMIN_TENANT_ID"));
    const tenantId = masterAdminTenantId ?? defaults.tenantId;
    const organizationId =
      this.parseUuid(this.configService.get<string>("TENANT_MASTER_ADMIN_ORGANIZATION_ID")) ??
      defaults.organizationId;
    const workspaceId =
      this.parseUuid(this.configService.get<string>("TENANT_MASTER_ADMIN_WORKSPACE_ID")) ??
      defaults.workspaceId;
    const roleIds = this.parseRoleIds(
      this.configService.get<string>("TENANT_MASTER_ADMIN_ROLE") ?? "[]"
    );

    if (!password || !email) {
      this.logger.warn("Bootstrap admin ignorado: email/senha nao definidos.");
      return;
    }

    let transactionOpen = false;
    try {
      await this.pool.query("BEGIN");
      transactionOpen = true;

      // 1 - cria o tenant (se nao existir)
      const { id: resolvedTenantId, created: tenantCreated } = await this.ensureTenant(
        tenantId,
        defaults.tenantName,
        defaults.tenantSlug
      );

      // 2 - cria a organization
      const resolvedOrgId = await this.ensureOrganization(organizationId, resolvedTenantId, defaults.organizationName);

      // 3 - cria o partner da organization
      const orgPartnerId = await this.ensureOrgPartner(
        defaults.organizationName,
        resolvedTenantId,
        resolvedOrgId
      );
      await this.pool.query(
        "UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1",
        [resolvedOrgId, orgPartnerId]
      );

      // 4 - cria o workspace
      await this.ensureWorkspace(
        workspaceId,
        resolvedTenantId,
        resolvedOrgId,
        defaults.workspaceName
      );

      if (tenantCreated) {
        await this.pool.query(
          "UPDATE tenants SET is_super_tenant = true, updated_at = now() WHERE id = $1",
          [resolvedTenantId]
        );
      }

      const userExists = await this.pool.query<{ id: number }>(
        "SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)",
        [resolvedTenantId, email]
      );
      if ((userExists.rowCount ?? 0) > 0) {
        await this.pool.query("COMMIT");
        this.logger.log("Bootstrap admin: usuario ja existe; nenhuma alteracao aplicada.");
        return;
      }

      // 5 - cria o user (partner_id NULL inicialmente)
      const hashedPassword = await bcrypt.hash(password, 12);
      await this.pool.query(
        `INSERT INTO res_users
         (tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, TRUE, TRUE, TRUE, $4, now(), now())`,
        [resolvedTenantId, email, hashedPassword, resolvedOrgId]
      );

      // 6 - cria o partner do user e vincula
      const userPartnerId = await this.ensureUserPartner(
        name || username || email,
        email,
        resolvedTenantId,
        resolvedOrgId
      );
      await this.pool.query(
        "UPDATE res_users SET partner_id = $2, updated_at = now() WHERE tenant_id = $1 AND LOWER(email) = LOWER($3)",
        [resolvedTenantId, userPartnerId, email]
      );
      const userResult = await this.pool.query<{ id: number }>(
        "SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)",
        [resolvedTenantId, email]
      );
      const userId = userResult.rows[0].id;

      await this.applyRoles(userId, resolvedTenantId, roleIds);
      await this.pool.query("COMMIT");
      transactionOpen = false;

      this.logger.log("Bootstrap admin criado com sucesso.");
    } catch (error) {
      if (transactionOpen) {
        await this.pool.query("ROLLBACK");
      }
      this.logger.warn(`Bootstrap admin falhou: ${(error as Error).message}`);
      throw error;
    }
  }

  private async bootstrapDefaultPlan() {
    const enabled =
      (this.configService.get<string>("DEFAULT_PLAN_BOOTSTRAP_ENABLED") ?? "false").toLowerCase() ===
      "true";
    if (!enabled) {
      return;
    }

    const code = this.configService.get<string>("DEFAULT_PLAN_CODE") ?? "";
    const name = this.configService.get<string>("DEFAULT_PLAN_NAME") ?? "";
    if (!code || !name) {
      this.logger.warn("DEFAULT_PLAN_* nao definido; bootstrap de plano ignorado.");
      return;
    }

    try {
      const existing = await this.pool.query("SELECT id FROM platform_plans WHERE code = $1", [
        code
      ]);
      if ((existing.rowCount ?? 0) > 0) {
        return;
      }

      const description = this.buildPlanDescription();
      await this.pool.query(
        `INSERT INTO platform_plans (code, name, description, created_at)
         VALUES ($1, $2, $3, now())`,
        [code, name, description]
      );

      this.logger.log(`Plano default criado: ${code}`);
    } catch (error) {
      this.logger.warn(`Bootstrap de plano falhou: ${(error as Error).message}`);
      throw error;
    }
  }

  private buildPlanDescription() {
    const payload = {
      items_per_day: this.configService.get<string>("DEFAULT_PLAN_ITEMS_PER_DAY") || null,
      sensors_per_day: this.configService.get<string>("DEFAULT_PLAN_SENSORS_PER_DAY") || null,
      bytes_per_day: this.configService.get<string>("DEFAULT_PLAN_BYTES_PER_DAY") || null,
      alert_delay_seconds: this.configService.get<string>("DEFAULT_PLAN_ALERT_DELAY_SECONDS") || null,
      quota_enabled: this.configService.get<string>("QUOTA_ENABLED") === "true",
      quota_enforce: this.configService.get<string>("QUOTA_ENFORCE") === "true",
      quota_estimate_bytes: this.configService.get<string>("QUOTA_ESTIMATE_BYTES") === "true",
      billing_events_enabled: this.configService.get<string>("BILLING_EVENTS_ENABLED") === "true"
    };
    return JSON.stringify(payload);
  }

  private parseUuid(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(trimmed) ? trimmed : null;
  }

  private parseRoleIds(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item) => typeof item === "string" && this.parseUuid(item));
    } catch {
      return [];
    }
  }

  private async ensureTenant(tenantUuid: string, name: string, slug: string): Promise<{ id: number; created: boolean }> {
    const existsByUuid = await this.pool.query<{ id: number }>("SELECT id FROM tenants WHERE uuid = $1", [
      tenantUuid
    ]);
    if ((existsByUuid.rowCount ?? 0) > 0) {
      return { id: existsByUuid.rows[0].id, created: false };
    }

    const existsBySlug = await this.pool.query<{ id: number }>(
      "SELECT id FROM tenants WHERE slug = $1",
      [slug]
    );
    if ((existsBySlug.rowCount ?? 0) > 0) {
      return { id: existsBySlug.rows[0].id, created: false };
    }

    const defaultDomain =
      this.configService.get<string>("TENANT_DEFAULT_DOMAIN")?.trim() ||
      undefined;

    const result = await this.pool.query<{ id: number }>(
      `INSERT INTO tenants
       (name, slug, db_strategy, migration_status, domain, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (slug) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [name, slug, "shared", "idle", defaultDomain ?? null]
    );
    return { id: result.rows[0].id, created: true };
  }

  private async ensureOrganization(organizationUuid: string, tenantId: number, name: string): Promise<number> {
    const exists = await this.pool.query<{ id: number }>("SELECT id FROM res_organizations WHERE uuid = $1", [
      organizationUuid
    ]);
    if ((exists.rowCount ?? 0) > 0) {
      return exists.rows[0].id;
    }

    const result = await this.pool.query<{ id: number }>(
      `INSERT INTO res_organizations
       (uuid, tenant_id, partner_id, name, is_default, created_at, updated_at)
       VALUES ($1, $2, NULL, $3, TRUE, now(), now())
       RETURNING id`,
      [organizationUuid, tenantId, name]
    );
    return result.rows[0].id;
  }

  private async ensureWorkspace(
    workspaceUuid: string,
    tenantId: number,
    organizationId: number,
    name: string
  ) {
    const exists = await this.pool.query("SELECT id FROM res_workspaces WHERE uuid = $1", [
      workspaceUuid
    ]);
    if ((exists.rowCount ?? 0) > 0) {
      return;
    }

    await this.pool.query(
      `INSERT INTO res_workspaces
       (uuid, tenant_id, organization_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())`,
      [workspaceUuid, tenantId, organizationId, name]
    );
  }

  private async ensureOrgPartner(
    orgName: string,
    tenantId: number,
    organizationId: number
  ): Promise<number> {
    const orgHasPartner = await this.pool.query<{ partner_id: number }>(
      "SELECT partner_id FROM res_organizations WHERE id = $1 AND partner_id IS NOT NULL",
      [organizationId]
    );
    if ((orgHasPartner.rowCount ?? 0) > 0 && orgHasPartner.rows[0].partner_id) {
      return orgHasPartner.rows[0].partner_id;
    }

    const existing = await this.pool.query<{ id: number }>(
      "SELECT id FROM res_partners WHERE tenant_id = $1 AND organization_id = $2 AND email IS NULL LIMIT 1",
      [tenantId, organizationId]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return existing.rows[0].id;
    }

    const result = await this.pool.query<{ id: number }>(
      `INSERT INTO res_partners
       (tenant_id, organization_id, name, email, created_at, updated_at)
       VALUES ($1, $2, $3, NULL, now(), now())
       RETURNING id`,
      [tenantId, organizationId, orgName]
    );
    return result.rows[0].id;
  }

  private async ensureUserPartner(
    name: string,
    email: string,
    tenantId: number,
    organizationId: number
  ): Promise<number> {
    const existing = await this.pool.query<{ id: number }>(
      "SELECT id FROM res_partners WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)",
      [tenantId, email]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return existing.rows[0].id;
    }

    const result = await this.pool.query<{ id: number }>(
      `INSERT INTO res_partners
       (tenant_id, organization_id, name, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id`,
      [tenantId, organizationId, name, email]
    );
    return result.rows[0].id;
  }

  private async applyRoles(userId: number, tenantId: number, roleUuids: string[]) {
    if (roleUuids.length === 0) {
      if (this.configService.get<string>("TENANT_MASTER_ADMIN_ROLE")) {
        this.logger.warn("TENANT_MASTER_ADMIN_ROLE invalido ou vazio; roles ignoradas.");
      }
      return;
    }

    for (const roleUuid of roleUuids) {
      const roleId = await resolveUuidToId(this.pool, "res_roles", roleUuid);
      if (!roleId) continue;
      await this.pool.query(
        `INSERT INTO res_user_roles
         (user_id, role_id, scope_type, scope_id, created_at)
         VALUES ($1, $2, $3, $4, now())`,
        [userId, roleId, "tenant", tenantId]
      );
    }
  }

  private async getTenantDefaultsAsync(): Promise<{
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    organizationId: string;
    workspaceId: string;
    organizationName: string;
    workspaceName: string;
  } | null> {
    const defaultSlug = this.configService.get<string>("TENANT_DEFAULT_SLUG")?.trim() ?? "default-tenant";
    const defaultName = this.configService.get<string>("TENANT_DEFAULT_NAME") ?? "Default Tenant";

    const rawTenantId = this.configService.get<string>("TENANT_DEFAULT_ID")?.trim();
    const parsedTenantId = this.parseUuid(rawTenantId);

    // 2 - procura por tenant_default_id OU tenant_default_slug; se encontrar algum, retorna
    // com org/workspace REAIS do banco (evita duplicacao ao reiniciar)
    if (parsedTenantId) {
      const byUuid = await this.pool.query<{ id: number; uuid: string; slug: string; name: string | null }>(
        "SELECT id, uuid, slug, name FROM tenants WHERE uuid = $1",
        [parsedTenantId]
      );
      if ((byUuid.rowCount ?? 0) > 0) {
        const row = byUuid.rows[0];
        const existing = await this.getExistingOrgWorkspaceForTenant(row.id);
        return this.buildTenantDefaults(row.uuid, row.slug, row.name ?? defaultName, existing);
      }
    }

    if (defaultSlug) {
      const bySlug = await this.pool.query<{ id: number; uuid: string; slug: string; name: string | null }>(
        "SELECT id, uuid, slug, name FROM tenants WHERE slug = $1",
        [defaultSlug]
      );
      if ((bySlug.rowCount ?? 0) > 0) {
        const row = bySlug.rows[0];
        const existing = await this.getExistingOrgWorkspaceForTenant(row.id);
        return this.buildTenantDefaults(row.uuid, row.slug, row.name ?? defaultName, existing);
      }
    }

    // 1 - tenant_default_enabled = true E tenant_master_admin_enabled = true
    const defaultTenantEnabled =
      (this.configService.get<string>("TENANT_DEFAULT_ENABLED") ?? "false").toLowerCase() === "true";
    const masterAdminEnabled =
      (this.configService.get<string>("TENANT_MASTER_ADMIN_ENABLED") ?? "false").toLowerCase() ===
      "true";
    if (!defaultTenantEnabled || !masterAdminEnabled) {
      return null;
    }

    // 3 - nao existe tenant com is_super_tenant = true (todos tem is_super_tenant = false ou nao ha tenants)
    const superTenantExists = await this.pool.query<{ uuid: string }>(
      "SELECT uuid FROM tenants WHERE is_super_tenant = true LIMIT 1"
    );
    if ((superTenantExists.rowCount ?? 0) > 0) {
      throw new BadRequestException("Code 4: Tenant padrao invalido");
    }

    // Condicoes 1, 2 e 3 atendidas: entra no fluxo de criacao do INSERT
    const tenantId = parsedTenantId ?? randomUUID();
    if (!parsedTenantId && rawTenantId) {
      this.logger.warn(`TENANT_DEFAULT_ID invalido (${rawTenantId}); usando ${tenantId}.`);
    }

    return this.buildTenantDefaults(tenantId, defaultSlug, defaultName);
  }

  private async getExistingOrgWorkspaceForTenant(tenantId: number): Promise<{
    organizationId: string;
    workspaceId: string;
  } | null> {
    const orgResult = await this.pool.query<{ uuid: string }>(
      `SELECT uuid FROM res_organizations
       WHERE tenant_id = $1
       ORDER BY (CASE WHEN is_default = true THEN 0 ELSE 1 END), created_at ASC
       LIMIT 1`,
      [tenantId]
    );
    if ((orgResult.rowCount ?? 0) === 0) return null;
    const orgUuid = orgResult.rows[0].uuid;
    const orgIdResult = await this.pool.query<{ id: number }>(
      "SELECT id FROM res_organizations WHERE uuid = $1",
      [orgUuid]
    );
    const orgId = orgIdResult.rows[0]?.id;
    if (!orgId) return { organizationId: orgUuid, workspaceId: randomUUID() };

    const wsResult = await this.pool.query<{ uuid: string }>(
      `SELECT uuid FROM res_workspaces
       WHERE organization_id = $1
       ORDER BY created_at ASC LIMIT 1`,
      [orgId]
    );
    const workspaceId = (wsResult.rowCount ?? 0) > 0 ? wsResult.rows[0].uuid : randomUUID();
    return { organizationId: orgUuid, workspaceId };
  }

  private buildTenantDefaults(
    tenantId: string,
    tenantSlug: string,
    tenantName: string,
    existingOrgWorkspace?: { organizationId: string; workspaceId: string } | null
  ): {
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    organizationId: string;
    workspaceId: string;
    organizationName: string;
    workspaceName: string;
  } {
    const orgName =
      this.configService.get<string>("TENANT_DEFAULT_ORGANIZATION_NAME") ?? "Default Organization";
    const wsName =
      this.configService.get<string>("TENANT_DEFAULT_WORKSPACE_NAME") ?? "Default Workspace";

    if (existingOrgWorkspace) {
      return {
        tenantId,
        tenantSlug,
        tenantName,
        organizationId: existingOrgWorkspace.organizationId,
        workspaceId: existingOrgWorkspace.workspaceId,
        organizationName: orgName,
        workspaceName: wsName
      };
    }

    const rawOrganizationId = this.configService.get<string>("TENANT_DEFAULT_ORGANIZATION_ID");
    const parsedOrganizationId = this.parseUuid(rawOrganizationId);
    const organizationId = parsedOrganizationId ?? randomUUID();
    if (!parsedOrganizationId && rawOrganizationId) {
      this.logger.warn(
        `TENANT_DEFAULT_ORGANIZATION_ID invalido (${rawOrganizationId}); usando ${organizationId}.`
      );
    }

    const rawWorkspaceId = this.configService.get<string>("TENANT_DEFAULT_WORKSPACE_ID");
    const parsedWorkspaceId = this.parseUuid(rawWorkspaceId);
    const workspaceId = parsedWorkspaceId ?? randomUUID();
    if (!parsedWorkspaceId && rawWorkspaceId) {
      this.logger.warn(
        `TENANT_DEFAULT_WORKSPACE_ID invalido (${rawWorkspaceId}); usando ${workspaceId}.`
      );
    }

    return {
      tenantId,
      tenantSlug,
      tenantName,
      organizationId,
      workspaceId,
      organizationName: orgName,
      workspaceName: wsName
    };
  }
}
