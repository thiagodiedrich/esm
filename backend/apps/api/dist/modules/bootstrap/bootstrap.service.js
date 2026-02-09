"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var BootstrapService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BootstrapService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
const crypto_1 = require("crypto");
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_resolver_1 = require("../database/uuid-resolver");
const branding_service_1 = require("../branding/branding.service");
const storage_service_1 = require("../storage/storage.service");
const database_module_1 = require("../database/database.module");
let BootstrapService = BootstrapService_1 = class BootstrapService {
    constructor(configService, brandingService, storageService, pool) {
        this.configService = configService;
        this.brandingService = brandingService;
        this.storageService = storageService;
        this.pool = pool;
        this.logger = new common_1.Logger(BootstrapService_1.name);
        this.bootstrapRetryTimer = null;
        this.bootstrapRetryMs = 10_000;
    }
    async onApplicationBootstrap() {
        this.logWhiteLabelDefaults();
        this.logStorageConfig();
        try {
            await this.runBootstrapTasks();
        }
        catch (error) {
            this.logger.warn(`Bootstrap pendente: ${error.message}. Nova tentativa em ${this.bootstrapRetryMs / 1000}s.`);
            this.scheduleBootstrapRetry();
        }
    }
    async runBootstrapTasks() {
        await this.bootstrapDefaultPlan();
        await this.bootstrapMasterAdmin();
    }
    scheduleBootstrapRetry() {
        if (this.bootstrapRetryTimer) {
            return;
        }
        this.bootstrapRetryTimer = setTimeout(async () => {
            this.bootstrapRetryTimer = null;
            try {
                await this.runBootstrapTasks();
                this.logger.log("Bootstrap concluido apos reconexao.");
            }
            catch (error) {
                this.logger.warn(`Bootstrap ainda pendente: ${error.message}. Nova tentativa em ${this.bootstrapRetryMs / 1000}s.`);
                this.scheduleBootstrapRetry();
            }
        }, this.bootstrapRetryMs);
    }
    logWhiteLabelDefaults() {
        const defaults = this.brandingService.getWhiteLabelDefaults();
        if (!defaults.enabled) {
            return;
        }
        this.logger.log(`White-label habilitado. App=${defaults.appName ?? "n/a"} Domain=${defaults.domain ?? "n/a"}`);
    }
    logStorageConfig() {
        const storage = this.storageService.getConfig();
        if (storage.type === "minio") {
            this.logger.log(`Storage minio configurado. Endpoint=${storage.minio.endpoint ?? "n/a"} Bucket=${storage.minio.bucket ?? "n/a"}`);
            return;
        }
        if (storage.type === "local") {
            this.logger.log(`Storage local configurado. Path=${storage.localPath ?? "n/a"}`);
        }
    }
    async bootstrapMasterAdmin() {
        const enabled = (this.configService.get("TENANT_MASTER_ADMIN_ENABLED") ?? "false").toLowerCase() ===
            "true";
        if (!enabled) {
            return;
        }
        const defaults = await this.getTenantDefaultsAsync();
        if (!defaults) {
            return;
        }
        const name = this.configService.get("TENANT_MASTER_ADMIN_NAME") ?? "Admin";
        const username = this.configService.get("TENANT_MASTER_ADMIN_USERNAME") ?? "";
        const password = this.configService.get("TENANT_MASTER_ADMIN_PASSWORD") ?? "";
        const email = this.configService.get("TENANT_MASTER_ADMIN_EMAIL") ?? "";
        const masterAdminTenantId = this.parseUuid(this.configService.get("TENANT_MASTER_ADMIN_TENANT_ID"));
        const tenantId = masterAdminTenantId ?? defaults.tenantId;
        const organizationId = this.parseUuid(this.configService.get("TENANT_MASTER_ADMIN_ORGANIZATION_ID")) ??
            defaults.organizationId;
        const workspaceId = this.parseUuid(this.configService.get("TENANT_MASTER_ADMIN_WORKSPACE_ID")) ??
            defaults.workspaceId;
        const roleIds = this.parseRoleIds(this.configService.get("TENANT_MASTER_ADMIN_ROLE") ?? "[]");
        if (!password || !email) {
            this.logger.warn("Bootstrap admin ignorado: email/senha nao definidos.");
            return;
        }
        let transactionOpen = false;
        try {
            await this.pool.query("BEGIN");
            transactionOpen = true;
            const resolvedTenantId = await this.ensureTenant(tenantId, defaults.tenantName, defaults.tenantSlug);
            const resolvedOrgId = await this.ensureOrganization(organizationId, resolvedTenantId, defaults.organizationName);
            await this.ensureWorkspace(workspaceId, resolvedTenantId, resolvedOrgId, defaults.workspaceName);
            const partnerId = await this.ensurePartner(name || username || email, email, resolvedTenantId, resolvedOrgId);
            await this.pool.query("UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1", [resolvedOrgId, partnerId]);
            await this.pool.query("UPDATE tenants SET is_super_tenant = true, updated_at = now() WHERE id = $1", [resolvedTenantId]);
            const userExists = await this.pool.query("SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)", [resolvedTenantId, email]);
            if ((userExists.rowCount ?? 0) > 0) {
                const userId = userExists.rows[0].id;
                await this.pool.query(`UPDATE res_users
           SET is_super_tenant = true, is_super_admin = true, organization_id = $2, updated_at = now()
           WHERE id = $1`, [userId, resolvedOrgId]);
                await this.applyRoles(userId, resolvedTenantId, roleIds);
                await this.pool.query("COMMIT");
                this.logger.log("Bootstrap admin: usuario ja existe, flags is_super_tenant/is_super_admin atualizados.");
                return;
            }
            const hashedPassword = await bcrypt_1.default.hash(password, 12);
            await this.pool.query(`INSERT INTO res_users
         (tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, TRUE, TRUE, $5, now(), now())`, [resolvedTenantId, partnerId, email, hashedPassword, resolvedOrgId]);
            const userResult = await this.pool.query("SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)", [resolvedTenantId, email]);
            const userId = userResult.rows[0].id;
            await this.applyRoles(userId, resolvedTenantId, roleIds);
            await this.pool.query("COMMIT");
            transactionOpen = false;
            this.logger.log("Bootstrap admin criado com sucesso.");
        }
        catch (error) {
            if (transactionOpen) {
                await this.pool.query("ROLLBACK");
            }
            this.logger.warn(`Bootstrap admin falhou: ${error.message}`);
            throw error;
        }
    }
    async bootstrapDefaultPlan() {
        const enabled = (this.configService.get("DEFAULT_PLAN_BOOTSTRAP_ENABLED") ?? "false").toLowerCase() ===
            "true";
        if (!enabled) {
            return;
        }
        const code = this.configService.get("DEFAULT_PLAN_CODE") ?? "";
        const name = this.configService.get("DEFAULT_PLAN_NAME") ?? "";
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
            await this.pool.query(`INSERT INTO platform_plans (code, name, description, created_at)
         VALUES ($1, $2, $3, now())`, [code, name, description]);
            this.logger.log(`Plano default criado: ${code}`);
        }
        catch (error) {
            this.logger.warn(`Bootstrap de plano falhou: ${error.message}`);
            throw error;
        }
    }
    buildPlanDescription() {
        const payload = {
            items_per_day: this.configService.get("DEFAULT_PLAN_ITEMS_PER_DAY") || null,
            sensors_per_day: this.configService.get("DEFAULT_PLAN_SENSORS_PER_DAY") || null,
            bytes_per_day: this.configService.get("DEFAULT_PLAN_BYTES_PER_DAY") || null,
            alert_delay_seconds: this.configService.get("DEFAULT_PLAN_ALERT_DELAY_SECONDS") || null,
            quota_enabled: this.configService.get("QUOTA_ENABLED") === "true",
            quota_enforce: this.configService.get("QUOTA_ENFORCE") === "true",
            quota_estimate_bytes: this.configService.get("QUOTA_ESTIMATE_BYTES") === "true",
            billing_events_enabled: this.configService.get("BILLING_EVENTS_ENABLED") === "true"
        };
        return JSON.stringify(payload);
    }
    parseUuid(value) {
        if (!value) {
            return null;
        }
        const trimmed = value.trim();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(trimmed) ? trimmed : null;
    }
    parseRoleIds(raw) {
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.filter((item) => typeof item === "string" && this.parseUuid(item));
        }
        catch {
            return [];
        }
    }
    async ensureTenant(tenantUuid, name, slug) {
        const existsByUuid = await this.pool.query("SELECT id FROM tenants WHERE uuid = $1", [
            tenantUuid
        ]);
        if ((existsByUuid.rowCount ?? 0) > 0) {
            return existsByUuid.rows[0].id;
        }
        const existsBySlug = await this.pool.query("SELECT id FROM tenants WHERE slug = $1", [slug]);
        if ((existsBySlug.rowCount ?? 0) > 0) {
            return existsBySlug.rows[0].id;
        }
        const result = await this.pool.query(`INSERT INTO tenants
       (name, slug, db_strategy, migration_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (slug) DO UPDATE SET updated_at = now()
       RETURNING id`, [name, slug, "shared", "idle"]);
        return result.rows[0].id;
    }
    async ensureOrganization(organizationUuid, tenantId, name) {
        const exists = await this.pool.query("SELECT id FROM res_organizations WHERE uuid = $1", [
            organizationUuid
        ]);
        if ((exists.rowCount ?? 0) > 0) {
            return exists.rows[0].id;
        }
        const result = await this.pool.query(`INSERT INTO res_organizations
       (uuid, tenant_id, partner_id, name, is_default, created_at, updated_at)
       VALUES ($1, $2, NULL, $3, TRUE, now(), now())
       RETURNING id`, [organizationUuid, tenantId, name]);
        return result.rows[0].id;
    }
    async ensureWorkspace(workspaceUuid, tenantId, organizationId, name) {
        const exists = await this.pool.query("SELECT id FROM res_workspaces WHERE uuid = $1", [
            workspaceUuid
        ]);
        if ((exists.rowCount ?? 0) > 0) {
            return;
        }
        await this.pool.query(`INSERT INTO res_workspaces
       (uuid, tenant_id, organization_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())`, [workspaceUuid, tenantId, organizationId, name]);
    }
    async ensurePartner(name, email, tenantId, organizationId) {
        const existing = await this.pool.query("SELECT id FROM res_partners WHERE tenant_id = $1 AND email = $2", [tenantId, email]);
        if ((existing.rowCount ?? 0) > 0) {
            return existing.rows[0].id;
        }
        const result = await this.pool.query(`INSERT INTO res_partners
       (tenant_id, organization_id, name, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id`, [tenantId, organizationId, name, email]);
        return result.rows[0].id;
    }
    async applyRoles(userId, tenantId, roleUuids) {
        if (roleUuids.length === 0) {
            if (this.configService.get("TENANT_MASTER_ADMIN_ROLE")) {
                this.logger.warn("TENANT_MASTER_ADMIN_ROLE invalido ou vazio; roles ignoradas.");
            }
            return;
        }
        for (const roleUuid of roleUuids) {
            const roleId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_roles", roleUuid);
            if (!roleId)
                continue;
            await this.pool.query(`INSERT INTO res_user_roles
         (user_id, role_id, scope_type, scope_id, created_at)
         VALUES ($1, $2, $3, $4, now())`, [userId, roleId, "tenant", tenantId]);
        }
    }
    async getTenantDefaultsAsync() {
        const defaultSlug = this.configService.get("TENANT_DEFAULT_SLUG")?.trim() ?? "default-tenant";
        const defaultName = this.configService.get("TENANT_DEFAULT_NAME") ?? "Default Tenant";
        const rawTenantId = this.configService.get("TENANT_DEFAULT_ID")?.trim();
        const parsedTenantId = this.parseUuid(rawTenantId);
        // 2 - procura por tenant_default_id OU tenant_default_slug; se encontrar algum, retorna
        // com org/workspace REAIS do banco (evita duplicacao ao reiniciar)
        if (parsedTenantId) {
            const byUuid = await this.pool.query("SELECT id, uuid, slug, name FROM tenants WHERE uuid = $1", [parsedTenantId]);
            if ((byUuid.rowCount ?? 0) > 0) {
                const row = byUuid.rows[0];
                const existing = await this.getExistingOrgWorkspaceForTenant(row.id);
                return this.buildTenantDefaults(row.uuid, row.slug, row.name ?? defaultName, existing);
            }
        }
        if (defaultSlug) {
            const bySlug = await this.pool.query("SELECT id, uuid, slug, name FROM tenants WHERE slug = $1", [defaultSlug]);
            if ((bySlug.rowCount ?? 0) > 0) {
                const row = bySlug.rows[0];
                const existing = await this.getExistingOrgWorkspaceForTenant(row.id);
                return this.buildTenantDefaults(row.uuid, row.slug, row.name ?? defaultName, existing);
            }
        }
        // 1 - tenant_default_enabled = true E tenant_master_admin_enabled = true
        const defaultTenantEnabled = (this.configService.get("TENANT_DEFAULT_ENABLED") ?? "false").toLowerCase() === "true";
        const masterAdminEnabled = (this.configService.get("TENANT_MASTER_ADMIN_ENABLED") ?? "false").toLowerCase() ===
            "true";
        if (!defaultTenantEnabled || !masterAdminEnabled) {
            return null;
        }
        // 3 - nao existe tenant com is_super_tenant = true (todos tem is_super_tenant = false ou nao ha tenants)
        const superTenantExists = await this.pool.query("SELECT uuid FROM tenants WHERE is_super_tenant = true LIMIT 1");
        if ((superTenantExists.rowCount ?? 0) > 0) {
            throw new common_1.BadRequestException("Code 4: Tenant padrao invalido");
        }
        // Condicoes 1, 2 e 3 atendidas: entra no fluxo de criacao do INSERT
        const tenantId = parsedTenantId ?? (0, crypto_1.randomUUID)();
        if (!parsedTenantId && rawTenantId) {
            this.logger.warn(`TENANT_DEFAULT_ID invalido (${rawTenantId}); usando ${tenantId}.`);
        }
        return this.buildTenantDefaults(tenantId, defaultSlug, defaultName);
    }
    async getExistingOrgWorkspaceForTenant(tenantId) {
        const orgResult = await this.pool.query(`SELECT uuid FROM res_organizations
       WHERE tenant_id = $1
       ORDER BY (CASE WHEN is_default = true THEN 0 ELSE 1 END), created_at ASC
       LIMIT 1`, [tenantId]);
        if ((orgResult.rowCount ?? 0) === 0)
            return null;
        const orgUuid = orgResult.rows[0].uuid;
        const orgIdResult = await this.pool.query("SELECT id FROM res_organizations WHERE uuid = $1", [orgUuid]);
        const orgId = orgIdResult.rows[0]?.id;
        if (!orgId)
            return { organizationId: orgUuid, workspaceId: (0, crypto_1.randomUUID)() };
        const wsResult = await this.pool.query(`SELECT uuid FROM res_workspaces
       WHERE organization_id = $1
       ORDER BY created_at ASC LIMIT 1`, [orgId]);
        const workspaceId = (wsResult.rowCount ?? 0) > 0 ? wsResult.rows[0].uuid : (0, crypto_1.randomUUID)();
        return { organizationId: orgUuid, workspaceId };
    }
    buildTenantDefaults(tenantId, tenantSlug, tenantName, existingOrgWorkspace) {
        const orgName = this.configService.get("TENANT_DEFAULT_ORGANIZATION_NAME") ?? "Default Organization";
        const wsName = this.configService.get("TENANT_DEFAULT_WORKSPACE_NAME") ?? "Default Workspace";
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
        const rawOrganizationId = this.configService.get("TENANT_DEFAULT_ORGANIZATION_ID");
        const parsedOrganizationId = this.parseUuid(rawOrganizationId);
        const organizationId = parsedOrganizationId ?? (0, crypto_1.randomUUID)();
        if (!parsedOrganizationId && rawOrganizationId) {
            this.logger.warn(`TENANT_DEFAULT_ORGANIZATION_ID invalido (${rawOrganizationId}); usando ${organizationId}.`);
        }
        const rawWorkspaceId = this.configService.get("TENANT_DEFAULT_WORKSPACE_ID");
        const parsedWorkspaceId = this.parseUuid(rawWorkspaceId);
        const workspaceId = parsedWorkspaceId ?? (0, crypto_1.randomUUID)();
        if (!parsedWorkspaceId && rawWorkspaceId) {
            this.logger.warn(`TENANT_DEFAULT_WORKSPACE_ID invalido (${rawWorkspaceId}); usando ${workspaceId}.`);
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
};
exports.BootstrapService = BootstrapService;
exports.BootstrapService = BootstrapService = BootstrapService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        branding_service_1.BrandingService,
        storage_service_1.StorageService,
        pg_1.Pool])
], BootstrapService);
