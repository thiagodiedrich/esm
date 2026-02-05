import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
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

    const defaults = this.getTenantDefaults();

    const name = this.configService.get<string>("TENANT_MASTER_ADMIN_NAME") ?? "Admin";
    const username = this.configService.get<string>("TENANT_MASTER_ADMIN_USERNAME") ?? "";
    const password = this.configService.get<string>("TENANT_MASTER_ADMIN_PASSWORD") ?? "";
    const email = this.configService.get<string>("TENANT_MASTER_ADMIN_EMAIL") ?? "";

    const tenantId =
      this.parseUuid(this.configService.get<string>("TENANT_MASTER_ADMIN_TENANT_ID")) ??
      defaults.tenantId;
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
      await this.ensureTenant(tenantId, defaults.tenantName, defaults.tenantSlug);
      await this.ensureOrganization(organizationId, tenantId, defaults.organizationName);
      await this.ensureWorkspace(
        workspaceId,
        tenantId,
        organizationId,
        defaults.workspaceName
      );

      await this.pool.query(
        "UPDATE tenants SET is_super_tenant = true, updated_at = now() WHERE id = $1",
        [tenantId]
      );

      const userExists = await this.pool.query<{ id: string }>(
        "SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)",
        [tenantId, email]
      );
      if ((userExists.rowCount ?? 0) > 0) {
        const userId = userExists.rows[0].id;
        await this.pool.query(
          `UPDATE res_users
           SET is_super_tenant = true, is_super_admin = true, organization_id = $2, updated_at = now()
           WHERE id = $1`,
          [userId, organizationId]
        );
        await this.applyRoles(userId, tenantId, roleIds);
        await this.pool.query("COMMIT");
        this.logger.log("Bootstrap admin: usuario ja existe, flags is_super_tenant/is_super_admin atualizados.");
        return;
      }

      const partnerId = await this.ensurePartner(name || username || email, email, tenantId, organizationId);
      const hashedPassword = await bcrypt.hash(password, 12);

      const userId = randomUUID();
      await this.pool.query(
        `INSERT INTO res_users
         (id, tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, TRUE, $6, now(), now())`,
        [userId, tenantId, partnerId, email, hashedPassword, organizationId]
      );

      await this.applyRoles(userId, tenantId, roleIds);
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
        `INSERT INTO platform_plans (id, code, name, description, created_at)
         VALUES ($1, $2, $3, $4, now())`,
        [randomUUID(), code, name, description]
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

  private async ensureTenant(tenantId: string, name: string, slug: string) {
    const exists = await this.pool.query("SELECT id FROM tenants WHERE id = $1", [tenantId]);
    if ((exists.rowCount ?? 0) > 0) {
      return;
    }

    await this.pool.query(
      `INSERT INTO tenants
       (id, name, slug, db_strategy, migration_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [tenantId, name, slug, "shared", "idle"]
    );
  }

  private async ensureOrganization(organizationId: string, tenantId: string, name: string) {
    const exists = await this.pool.query("SELECT id FROM res_organizations WHERE id = $1", [
      organizationId
    ]);
    if ((exists.rowCount ?? 0) > 0) {
      return;
    }

    await this.pool.query(
      `INSERT INTO res_organizations
       (id, tenant_id, partner_id, name, is_default, created_at, updated_at)
       VALUES ($1, $2, NULL, $3, TRUE, now(), now())`,
      [organizationId, tenantId, name]
    );
  }

  private async ensureOrganizationPartner(
    organizationId: string,
    tenantId: string,
    partnerId: string
  ) {
    await this.pool.query(
      "UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3",
      [organizationId, partnerId, tenantId]
    );
  }

  private async ensureWorkspace(
    workspaceId: string,
    tenantId: string,
    organizationId: string,
    name: string
  ) {
    const exists = await this.pool.query("SELECT id FROM res_workspaces WHERE id = $1", [
      workspaceId
    ]);
    if ((exists.rowCount ?? 0) > 0) {
      return;
    }

    await this.pool.query(
      `INSERT INTO res_workspaces
       (id, tenant_id, organization_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())`,
      [workspaceId, tenantId, organizationId, name]
    );
  }

  private async ensurePartner(
    name: string,
    email: string,
    tenantId: string,
    organizationId: string
  ): Promise<string> {
    const existing = await this.pool.query(
      "SELECT id FROM res_partners WHERE tenant_id = $1 AND email = $2",
      [tenantId, email]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return existing.rows[0].id;
    }

    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO res_partners
       (id, tenant_id, organization_id, name, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [id, tenantId, organizationId, name, email]
    );
    return id;
  }

  private async applyRoles(userId: string, tenantId: string, roleIds: string[]) {
    if (roleIds.length === 0) {
      if (this.configService.get<string>("TENANT_MASTER_ADMIN_ROLE")) {
        this.logger.warn("TENANT_MASTER_ADMIN_ROLE invalido ou vazio; roles ignoradas.");
      }
      return;
    }

    for (const roleId of roleIds) {
      await this.pool.query(
        `INSERT INTO res_user_roles
         (id, user_id, role_id, scope_type, scope_id, created_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [randomUUID(), userId, roleId, "tenant", tenantId]
      );
    }
  }

  private getTenantDefaults() {
    const rawTenantId = this.configService.get<string>("TENANT_DEFAULT_ID");
    const parsedTenantId = this.parseUuid(rawTenantId);
    const tenantId = parsedTenantId ?? randomUUID();
    if (!parsedTenantId && rawTenantId) {
      this.logger.warn(`TENANT_DEFAULT_ID invalido (${rawTenantId}); usando ${tenantId}.`);
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
      organizationId,
      workspaceId,
      tenantSlug: this.configService.get<string>("TENANT_DEFAULT_SLUG") ?? "default-tenant",
      tenantName: this.configService.get<string>("TENANT_DEFAULT_NAME") ?? "Default Tenant",
      organizationName:
        this.configService.get<string>("TENANT_DEFAULT_ORGANIZATION_NAME") ??
        "Default Organization",
      workspaceName:
        this.configService.get<string>("TENANT_DEFAULT_WORKSPACE_NAME") ??
        "Default Workspace"
    };
  }
}
