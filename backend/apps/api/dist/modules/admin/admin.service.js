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
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_module_1 = require("../database/database.module");
const uuid_resolver_1 = require("../database/uuid-resolver");
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
        const countBefore = await this.pool.query("SELECT COUNT(*)::int AS c FROM tenants", []);
        const isFirstTenant = (countBefore.rows[0]?.c ?? 0) === 0;
        const masterTenantUuidFromEnv = this.configService.get("TENANT_MASTER_ADMIN_TENANT_ID")?.trim() ?? null;
        const createFirstOrgAndUser = !!input.first_organization_name?.trim() &&
            !!input.first_user_email?.trim() &&
            !!input.first_user_password;
        let transactionOpen = false;
        try {
            await this.pool.query("BEGIN");
            transactionOpen = true;
            const tenantResult = await this.pool.query(`INSERT INTO tenants
         (name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
         RETURNING id, uuid, is_super_tenant`, [
                input.name,
                input.slug,
                input.db_strategy ?? null,
                input.control_plane_db ?? null,
                input.erp_db ?? null,
                input.telemetry_db ?? null,
                input.migration_status ?? null,
                isFirstTenant || (!!masterTenantUuidFromEnv && input.uuid === masterTenantUuidFromEnv)
            ]);
            const tenantRow = tenantResult.rows[0];
            const tenantId = tenantRow.id;
            const tenantUuid = tenantRow.uuid;
            const isSuperTenant = tenantRow.is_super_tenant ?? false;
            let organization = null;
            let user = null;
            if (createFirstOrgAndUser) {
                const orgResult = await this.pool.query(`INSERT INTO res_organizations (tenant_id, partner_id, name, is_default, created_at, updated_at)
           VALUES ($1, NULL, $2, TRUE, now(), now())
           RETURNING id, uuid`, [tenantId, input.first_organization_name.trim()]);
                const orgRow = orgResult.rows[0];
                const orgId = orgRow.id;
                const orgUuid = orgRow.uuid;
                const partnerName = (input.first_user_name ?? input.first_organization_name ?? input.first_user_email).trim();
                const userEmail = input.first_user_email.trim();
                const partnerResult = await this.pool.query(`INSERT INTO res_partners (tenant_id, organization_id, name, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, now(), now())
           RETURNING id, uuid`, [tenantId, orgId, partnerName, userEmail]);
                const partnerRow = partnerResult.rows[0];
                const partnerId = partnerRow.id;
                await this.pool.query("UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3", [orgId, partnerId, tenantId]);
                const passwordHash = await bcrypt_1.default.hash(input.first_user_password, 12);
                const userResult = await this.pool.query(`INSERT INTO res_users
           (tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, now(), now())
           RETURNING id, uuid`, [tenantId, partnerId, userEmail, passwordHash, isSuperTenant, isSuperTenant, orgId]);
                const userRow = userResult.rows[0];
                organization = {
                    id: orgRow.id,
                    uuid: orgUuid,
                    tenant_id: tenantUuid,
                    name: input.first_organization_name.trim(),
                    is_default: true
                };
                user = {
                    id: userRow.id,
                    uuid: userRow.uuid,
                    tenant_id: tenantUuid,
                    partner_id: partnerRow.uuid,
                    email: userEmail,
                    is_super_tenant: isSuperTenant,
                    is_super_admin: isSuperTenant,
                    organization_id: orgUuid
                };
            }
            await this.pool.query("COMMIT");
            transactionOpen = false;
            const tenantSel = await this.pool.query(`SELECT id, uuid, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
         FROM tenants WHERE uuid = $1`, [tenantUuid]);
            const tenant = tenantSel.rows[0];
            return organization ? { ...tenant, organization, user } : tenant;
        }
        catch (e) {
            if (transactionOpen)
                await this.pool.query("ROLLBACK");
            throw e;
        }
    }
    async listTenants() {
        const result = await this.pool.query(`SELECT id, uuid, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
       FROM tenants
       ORDER BY created_at DESC`);
        return result.rows;
    }
    async getTenant(uuid) {
        const result = await this.pool.query(`SELECT id, uuid, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
       FROM tenants WHERE uuid = $1`, [uuid]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Code 8: Tenant nao encontrado");
        }
        return result.rows[0];
    }
    async updateTenant(uuid, input) {
        const result = await this.pool.query(`UPDATE tenants
       SET name = $2,
           slug = $3,
           db_strategy = $4,
           control_plane_db = $5,
           erp_db = $6,
           telemetry_db = $7,
           migration_status = $8,
           updated_at = now()
       WHERE uuid = $1
       RETURNING id, uuid, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at`, [
            uuid,
            input.name,
            input.slug,
            input.db_strategy ?? null,
            input.control_plane_db ?? null,
            input.erp_db ?? null,
            input.telemetry_db ?? null,
            input.migration_status ?? null
        ]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Code 5: Tenant nao encontrado");
        }
        return result.rows[0];
    }
    async updateTenantStatus(uuid, status) {
        const result = await this.pool.query(`UPDATE tenants
       SET migration_status = $2, updated_at = now()
       WHERE uuid = $1
       RETURNING id, uuid, name, slug, migration_status, updated_at`, [uuid, status]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Code65: Tenant nao encontrado");
        }
        return result.rows[0];
    }
    async createPlan(input) {
        const result = await this.pool.query(`INSERT INTO platform_plans (code, name, description, created_at)
       VALUES ($1, $2, $3, now())
       RETURNING id, uuid, code, name, description, created_at`, [input.code, input.name, input.description ?? null]);
        return result.rows[0];
    }
    async listPlans() {
        const result = await this.pool.query("SELECT id, uuid, code, name, description, created_at FROM platform_plans ORDER BY created_at DESC");
        return result.rows;
    }
    async updatePlan(code, input) {
        const result = await this.pool.query(`UPDATE platform_plans SET name = $2, description = $3
       WHERE code = $1
       RETURNING id, uuid, code, name, description, created_at`, [code, input.name, input.description ?? null]);
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
        const updated = await this.pool.query("UPDATE platform_plans SET description = $2 WHERE code = $1 RETURNING id, uuid, code, name, description, created_at", [code, JSON.stringify(payload)]);
        return updated.rows[0];
    }
    async createPlatformProduct(input) {
        const result = await this.pool.query(`INSERT INTO platform_products (code, name, description, created_at)
       VALUES ($1, $2, $3, now())
       RETURNING id, uuid, code, name, description, created_at`, [input.code, input.name, input.description ?? null]);
        return result.rows[0];
    }
    async listPlatformProducts() {
        const result = await this.pool.query("SELECT id, uuid, code, name, description, created_at FROM platform_products ORDER BY created_at DESC");
        return result.rows;
    }
    async getPlatformProduct(uuid) {
        const result = await this.pool.query("SELECT id, uuid, code, name, description, created_at FROM platform_products WHERE uuid = $1", [uuid]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto nao encontrado.");
        }
        return result.rows[0];
    }
    async updatePlatformProduct(uuid, input) {
        const result = await this.pool.query(`UPDATE platform_products SET code = $2, name = $3, description = $4
       WHERE uuid = $1 RETURNING id, uuid, code, name, description, created_at`, [uuid, input.code, input.name, input.description ?? null]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto nao encontrado.");
        }
        return result.rows[0];
    }
    async deletePlatformProduct(uuid) {
        const result = await this.pool.query("DELETE FROM platform_products WHERE uuid = $1", [uuid]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto nao encontrado.");
        }
        return { status: "ok" };
    }
    async createPlatformProductModule(input) {
        const productId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "platform_products", input.product_id);
        if (!productId) {
            throw new common_1.BadRequestException("Produto nao encontrado.");
        }
        const result = await this.pool.query(`INSERT INTO platform_product_modules (product_id, code, name, created_at)
       VALUES ($1, $2, $3, now())
       RETURNING id, uuid, product_id, code, name, created_at`, [productId, input.code, input.name]);
        const row = result.rows[0];
        const productUuidRes = await this.pool.query("SELECT uuid FROM platform_products WHERE id = $1", [row.product_id]);
        return { ...row, product_uuid: productUuidRes.rows[0]?.uuid };
    }
    async listPlatformProductModules(productUuid) {
        if (productUuid) {
            const productId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "platform_products", productUuid);
            if (!productId)
                return [];
            const result = await this.pool.query(`SELECT m.id, m.uuid, m.product_id, m.code, m.name, m.created_at, p.uuid AS product_uuid
         FROM platform_product_modules m
         JOIN platform_products p ON p.id = m.product_id
         WHERE m.product_id = $1 ORDER BY m.created_at DESC`, [productId]);
            return result.rows.map((r) => ({ ...r, product_id: r.product_uuid }));
        }
        const result = await this.pool.query(`SELECT m.id, m.uuid, m.product_id, m.code, m.name, m.created_at, p.uuid AS product_uuid
       FROM platform_product_modules m
       JOIN platform_products p ON p.id = m.product_id
       ORDER BY m.created_at DESC`);
        return result.rows.map((r) => ({ ...r, product_id: r.product_uuid }));
    }
    async getPlatformProductModule(uuid) {
        const result = await this.pool.query(`SELECT m.id, m.uuid, m.product_id, m.code, m.name, m.created_at, p.uuid AS product_uuid
       FROM platform_product_modules m
       JOIN platform_products p ON p.id = m.product_id
       WHERE m.uuid = $1`, [uuid]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Modulo nao encontrado.");
        }
        const row = result.rows[0];
        return { ...row, product_id: row.product_uuid };
    }
    async updatePlatformProductModule(uuid, input) {
        const productId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "platform_products", input.product_id);
        if (!productId) {
            throw new common_1.BadRequestException("Produto nao encontrado.");
        }
        const result = await this.pool.query(`UPDATE platform_product_modules SET product_id = $2, code = $3, name = $4 WHERE uuid = $1
       RETURNING id, uuid, product_id, code, name, created_at`, [uuid, productId, input.code, input.name]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Modulo nao encontrado.");
        }
        const row = result.rows[0];
        const productUuidRes = await this.pool.query("SELECT uuid FROM platform_products WHERE id = $1", [row.product_id]);
        return { ...row, product_id: productUuidRes.rows[0]?.uuid };
    }
    async deletePlatformProductModule(uuid) {
        const result = await this.pool.query("DELETE FROM platform_product_modules WHERE uuid = $1", [uuid]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Modulo nao encontrado.");
        }
        return { status: "ok" };
    }
    async createTenantPlatformProduct(tenantUuid, input) {
        const tenantId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "tenants", tenantUuid);
        const productId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "platform_products", input.product_id);
        const planId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "platform_plans", input.plan_id);
        if (!tenantId || !productId || !planId) {
            throw new common_1.BadRequestException("Tenant, produto ou plano nao encontrado.");
        }
        const result = await this.pool.query(`INSERT INTO tenant_platform_products (tenant_id, product_id, plan_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, uuid, tenant_id, product_id, plan_id, is_active, created_at`, [tenantId, productId, planId, input.is_active ?? true]);
        const row = result.rows[0];
        const [tenantRes, productRes, planRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]),
            this.pool.query("SELECT uuid FROM platform_products WHERE id = $1", [row.product_id]),
            this.pool.query("SELECT uuid FROM platform_plans WHERE id = $1", [row.plan_id])
        ]);
        return {
            ...row,
            tenant_id: tenantRes.rows[0]?.uuid,
            product_id: productRes.rows[0]?.uuid,
            plan_id: planRes.rows[0]?.uuid
        };
    }
    async listTenantPlatformProducts(tenantUuid) {
        const tenantId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "tenants", tenantUuid);
        if (!tenantId)
            return [];
        const result = await this.pool.query(`SELECT tpp.id, tpp.uuid, tpp.tenant_id, tpp.product_id, tpp.plan_id, tpp.is_active, tpp.created_at,
              t.uuid AS tenant_uuid, pp.uuid AS product_uuid, pl.uuid AS plan_uuid
       FROM tenant_platform_products tpp
       JOIN tenants t ON t.id = tpp.tenant_id
       JOIN platform_products pp ON pp.id = tpp.product_id
       JOIN platform_plans pl ON pl.id = tpp.plan_id
       WHERE tpp.tenant_id = $1 ORDER BY tpp.created_at DESC`, [tenantId]);
        return result.rows.map((r) => ({
            ...r,
            tenant_id: r.tenant_uuid,
            product_id: r.product_uuid,
            plan_id: r.plan_uuid
        }));
    }
    async getTenantPlatformProduct(tenantUuid, uuid) {
        const tenantId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "tenants", tenantUuid);
        if (!tenantId) {
            throw new common_1.NotFoundException("Tenant nao encontrado.");
        }
        const result = await this.pool.query(`SELECT tpp.id, tpp.uuid, tpp.tenant_id, tpp.product_id, tpp.plan_id, tpp.is_active, tpp.created_at,
              t.uuid AS tenant_uuid, pp.uuid AS product_uuid, pl.uuid AS plan_uuid
       FROM tenant_platform_products tpp
       JOIN tenants t ON t.id = tpp.tenant_id
       JOIN platform_products pp ON pp.id = tpp.product_id
       JOIN platform_plans pl ON pl.id = tpp.plan_id
       WHERE tpp.uuid = $1 AND tpp.tenant_id = $2`, [uuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto do tenant nao encontrado.");
        }
        const row = result.rows[0];
        return {
            ...row,
            tenant_id: row.tenant_uuid,
            product_id: row.product_uuid,
            plan_id: row.plan_uuid
        };
    }
    async updateTenantPlatformProduct(tenantUuid, uuid, input) {
        const tenantId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "tenants", tenantUuid);
        const productId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "platform_products", input.product_id);
        const planId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "platform_plans", input.plan_id);
        if (!tenantId || !productId || !planId) {
            throw new common_1.BadRequestException("Tenant, produto ou plano nao encontrado.");
        }
        const result = await this.pool.query(`UPDATE tenant_platform_products SET product_id = $3, plan_id = $4, is_active = $5
       WHERE uuid = $1 AND tenant_id = $2
       RETURNING id, uuid, tenant_id, product_id, plan_id, is_active, created_at`, [uuid, tenantId, productId, planId, input.is_active ?? true]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto do tenant nao encontrado.");
        }
        const row = result.rows[0];
        const [tenantRes, productRes, planRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]),
            this.pool.query("SELECT uuid FROM platform_products WHERE id = $1", [row.product_id]),
            this.pool.query("SELECT uuid FROM platform_plans WHERE id = $1", [row.plan_id])
        ]);
        return {
            ...row,
            tenant_id: tenantRes.rows[0]?.uuid,
            product_id: productRes.rows[0]?.uuid,
            plan_id: planRes.rows[0]?.uuid
        };
    }
    async deleteTenantPlatformProduct(tenantUuid, uuid) {
        const tenantId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "tenants", tenantUuid);
        if (!tenantId) {
            throw new common_1.NotFoundException("Tenant nao encontrado.");
        }
        const result = await this.pool.query("DELETE FROM tenant_platform_products WHERE uuid = $1 AND tenant_id = $2", [uuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Produto do tenant nao encontrado.");
        }
        return { status: "ok" };
    }
    async listTenantUsageMetrics(tenantUuid) {
        const tenantId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "tenants", tenantUuid);
        if (!tenantId)
            return [];
        const result = await this.pool.query(`SELECT tum.id, tum.uuid, tum.tenant_id, tum.metric_key, tum.metric_value, tum.period, tum.source, tum.created_at, t.uuid AS tenant_uuid
       FROM tenant_usage_metrics tum
       JOIN tenants t ON t.id = tum.tenant_id
       WHERE tum.tenant_id = $1 ORDER BY tum.created_at DESC`, [tenantId]);
        return result.rows.map((r) => ({ ...r, tenant_id: r.tenant_uuid }));
    }
    async createPermission(input) {
        const result = await this.pool.query(`INSERT INTO res_permissions (resource, action, description, created_at)
       VALUES ($1, $2, $3, now())
       RETURNING id, uuid, resource, action, description, created_at`, [input.resource, input.action, input.description ?? null]);
        return result.rows[0];
    }
    async listPermissions() {
        const result = await this.pool.query("SELECT id, uuid, resource, action, description, created_at FROM res_permissions ORDER BY resource, action");
        return result.rows;
    }
    async getPermission(uuid) {
        const result = await this.pool.query("SELECT id, uuid, resource, action, description, created_at FROM res_permissions WHERE uuid = $1", [uuid]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Permissao nao encontrada.");
        }
        return result.rows[0];
    }
    async updatePermission(uuid, input) {
        const result = await this.pool.query(`UPDATE res_permissions SET resource = $2, action = $3, description = $4 WHERE uuid = $1
       RETURNING id, uuid, resource, action, description, created_at`, [uuid, input.resource, input.action, input.description ?? null]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Permissao nao encontrada.");
        }
        return result.rows[0];
    }
    async deletePermission(uuid) {
        const result = await this.pool.query("DELETE FROM res_permissions WHERE uuid = $1", [uuid]);
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
