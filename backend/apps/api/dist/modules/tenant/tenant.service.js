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
exports.TenantService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const crypto_1 = require("crypto");
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_module_1 = require("../database/database.module");
let TenantService = class TenantService {
    constructor(pool) {
        this.pool = pool;
    }
    async createOrganization(tenantId, input) {
        const orgId = (0, crypto_1.randomUUID)();
        const createFirstUser = !!input.first_user_email?.trim() && !!input.first_user_password;
        let transactionOpen = false;
        try {
            await this.pool.query("BEGIN");
            transactionOpen = true;
            await this.pool.query(`INSERT INTO res_organizations (id, tenant_id, partner_id, name, is_default, created_at, updated_at)
         VALUES ($1, $2, NULL, $3, $4, now(), now())`, [orgId, tenantId, input.name, input.is_default ?? false]);
            const partnerName = (input.first_user_name ?? input.name)?.trim() || input.name;
            const partnerEmail = input.first_user_email?.trim() ?? null;
            const partnerId = (0, crypto_1.randomUUID)();
            await this.pool.query(`INSERT INTO res_partners (id, tenant_id, organization_id, name, email, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, now(), now())`, [partnerId, tenantId, orgId, partnerName, partnerEmail]);
            await this.pool.query("UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3", [orgId, partnerId, tenantId]);
            let user = null;
            if (createFirstUser) {
                const userEmail = input.first_user_email.trim();
                const existing = await this.pool.query("SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)", [tenantId, userEmail]);
                if ((existing.rowCount ?? 0) > 0) {
                    await this.pool.query("ROLLBACK");
                    transactionOpen = false;
                    throw new common_1.BadRequestException("Email ja cadastrado no tenant.");
                }
                const userId = (0, crypto_1.randomUUID)();
                const passwordHash = await bcrypt_1.default.hash(input.first_user_password, 12);
                await this.pool.query(`INSERT INTO res_users
           (id, tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, FALSE, TRUE, $6, now(), now())`, [userId, tenantId, partnerId, userEmail, passwordHash, orgId]);
                user = {
                    id: userId,
                    tenant_id: tenantId,
                    partner_id: partnerId,
                    email: userEmail,
                    is_super_admin: true,
                    organization_id: orgId
                };
            }
            await this.pool.query("COMMIT");
            transactionOpen = false;
            const orgRow = await this.pool.query(`SELECT id, tenant_id, partner_id, name, is_default, created_at, updated_at
         FROM res_organizations WHERE id = $1`, [orgId]);
            const org = orgRow.rows[0];
            return user ? { ...org, user } : org;
        }
        catch (e) {
            if (transactionOpen)
                await this.pool.query("ROLLBACK");
            throw e;
        }
    }
    async listOrganizations(tenantId) {
        const result = await this.pool.query("SELECT id, tenant_id, name, is_default, created_at, updated_at FROM res_organizations WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
        return result.rows;
    }
    async updateOrganization(tenantId, id, input) {
        const result = await this.pool.query(`UPDATE res_organizations
       SET name = $3, is_default = $4, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, name, is_default, created_at, updated_at`, [id, tenantId, input.name, input.is_default ?? false]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        return result.rows[0];
    }
    async deleteOrganization(tenantId, id) {
        const result = await this.pool.query("DELETE FROM res_organizations WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        return { status: "ok" };
    }
    async createWorkspace(tenantId, input) {
        const org = await this.pool.query("SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2", [input.organization_id, tenantId]);
        if (org.rowCount === 0) {
            throw new common_1.BadRequestException("Organizacao invalida.");
        }
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO res_workspaces (id, tenant_id, organization_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, tenant_id, organization_id, name, created_at, updated_at`, [id, tenantId, input.organization_id, input.name]);
        return result.rows[0];
    }
    async listWorkspaces(tenantId) {
        const result = await this.pool.query("SELECT id, tenant_id, organization_id, name, created_at, updated_at FROM res_workspaces WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
        return result.rows;
    }
    async updateWorkspace(tenantId, id, input) {
        const org = await this.pool.query("SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2", [input.organization_id, tenantId]);
        if (org.rowCount === 0) {
            throw new common_1.BadRequestException("Organizacao invalida.");
        }
        const result = await this.pool.query(`UPDATE res_workspaces
       SET organization_id = $3, name = $4, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, organization_id, name, created_at, updated_at`, [id, tenantId, input.organization_id, input.name]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Workspace nao encontrado.");
        }
        return result.rows[0];
    }
    async deleteWorkspace(tenantId, id) {
        const result = await this.pool.query("DELETE FROM res_workspaces WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Workspace nao encontrado.");
        }
        return { status: "ok" };
    }
    async createUser(tenantId, input) {
        const existing = await this.pool.query("SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)", [tenantId, input.email]);
        if ((existing.rowCount ?? 0) > 0) {
            throw new common_1.BadRequestException("Email ja cadastrado no tenant.");
        }
        const hasPartnerId = !!input.partner_id?.trim();
        const createPartner = !hasPartnerId && !!input.organization_id?.trim();
        if (!hasPartnerId && !createPartner) {
            throw new common_1.BadRequestException("Informe partner_id ou organization_id para criar o contato (partner) do usuario.");
        }
        if (createPartner) {
            const org = await this.pool.query("SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2", [input.organization_id, tenantId]);
            if ((org.rowCount ?? 0) === 0) {
                throw new common_1.BadRequestException("Organizacao invalida ou nao pertence ao tenant.");
            }
        }
        const userId = (0, crypto_1.randomUUID)();
        const passwordHash = input.password ? await bcrypt_1.default.hash(input.password, 12) : null;
        if (createPartner) {
            const organizationId = input.organization_id.trim();
            const partnerName = (input.name ?? input.email).trim();
            const partnerId = (0, crypto_1.randomUUID)();
            await this.pool.query("BEGIN");
            try {
                await this.pool.query(`INSERT INTO res_users
           (id, tenant_id, partner_id, email, password_hash, is_active, organization_id, created_at, updated_at)
           VALUES ($1, $2, NULL, $3, $4, $5, $6, now(), now())`, [userId, tenantId, input.email, passwordHash, input.is_active ?? true, organizationId]);
                await this.pool.query(`INSERT INTO res_partners (id, tenant_id, organization_id, name, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, now(), now())`, [partnerId, tenantId, organizationId, partnerName, input.email]);
                await this.pool.query("UPDATE res_users SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3", [userId, partnerId, tenantId]);
                await this.pool.query("COMMIT");
            }
            catch (e) {
                await this.pool.query("ROLLBACK");
                throw e;
            }
            const result = await this.pool.query(`SELECT id, tenant_id, partner_id, email, is_active, organization_id, created_at, updated_at
         FROM res_users WHERE id = $1`, [userId]);
            return result.rows[0];
        }
        const result = await this.pool.query(`INSERT INTO res_users
       (id, tenant_id, partner_id, email, password_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING id, tenant_id, partner_id, email, is_active, created_at, updated_at`, [
            userId,
            tenantId,
            input.partner_id ?? null,
            input.email,
            passwordHash,
            input.is_active ?? true
        ]);
        return result.rows[0];
    }
    async listUsers(tenantId) {
        const result = await this.pool.query("SELECT id, tenant_id, partner_id, email, is_active, created_at, updated_at FROM res_users WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
        return result.rows;
    }
    async updateUser(tenantId, id, input) {
        const result = await this.pool.query(`UPDATE res_users
       SET partner_id = $3, email = $4, is_active = $5, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, partner_id, email, is_active, created_at, updated_at`, [id, tenantId, input.partner_id ?? null, input.email, input.is_active ?? true]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        return result.rows[0];
    }
    async deleteUser(tenantId, id) {
        const result = await this.pool.query("DELETE FROM res_users WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        return { status: "ok" };
    }
    async updateUserPassword(tenantId, id, password) {
        const passwordHash = await bcrypt_1.default.hash(password, 12);
        const result = await this.pool.query(`UPDATE res_users
       SET password_hash = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`, [id, tenantId, passwordHash]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        return { status: "ok" };
    }
    async updateUserStatus(tenantId, id, isActive) {
        const result = await this.pool.query(`UPDATE res_users
       SET is_active = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`, [id, tenantId, isActive]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        return { status: "ok" };
    }
    async createPartner(tenantId, input) {
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO res_partners (id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
       RETURNING id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at`, [
            id,
            tenantId,
            input.organization_id ?? null,
            input.name,
            input.email ?? null,
            input.telephone ?? null,
            input.type ?? null,
            input.document ?? null,
            input.location_address ?? null,
            input.location_address_number ?? null,
            input.location_address_zip ?? null
        ]);
        return result.rows[0];
    }
    async listPartners(tenantId, organizationId) {
        if (organizationId) {
            const result = await this.pool.query(`SELECT id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at
         FROM res_partners WHERE tenant_id = $1 AND organization_id = $2 ORDER BY created_at DESC`, [tenantId, organizationId]);
            return result.rows;
        }
        const result = await this.pool.query(`SELECT id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at
       FROM res_partners WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
        return result.rows;
    }
    async getPartner(tenantId, id) {
        const result = await this.pool.query(`SELECT id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at
       FROM res_partners WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Contato nao encontrado.");
        }
        return result.rows[0];
    }
    async updatePartner(tenantId, id, input) {
        const result = await this.pool.query(`UPDATE res_partners
       SET organization_id = $3, name = $4, email = $5, telephone = $6, type = $7, document = $8,
           location_address = $9, location_address_number = $10, location_address_zip = $11, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at`, [
            id,
            tenantId,
            input.organization_id ?? null,
            input.name,
            input.email ?? null,
            input.telephone ?? null,
            input.type ?? null,
            input.document ?? null,
            input.location_address ?? null,
            input.location_address_number ?? null,
            input.location_address_zip ?? null
        ]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Contato nao encontrado.");
        }
        return result.rows[0];
    }
    async deletePartner(tenantId, id) {
        const result = await this.pool.query("DELETE FROM res_partners WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Contato nao encontrado.");
        }
        return { status: "ok" };
    }
    async createRole(tenantId, input) {
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO res_roles (id, tenant_id, name, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, tenant_id, name, description, created_at, updated_at`, [id, tenantId, input.name, input.description ?? null]);
        return result.rows[0];
    }
    async listRoles(tenantId) {
        const result = await this.pool.query("SELECT id, tenant_id, name, description, created_at, updated_at FROM res_roles WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
        return result.rows;
    }
    async getRole(tenantId, id) {
        const result = await this.pool.query("SELECT id, tenant_id, name, description, created_at, updated_at FROM res_roles WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Regra nao encontrada.");
        }
        return result.rows[0];
    }
    async updateRole(tenantId, id, input) {
        const result = await this.pool.query(`UPDATE res_roles SET name = $3, description = $4, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, name, description, created_at, updated_at`, [id, tenantId, input.name, input.description ?? null]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Regra nao encontrada.");
        }
        return result.rows[0];
    }
    async deleteRole(tenantId, id) {
        const result = await this.pool.query("DELETE FROM res_roles WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Regra nao encontrada.");
        }
        return { status: "ok" };
    }
    async listUserRoles(tenantId, userId) {
        const user = await this.pool.query("SELECT id FROM res_users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]);
        if (user.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const result = await this.pool.query(`SELECT ur.id, ur.user_id, ur.role_id, ur.scope_type, ur.scope_id, ur.created_at, r.name as role_name
       FROM res_user_roles ur
       JOIN res_roles r ON r.id = ur.role_id AND r.tenant_id = $1
       WHERE ur.user_id = $2`, [tenantId, userId]);
        return result.rows;
    }
    async addUserRole(tenantId, userId, input) {
        const user = await this.pool.query("SELECT id FROM res_users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]);
        if (user.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const role = await this.pool.query("SELECT id FROM res_roles WHERE id = $1 AND tenant_id = $2", [input.role_id, tenantId]);
        if (role.rowCount === 0) {
            throw new common_1.BadRequestException("Regra invalida.");
        }
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO res_user_roles (id, user_id, role_id, scope_type, scope_id, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, user_id, role_id, scope_type, scope_id, created_at`, [id, userId, input.role_id, input.scope_type ?? null, input.scope_id ?? null]);
        return result.rows[0];
    }
    async removeUserRole(tenantId, userId, roleId) {
        const result = await this.pool.query(`DELETE FROM res_user_roles ur
       USING res_roles r
       WHERE ur.role_id = r.id AND r.tenant_id = $1 AND ur.user_id = $2 AND ur.role_id = $3`, [tenantId, userId, roleId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Vinculo nao encontrado.");
        }
        return { status: "ok" };
    }
    async listUserPermissionOverrides(tenantId, userId) {
        const user = await this.pool.query("SELECT id FROM res_users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]);
        if (user.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const result = await this.pool.query(`SELECT o.id, o.user_id, o.permission_id, o.effect, o.created_at, p.resource, p.action
       FROM res_user_permission_overrides o
       JOIN res_permissions p ON p.id = o.permission_id
       WHERE o.user_id = $1`, [userId]);
        return result.rows;
    }
    async addUserPermissionOverride(tenantId, userId, input) {
        const user = await this.pool.query("SELECT id FROM res_users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]);
        if (user.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const id = (0, crypto_1.randomUUID)();
        const result = await this.pool.query(`INSERT INTO res_user_permission_overrides (id, user_id, permission_id, effect, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, user_id, permission_id, effect, created_at`, [id, userId, input.permission_id, input.effect]);
        return result.rows[0];
    }
    async removeUserPermissionOverride(tenantId, userId, permissionId) {
        const result = await this.pool.query("DELETE FROM res_user_permission_overrides WHERE user_id = $1 AND permission_id = $2", [userId, permissionId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Override nao encontrado.");
        }
        return { status: "ok" };
    }
    async getOrganizationSettings(tenantId, organizationId) {
        const org = await this.pool.query("SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2", [organizationId, tenantId]);
        if (org.rowCount === 0) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        const result = await this.pool.query(`SELECT id, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at
       FROM res_organization_settings WHERE organization_id = $1`, [organizationId]);
        if (result.rowCount === 0) {
            return null;
        }
        return result.rows[0];
    }
    async setOrganizationSettings(tenantId, organizationId, input) {
        const org = await this.pool.query("SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2", [organizationId, tenantId]);
        if (org.rowCount === 0) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        const existing = await this.pool.query("SELECT id FROM res_organization_settings WHERE organization_id = $1", [organizationId]);
        if (existing.rowCount === 0) {
            const id = (0, crypto_1.randomUUID)();
            const result = await this.pool.query(`INSERT INTO res_organization_settings (id, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
         RETURNING id, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at`, [
                id,
                organizationId,
                input.workspace_mode ?? null,
                input.remember_last_context ?? null,
                input.menu_cache_ttl ?? null,
                input.enable_mfa ?? null,
                input.enable_oauth ?? null
            ]);
            return result.rows[0];
        }
        const result = await this.pool.query(`UPDATE res_organization_settings
       SET workspace_mode = $2, remember_last_context = $3, menu_cache_ttl = $4, enable_mfa = $5, enable_oauth = $6, updated_at = now()
       WHERE organization_id = $1
       RETURNING id, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at`, [
            organizationId,
            input.workspace_mode ?? null,
            input.remember_last_context ?? null,
            input.menu_cache_ttl ?? null,
            input.enable_mfa ?? null,
            input.enable_oauth ?? null
        ]);
        return result.rows[0];
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], TenantService);
