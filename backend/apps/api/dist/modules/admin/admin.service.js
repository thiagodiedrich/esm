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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
const crypto_1 = require("crypto");
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_module_1 = require("../database/database.module");
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseUuid(value) {
    if (!value?.trim())
        return null;
    return UUID_REGEX.test(value.trim()) ? value.trim() : null;
}
let AdminService = class AdminService {
    constructor(pool, configService) {
        this.pool = pool;
        this.configService = configService;
    }
    async createTenant(input) {
        const slugExists = await this.pool.query("SELECT id FROM tenants WHERE LOWER(slug) = LOWER($1)", [input.slug]);
        if ((slugExists.rowCount ?? 0) > 0) {
            throw new common_1.BadRequestException("Slug do tenant ja existe.");
        }
        const tenantId = parseUuid(input.id) ?? (0, crypto_1.randomUUID)();
        const countBefore = await this.pool.query("SELECT COUNT(*)::int AS c FROM tenants", []);
        const isFirstTenant = (countBefore.rows[0]?.c ?? 0) === 0;
        const masterTenantIdFromEnv = parseUuid(this.configService.get("TENANT_MASTER_ADMIN_TENANT_ID") ?? null);
        const isSuperTenant = isFirstTenant || (!!masterTenantIdFromEnv && tenantId === masterTenantIdFromEnv);
        const createFirstOrgAndUser = !!input.first_organization_name?.trim() &&
            !!input.first_user_email?.trim() &&
            !!input.first_user_password;
        let transactionOpen = false;
        try {
            await this.pool.query("BEGIN");
            transactionOpen = true;
            await this.pool.query(`INSERT INTO tenants
         (id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`, [
                tenantId,
                input.name,
                input.slug,
                input.db_strategy ?? null,
                input.control_plane_db ?? null,
                input.erp_db ?? null,
                input.telemetry_db ?? null,
                input.migration_status ?? null,
                isSuperTenant
            ]);
            let organization = null;
            let user = null;
            if (createFirstOrgAndUser) {
                const orgId = (0, crypto_1.randomUUID)();
                await this.pool.query(`INSERT INTO res_organizations (id, tenant_id, partner_id, name, is_default, created_at, updated_at)
           VALUES ($1, $2, NULL, $3, TRUE, now(), now())`, [orgId, tenantId, input.first_organization_name.trim()]);
                organization = {
                    id: orgId,
                    tenant_id: tenantId,
                    name: input.first_organization_name.trim(),
                    is_default: true
                };
                const partnerId = (0, crypto_1.randomUUID)();
                const partnerName = (input.first_user_name ?? input.first_organization_name ?? input.first_user_email).trim();
                const userEmail = input.first_user_email.trim();
                await this.pool.query(`INSERT INTO res_partners (id, tenant_id, organization_id, name, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, now(), now())`, [partnerId, tenantId, orgId, partnerName, userEmail]);
                await this.pool.query("UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3", [orgId, partnerId, tenantId]);
                const userId = (0, crypto_1.randomUUID)();
                const passwordHash = await bcrypt_1.default.hash(input.first_user_password, 12);
                await this.pool.query(`INSERT INTO res_users
           (id, tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8, now(), now())`, [
                    userId,
                    tenantId,
                    partnerId,
                    userEmail,
                    passwordHash,
                    isSuperTenant,
                    isSuperTenant,
                    orgId
                ]);
                user = {
                    id: userId,
                    tenant_id: tenantId,
                    partner_id: partnerId,
                    email: userEmail,
                    is_super_tenant: isSuperTenant,
                    is_super_admin: isSuperTenant,
                    organization_id: orgId
                };
            }
            await this.pool.query("COMMIT");
            transactionOpen = false;
            const tenantRow = await this.pool.query(`SELECT id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
         FROM tenants WHERE id = $1`, [tenantId]);
            const tenant = tenantRow.rows[0];
            return organization ? { ...tenant, organization, user } : tenant;
        }
        catch (e) {
            if (transactionOpen)
                await this.pool.query("ROLLBACK");
            throw e;
        }
    }
    async listTenants() {
        const result = await this.pool.query(`SELECT id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
       FROM tenants
       ORDER BY created_at DESC`);
        return result.rows;
    }
    async getTenant(id) {
        const result = await this.pool.query(`SELECT id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
       FROM tenants WHERE id = $1`, [id]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Tenant nao encontrado.");
        }
        return result.rows[0];
    }
    async updateTenant(id, input) {
        const result = await this.pool.query(`UPDATE tenants
       SET name = $2,
           slug = $3,
           db_strategy = $4,
           control_plane_db = $5,
           erp_db = $6,
           telemetry_db = $7,
           migration_status = $8,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at`, [
            id,
            input.name,
            input.slug,
            input.db_strategy ?? null,
            input.control_plane_db ?? null,
            input.erp_db ?? null,
            input.telemetry_db ?? null,
            input.migration_status ?? null
        ]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Tenant nao encontrado.");
        }
        return result.rows[0];
    }
    async updateTenantStatus(id, status) {
        const result = await this.pool.query(`UPDATE tenants
       SET migration_status = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, migration_status, updated_at`, [id, status]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Tenant nao encontrado.");
        }
        return result.rows[0];
    }
    async createPlan(input) {
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO platform_plans (id, code, name, description, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, code, name, description, created_at`, [id, input.code, input.name, input.description ?? null]);
        return result.rows[0];
    }
    async listPlans() {
        const result = await this.pool.query("SELECT id, code, name, description, created_at FROM platform_plans ORDER BY created_at DESC");
        return result.rows;
    }
    async updatePlan(code, input) {
        const result = await this.pool.query(`UPDATE platform_plans
       SET name = $2, description = $3
       WHERE code = $1
       RETURNING id, code, name, description, created_at`, [code, input.name, input.description ?? null]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Plano nao encontrado.");
        }
        return result.rows[0];
    }
    async updatePlanStatus(code, status) {
        const current = await this.pool.query("SELECT description FROM platform_plans WHERE code = $1", [code]);
        if (current.rowCount === 0) {
            throw new common_1.NotFoundException("Plano nao encontrado.");
        }
        const description = current.rows[0]?.description ?? null;
        let payload = {};
        if (description) {
            try {
                payload = JSON.parse(description);
            }
            catch {
                payload = { description };
            }
        }
        payload.status = status;
        const updated = await this.pool.query("UPDATE platform_plans SET description = $2 WHERE code = $1 RETURNING id, code, name, description, created_at", [code, JSON.stringify(payload)]);
        return updated.rows[0];
    }
    async createPlatformProduct(input) {
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO platform_products (id, code, name, description, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, code, name, description, created_at`, [id, input.code, input.name, input.description ?? null]);
        return result.rows[0];
    }
    async listPlatformProducts() {
        const result = await this.pool.query("SELECT id, code, name, description, created_at FROM platform_products ORDER BY created_at DESC");
        return result.rows;
    }
    async getPlatformProduct(id) {
        const result = await this.pool.query("SELECT id, code, name, description, created_at FROM platform_products WHERE id = $1", [id]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto nao encontrado.");
        }
        return result.rows[0];
    }
    async updatePlatformProduct(id, input) {
        const result = await this.pool.query(`UPDATE platform_products SET code = $2, name = $3, description = $4
       WHERE id = $1 RETURNING id, code, name, description, created_at`, [id, input.code, input.name, input.description ?? null]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto nao encontrado.");
        }
        return result.rows[0];
    }
    async deletePlatformProduct(id) {
        const result = await this.pool.query("DELETE FROM platform_products WHERE id = $1", [id]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto nao encontrado.");
        }
        return { status: "ok" };
    }
    async createPlatformProductModule(input) {
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO platform_product_modules (id, product_id, code, name, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, product_id, code, name, created_at`, [id, input.product_id, input.code, input.name]);
        return result.rows[0];
    }
    async listPlatformProductModules(productId) {
        if (productId) {
            const result = await this.pool.query(`SELECT id, product_id, code, name, created_at FROM platform_product_modules WHERE product_id = $1 ORDER BY created_at DESC`, [productId]);
            return result.rows;
        }
        const result = await this.pool.query("SELECT id, product_id, code, name, created_at FROM platform_product_modules ORDER BY created_at DESC");
        return result.rows;
    }
    async getPlatformProductModule(id) {
        const result = await this.pool.query("SELECT id, product_id, code, name, created_at FROM platform_product_modules WHERE id = $1", [id]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Modulo nao encontrado.");
        }
        return result.rows[0];
    }
    async updatePlatformProductModule(id, input) {
        const result = await this.pool.query(`UPDATE platform_product_modules SET product_id = $2, code = $3, name = $4 WHERE id = $1
       RETURNING id, product_id, code, name, created_at`, [id, input.product_id, input.code, input.name]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Modulo nao encontrado.");
        }
        return result.rows[0];
    }
    async deletePlatformProductModule(id) {
        const result = await this.pool.query("DELETE FROM platform_product_modules WHERE id = $1", [id]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Modulo nao encontrado.");
        }
        return { status: "ok" };
    }
    async createTenantPlatformProduct(tenantId, input) {
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO tenant_platform_products (id, tenant_id, product_id, plan_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, tenant_id, product_id, plan_id, is_active, created_at`, [id, tenantId, input.product_id, input.plan_id, input.is_active ?? true]);
        return result.rows[0];
    }
    async listTenantPlatformProducts(tenantId) {
        const result = await this.pool.query(`SELECT id, tenant_id, product_id, plan_id, is_active, created_at
       FROM tenant_platform_products WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
        return result.rows;
    }
    async getTenantPlatformProduct(tenantId, id) {
        const result = await this.pool.query(`SELECT id, tenant_id, product_id, plan_id, is_active, created_at
       FROM tenant_platform_products WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto do tenant nao encontrado.");
        }
        return result.rows[0];
    }
    async updateTenantPlatformProduct(tenantId, id, input) {
        const result = await this.pool.query(`UPDATE tenant_platform_products SET product_id = $3, plan_id = $4, is_active = $5
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, product_id, plan_id, is_active, created_at`, [id, tenantId, input.product_id, input.plan_id, input.is_active ?? true]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto do tenant nao encontrado.");
        }
        return result.rows[0];
    }
    async deleteTenantPlatformProduct(tenantId, id) {
        const result = await this.pool.query("DELETE FROM tenant_platform_products WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto do tenant nao encontrado.");
        }
        return { status: "ok" };
    }
    async listTenantUsageMetrics(tenantId) {
        const result = await this.pool.query(`SELECT id, tenant_id, metric_key, metric_value, period, source, created_at
       FROM tenant_usage_metrics WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
        return result.rows;
    }
    async createPermission(input) {
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO res_permissions (id, resource, action, description, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, resource, action, description, created_at`, [id, input.resource, input.action, input.description ?? null]);
        return result.rows[0];
    }
    async listPermissions() {
        const result = await this.pool.query("SELECT id, resource, action, description, created_at FROM res_permissions ORDER BY resource, action");
        return result.rows;
    }
    async getPermission(id) {
        const result = await this.pool.query("SELECT id, resource, action, description, created_at FROM res_permissions WHERE id = $1", [id]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Permissao nao encontrada.");
        }
        return result.rows[0];
    }
    async updatePermission(id, input) {
        const result = await this.pool.query(`UPDATE res_permissions SET resource = $2, action = $3, description = $4 WHERE id = $1
       RETURNING id, resource, action, description, created_at`, [id, input.resource, input.action, input.description ?? null]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Permissao nao encontrada.");
        }
        return result.rows[0];
    }
    async deletePermission(id) {
        const result = await this.pool.query("DELETE FROM res_permissions WHERE id = $1", [id]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Permissao nao encontrada.");
        }
        return { status: "ok" };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool,
        config_1.ConfigService])
], AdminService);
