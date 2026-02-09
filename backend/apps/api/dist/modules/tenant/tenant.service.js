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
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_module_1 = require("../database/database.module");
const uuid_resolver_1 = require("../database/uuid-resolver");
let TenantService = class TenantService {
    constructor(pool) {
        this.pool = pool;
    }
    async resolveTenantId(tenantUuid) {
        const id = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "tenants", tenantUuid);
        if (!id)
            throw new common_1.NotFoundException("Tenant nao encontrado.");
        return id;
    }
    async createOrganization(tenantUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const createFirstUser = !!input.first_user_email?.trim() && !!input.first_user_password;
        let transactionOpen = false;
        try {
            await this.pool.query("BEGIN");
            transactionOpen = true;
            const orgResult = await this.pool.query(`INSERT INTO res_organizations (tenant_id, partner_id, name, is_default, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, now(), now())
         RETURNING id, uuid`, [tenantId, input.name, input.is_default ?? false]);
            const orgRow = orgResult.rows[0];
            const orgId = orgRow.id;
            const orgUuid = orgRow.uuid;
            const partnerName = (input.first_user_name ?? input.name)?.trim() || input.name;
            const partnerEmail = input.first_user_email?.trim() ?? null;
            const partnerResult = await this.pool.query(`INSERT INTO res_partners (tenant_id, organization_id, name, email, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now(), now())
         RETURNING id, uuid`, [tenantId, orgId, partnerName, partnerEmail]);
            const partnerRow = partnerResult.rows[0];
            await this.pool.query("UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3", [orgId, partnerRow.id, tenantId]);
            let user = null;
            if (createFirstUser) {
                const userEmail = input.first_user_email.trim();
                const existing = await this.pool.query("SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)", [tenantId, userEmail]);
                if ((existing.rowCount ?? 0) > 0) {
                    await this.pool.query("ROLLBACK");
                    transactionOpen = false;
                    throw new common_1.BadRequestException("Email ja cadastrado no tenant.");
                }
                const passwordHash = await bcrypt_1.default.hash(input.first_user_password, 12);
                const userResult = await this.pool.query(`INSERT INTO res_users
           (tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, TRUE, FALSE, TRUE, $5, now(), now())
           RETURNING id, uuid`, [tenantId, partnerRow.id, userEmail, passwordHash, orgId]);
                const userRow = userResult.rows[0];
                user = {
                    id: userRow.id,
                    uuid: userRow.uuid,
                    tenant_id: tenantUuid,
                    partner_id: partnerRow.uuid,
                    email: userEmail,
                    is_super_admin: true,
                    organization_id: orgUuid
                };
            }
            await this.pool.query("COMMIT");
            transactionOpen = false;
            const tenantUuidRes = await this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [tenantId]);
            const orgFull = await this.pool.query(`SELECT o.id, o.uuid, o.tenant_id, o.partner_id, o.name, o.is_default, o.created_at, o.updated_at, t.uuid AS tenant_uuid
         FROM res_organizations o
         JOIN tenants t ON t.id = o.tenant_id
         WHERE o.uuid = $1`, [orgUuid]);
            const org = orgFull.rows[0];
            return user ? { ...org, tenant_id: tenantUuidRes.rows[0]?.uuid ?? tenantUuid, user } : { ...org, tenant_id: tenantUuidRes.rows[0]?.uuid ?? tenantUuid };
        }
        catch (e) {
            if (transactionOpen)
                await this.pool.query("ROLLBACK");
            throw e;
        }
    }
    async listOrganizations(tenantUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`SELECT o.id, o.uuid, o.tenant_id, o.name, o.is_default, o.created_at, o.updated_at, t.uuid AS tenant_uuid
       FROM res_organizations o
       JOIN tenants t ON t.id = o.tenant_id
       WHERE o.tenant_id = $1 ORDER BY o.created_at DESC`, [tenantId]);
        return result.rows.map((r) => ({ ...r, tenant_id: r.tenant_uuid }));
    }
    async updateOrganization(tenantUuid, orgUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`UPDATE res_organizations
       SET name = $3, is_default = $4, updated_at = now()
       WHERE uuid = $1 AND tenant_id = $2
       RETURNING id, uuid, tenant_id, name, is_default, created_at, updated_at`, [orgUuid, tenantId, input.name, input.is_default ?? false]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        const row = result.rows[0];
        const tenantUuidRes = await this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]);
        return { ...row, tenant_id: tenantUuidRes.rows[0]?.uuid ?? tenantUuid };
    }
    async deleteOrganization(tenantUuid, orgUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query("DELETE FROM res_organizations WHERE uuid = $1 AND tenant_id = $2", [orgUuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        return { status: "ok" };
    }
    async createWorkspace(tenantUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const orgId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", input.organization_id);
        if (!orgId) {
            throw new common_1.BadRequestException("Organizacao invalida.");
        }
        const orgCheck = await this.pool.query("SELECT 1 FROM res_organizations WHERE id = $1 AND tenant_id = $2", [orgId, tenantId]);
        if (orgCheck.rowCount === 0) {
            throw new common_1.BadRequestException("Organizacao invalida.");
        }
        const result = await this.pool.query(`INSERT INTO res_workspaces (tenant_id, organization_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       RETURNING id, uuid, tenant_id, organization_id, name, created_at, updated_at`, [tenantId, orgId, input.name]);
        const row = result.rows[0];
        const [tRes, oRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]),
            this.pool.query("SELECT uuid FROM res_organizations WHERE id = $1", [row.organization_id])
        ]);
        return { ...row, tenant_id: tRes.rows[0]?.uuid, organization_id: oRes.rows[0]?.uuid };
    }
    async listWorkspaces(tenantUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`SELECT w.id, w.uuid, w.tenant_id, w.organization_id, w.name, w.created_at, w.updated_at, t.uuid AS tenant_uuid, o.uuid AS org_uuid
       FROM res_workspaces w
       JOIN tenants t ON t.id = w.tenant_id
       JOIN res_organizations o ON o.id = w.organization_id
       WHERE w.tenant_id = $1 ORDER BY w.created_at DESC`, [tenantId]);
        return result.rows.map((r) => ({ ...r, tenant_id: r.tenant_uuid, organization_id: r.org_uuid }));
    }
    async updateWorkspace(tenantUuid, wsUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const orgId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", input.organization_id);
        if (!orgId) {
            throw new common_1.BadRequestException("Organizacao invalida.");
        }
        const orgCheck = await this.pool.query("SELECT 1 FROM res_organizations WHERE id = $1 AND tenant_id = $2", [orgId, tenantId]);
        if (orgCheck.rowCount === 0) {
            throw new common_1.BadRequestException("Organizacao invalida.");
        }
        const result = await this.pool.query(`UPDATE res_workspaces
       SET organization_id = $3, name = $4, updated_at = now()
       WHERE uuid = $1 AND tenant_id = $2
       RETURNING id, uuid, tenant_id, organization_id, name, created_at, updated_at`, [wsUuid, tenantId, orgId, input.name]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Workspace nao encontrado.");
        }
        const row = result.rows[0];
        const [tRes, oRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]),
            this.pool.query("SELECT uuid FROM res_organizations WHERE id = $1", [row.organization_id])
        ]);
        return { ...row, tenant_id: tRes.rows[0]?.uuid, organization_id: oRes.rows[0]?.uuid };
    }
    async deleteWorkspace(tenantUuid, wsUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query("DELETE FROM res_workspaces WHERE uuid = $1 AND tenant_id = $2", [wsUuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Workspace nao encontrado.");
        }
        return { status: "ok" };
    }
    async createUser(tenantUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const existing = await this.pool.query("SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)", [tenantId, input.email]);
        if ((existing.rowCount ?? 0) > 0) {
            throw new common_1.BadRequestException("Email ja cadastrado no tenant.");
        }
        const hasPartnerId = !!input.partner_id?.trim();
        const createPartner = !hasPartnerId && !!input.organization_id?.trim();
        if (!hasPartnerId && !createPartner) {
            throw new common_1.BadRequestException("Informe partner_id ou organization_id para criar o contato (partner) do usuario.");
        }
        let orgId = null;
        if (createPartner) {
            orgId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", input.organization_id);
            if (!orgId) {
                throw new common_1.BadRequestException("Organizacao invalida ou nao pertence ao tenant.");
            }
            const orgCheck = await this.pool.query("SELECT 1 FROM res_organizations WHERE id = $1 AND tenant_id = $2", [orgId, tenantId]);
            if (orgCheck.rowCount === 0) {
                throw new common_1.BadRequestException("Organizacao invalida ou nao pertence ao tenant.");
            }
        }
        const passwordHash = input.password ? await bcrypt_1.default.hash(input.password, 12) : null;
        if (createPartner && orgId) {
            const partnerName = (input.name ?? input.email).trim();
            await this.pool.query("BEGIN");
            try {
                await this.pool.query(`INSERT INTO res_users
           (tenant_id, partner_id, email, password_hash, is_active, organization_id, created_at, updated_at)
           VALUES ($1, NULL, $2, $3, $4, $5, now(), now())`, [tenantId, input.email, passwordHash, input.is_active ?? true, orgId]);
                const userSel = await this.pool.query("SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)", [tenantId, input.email]);
                const userId = userSel.rows[0].id;
                const partnerResult = await this.pool.query(`INSERT INTO res_partners (tenant_id, organization_id, name, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, now(), now())
           RETURNING id, uuid`, [tenantId, orgId, partnerName, input.email]);
                const partnerId = partnerResult.rows[0].id;
                await this.pool.query("UPDATE res_users SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3", [userId, partnerId, tenantId]);
                await this.pool.query("COMMIT");
            }
            catch (e) {
                await this.pool.query("ROLLBACK");
                throw e;
            }
            const result = await this.pool.query(`SELECT u.id, u.uuid, u.tenant_id, u.partner_id, u.email, u.is_active, u.organization_id, u.created_at, u.updated_at,
                t.uuid AS tenant_uuid, p.uuid AS partner_uuid, o.uuid AS org_uuid
         FROM res_users u
         JOIN tenants t ON t.id = u.tenant_id
         LEFT JOIN res_partners p ON p.id = u.partner_id
         LEFT JOIN res_organizations o ON o.id = u.organization_id
         WHERE u.tenant_id = $1 AND LOWER(u.email) = LOWER($2)`, [tenantId, input.email]);
            const row = result.rows[0];
            return { ...row, tenant_id: row.tenant_uuid, partner_id: row.partner_uuid, organization_id: row.org_uuid };
        }
        const partnerId = input.partner_id ? await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_partners", input.partner_id) : null;
        const result = await this.pool.query(`INSERT INTO res_users
       (tenant_id, partner_id, email, password_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       RETURNING id, uuid, tenant_id, partner_id, email, is_active, created_at, updated_at`, [tenantId, partnerId, input.email, passwordHash, input.is_active ?? true]);
        const row = result.rows[0];
        const [tRes, pRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]),
            row.partner_id ? this.pool.query("SELECT uuid FROM res_partners WHERE id = $1", [row.partner_id]) : Promise.resolve({ rows: [] })
        ]);
        return { ...row, tenant_id: tRes.rows[0]?.uuid, partner_id: pRes.rows[0]?.uuid ?? null };
    }
    async listUsers(tenantUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`SELECT u.id, u.uuid, u.tenant_id, u.partner_id, u.email, u.is_active, u.created_at, u.updated_at, t.uuid AS tenant_uuid, p.uuid AS partner_uuid
       FROM res_users u
       JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN res_partners p ON p.id = u.partner_id
       WHERE u.tenant_id = $1 ORDER BY u.created_at DESC`, [tenantId]);
        return result.rows.map((r) => ({ ...r, tenant_id: r.tenant_uuid, partner_id: r.partner_uuid ?? null }));
    }
    async updateUser(tenantUuid, userUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const partnerId = input.partner_id ? await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_partners", input.partner_id) : null;
        const result = await this.pool.query(`UPDATE res_users
       SET partner_id = $3, email = $4, is_active = $5, updated_at = now()
       WHERE uuid = $1 AND tenant_id = $2
       RETURNING id, uuid, tenant_id, partner_id, email, is_active, created_at, updated_at`, [userUuid, tenantId, partnerId, input.email, input.is_active ?? true]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const row = result.rows[0];
        const [tRes, pRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]),
            row.partner_id ? this.pool.query("SELECT uuid FROM res_partners WHERE id = $1", [row.partner_id]) : Promise.resolve({ rows: [] })
        ]);
        return { ...row, tenant_id: tRes.rows[0]?.uuid, partner_id: pRes.rows[0]?.uuid ?? null };
    }
    async deleteUser(tenantUuid, userUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query("DELETE FROM res_users WHERE uuid = $1 AND tenant_id = $2", [userUuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        return { status: "ok" };
    }
    async updateUserPassword(tenantUuid, userUuid, password) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const passwordHash = await bcrypt_1.default.hash(password, 12);
        const result = await this.pool.query(`UPDATE res_users
       SET password_hash = $3, updated_at = now()
       WHERE uuid = $1 AND tenant_id = $2`, [userUuid, tenantId, passwordHash]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        return { status: "ok" };
    }
    async updateUserStatus(tenantUuid, userUuid, isActive) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`UPDATE res_users
       SET is_active = $3, updated_at = now()
       WHERE uuid = $1 AND tenant_id = $2`, [userUuid, tenantId, isActive]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        return { status: "ok" };
    }
    async createPartner(tenantUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const orgId = input.organization_id ? await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", input.organization_id) : null;
        if (input.organization_id && !orgId) {
            throw new common_1.BadRequestException("Organizacao nao encontrada.");
        }
        if (orgId) {
            const orgCheck = await this.pool.query("SELECT 1 FROM res_organizations WHERE id = $1 AND tenant_id = $2", [orgId, tenantId]);
            if (orgCheck.rowCount === 0) {
                throw new common_1.BadRequestException("Organizacao nao pertence ao tenant.");
            }
        }
        const result = await this.pool.query(`INSERT INTO res_partners (tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
       RETURNING id, uuid, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at`, [
            tenantId,
            orgId,
            input.name,
            input.email ?? null,
            input.telephone ?? null,
            input.type ?? null,
            input.document ?? null,
            input.location_address ?? null,
            input.location_address_number ?? null,
            input.location_address_zip ?? null
        ]);
        const row = result.rows[0];
        const [tRes, oRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]),
            row.organization_id ? this.pool.query("SELECT uuid FROM res_organizations WHERE id = $1", [row.organization_id]) : Promise.resolve({ rows: [] })
        ]);
        return { ...row, tenant_id: tRes.rows[0]?.uuid, organization_id: oRes.rows[0]?.uuid ?? null };
    }
    async listPartners(tenantUuid, organizationUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const orgId = organizationUuid ? await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", organizationUuid) : null;
        if (organizationUuid && !orgId)
            return [];
        const result = await this.pool.query(`SELECT p.id, p.uuid, p.tenant_id, p.organization_id, p.name, p.email, p.telephone, p.type, p.document, p.location_address, p.location_address_number, p.location_address_zip, p.created_at, p.updated_at,
              t.uuid AS tenant_uuid, o.uuid AS org_uuid
       FROM res_partners p
       JOIN tenants t ON t.id = p.tenant_id
       LEFT JOIN res_organizations o ON o.id = p.organization_id
       WHERE p.tenant_id = $1 ${orgId ? "AND p.organization_id = $2" : ""} ORDER BY p.created_at DESC`, orgId ? [tenantId, orgId] : [tenantId]);
        return result.rows.map((r) => ({ ...r, tenant_id: r.tenant_uuid, organization_id: r.org_uuid ?? null }));
    }
    async getPartner(tenantUuid, partnerUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`SELECT p.id, p.uuid, p.tenant_id, p.organization_id, p.name, p.email, p.telephone, p.type, p.document, p.location_address, p.location_address_number, p.location_address_zip, p.created_at, p.updated_at,
              t.uuid AS tenant_uuid, o.uuid AS org_uuid
       FROM res_partners p
       JOIN tenants t ON t.id = p.tenant_id
       LEFT JOIN res_organizations o ON o.id = p.organization_id
       WHERE p.uuid = $1 AND p.tenant_id = $2`, [partnerUuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Contato nao encontrado.");
        }
        const row = result.rows[0];
        return { ...row, tenant_id: row.tenant_uuid, organization_id: row.org_uuid ?? null };
    }
    async updatePartner(tenantUuid, partnerUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const orgId = input.organization_id ? await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", input.organization_id) : null;
        const result = await this.pool.query(`UPDATE res_partners
       SET organization_id = $3, name = $4, email = $5, telephone = $6, type = $7, document = $8,
           location_address = $9, location_address_number = $10, location_address_zip = $11, updated_at = now()
       WHERE uuid = $1 AND tenant_id = $2
       RETURNING id, uuid, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at`, [
            partnerUuid,
            tenantId,
            orgId,
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
        const row = result.rows[0];
        const [tRes, oRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]),
            row.organization_id ? this.pool.query("SELECT uuid FROM res_organizations WHERE id = $1", [row.organization_id]) : Promise.resolve({ rows: [] })
        ]);
        return { ...row, tenant_id: tRes.rows[0]?.uuid, organization_id: oRes.rows[0]?.uuid ?? null };
    }
    async deletePartner(tenantUuid, partnerUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query("DELETE FROM res_partners WHERE uuid = $1 AND tenant_id = $2", [partnerUuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Contato nao encontrado.");
        }
        return { status: "ok" };
    }
    async createRole(tenantUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`INSERT INTO res_roles (tenant_id, name, description, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       RETURNING id, uuid, tenant_id, name, description, created_at, updated_at`, [tenantId, input.name, input.description ?? null]);
        const row = result.rows[0];
        const tRes = await this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]);
        return { ...row, tenant_id: tRes.rows[0]?.uuid };
    }
    async listRoles(tenantUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`SELECT r.id, r.uuid, r.tenant_id, r.name, r.description, r.created_at, r.updated_at, t.uuid AS tenant_uuid
       FROM res_roles r
       JOIN tenants t ON t.id = r.tenant_id
       WHERE r.tenant_id = $1 ORDER BY r.created_at DESC`, [tenantId]);
        return result.rows.map((r) => ({ ...r, tenant_id: r.tenant_uuid }));
    }
    async getRole(tenantUuid, roleUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`SELECT r.id, r.uuid, r.tenant_id, r.name, r.description, r.created_at, r.updated_at, t.uuid AS tenant_uuid
       FROM res_roles r
       JOIN tenants t ON t.id = r.tenant_id
       WHERE r.uuid = $1 AND r.tenant_id = $2`, [roleUuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Regra nao encontrada.");
        }
        const row = result.rows[0];
        return { ...row, tenant_id: row.tenant_uuid };
    }
    async updateRole(tenantUuid, roleUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query(`UPDATE res_roles SET name = $3, description = $4, updated_at = now()
       WHERE uuid = $1 AND tenant_id = $2
       RETURNING id, uuid, tenant_id, name, description, created_at, updated_at`, [roleUuid, tenantId, input.name, input.description ?? null]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Regra nao encontrada.");
        }
        const row = result.rows[0];
        const tRes = await this.pool.query("SELECT uuid FROM tenants WHERE id = $1", [row.tenant_id]);
        return { ...row, tenant_id: tRes.rows[0]?.uuid };
    }
    async deleteRole(tenantUuid, roleUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const result = await this.pool.query("DELETE FROM res_roles WHERE uuid = $1 AND tenant_id = $2", [roleUuid, tenantId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Regra nao encontrada.");
        }
        return { status: "ok" };
    }
    async listUserRoles(tenantUuid, userUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const userId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_users", userUuid);
        if (!userId) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const userCheck = await this.pool.query("SELECT 1 FROM res_users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]);
        if (userCheck.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const result = await this.pool.query(`SELECT ur.id, ur.uuid, ur.user_id, ur.role_id, ur.scope_type, ur.scope_id, ur.created_at, r.name as role_name, u.uuid AS user_uuid, r.uuid AS role_uuid
       FROM res_user_roles ur
       JOIN res_roles r ON r.id = ur.role_id AND r.tenant_id = $1
       JOIN res_users u ON u.id = ur.user_id
       WHERE ur.user_id = $2`, [tenantId, userId]);
        return result.rows.map((r) => ({ ...r, user_id: r.user_uuid, role_id: r.role_uuid }));
    }
    async addUserRole(tenantUuid, userUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const userId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_users", userUuid);
        const roleId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_roles", input.role_id);
        if (!userId || !roleId) {
            throw new common_1.NotFoundException("Usuario ou regra nao encontrado.");
        }
        const roleCheck = await this.pool.query("SELECT 1 FROM res_roles WHERE id = $1 AND tenant_id = $2", [roleId, tenantId]);
        if (roleCheck.rowCount === 0) {
            throw new common_1.BadRequestException("Regra invalida.");
        }
        const scopeId = input.scope_id ? await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "tenants", input.scope_id) ?? await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", input.scope_id) : null;
        const result = await this.pool.query(`INSERT INTO res_user_roles (user_id, role_id, scope_type, scope_id, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, uuid, user_id, role_id, scope_type, scope_id, created_at`, [userId, roleId, input.scope_type ?? null, scopeId]);
        const row = result.rows[0];
        const [uRes, rRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM res_users WHERE id = $1", [row.user_id]),
            this.pool.query("SELECT uuid FROM res_roles WHERE id = $1", [row.role_id])
        ]);
        return { ...row, user_id: uRes.rows[0]?.uuid, role_id: rRes.rows[0]?.uuid };
    }
    async removeUserRole(tenantUuid, userUuid, roleUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const userId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_users", userUuid);
        const roleId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_roles", roleUuid);
        if (!userId || !roleId) {
            throw new common_1.NotFoundException("Vinculo nao encontrado.");
        }
        const result = await this.pool.query(`DELETE FROM res_user_roles ur
       USING res_roles r
       WHERE ur.role_id = r.id AND r.tenant_id = $1 AND ur.user_id = $2 AND ur.role_id = $3`, [tenantId, userId, roleId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Vinculo nao encontrado.");
        }
        return { status: "ok" };
    }
    async listUserPermissionOverrides(tenantUuid, userUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const userId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_users", userUuid);
        if (!userId) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const userCheck = await this.pool.query("SELECT 1 FROM res_users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]);
        if (userCheck.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const result = await this.pool.query(`SELECT o.id, o.uuid, o.user_id, o.permission_id, o.effect, o.created_at, p.resource, p.action, u.uuid AS user_uuid, p.uuid AS permission_uuid
       FROM res_user_permission_overrides o
       JOIN res_permissions p ON p.id = o.permission_id
       JOIN res_users u ON u.id = o.user_id
       WHERE o.user_id = $1`, [userId]);
        return result.rows.map((r) => ({ ...r, user_id: r.user_uuid, permission_id: r.permission_uuid }));
    }
    async addUserPermissionOverride(tenantUuid, userUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const userId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_users", userUuid);
        const permissionId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_permissions", input.permission_id);
        if (!userId || !permissionId) {
            throw new common_1.NotFoundException("Usuario ou permissao nao encontrado.");
        }
        const userCheck = await this.pool.query("SELECT 1 FROM res_users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]);
        if (userCheck.rowCount === 0) {
            throw new common_1.NotFoundException("Usuario nao encontrado.");
        }
        const result = await this.pool.query(`INSERT INTO res_user_permission_overrides (user_id, permission_id, effect, created_at)
       VALUES ($1, $2, $3, now())
       RETURNING id, uuid, user_id, permission_id, effect, created_at`, [userId, permissionId, input.effect]);
        const row = result.rows[0];
        const [uRes, pRes] = await Promise.all([
            this.pool.query("SELECT uuid FROM res_users WHERE id = $1", [row.user_id]),
            this.pool.query("SELECT uuid FROM res_permissions WHERE id = $1", [row.permission_id])
        ]);
        return { ...row, user_id: uRes.rows[0]?.uuid, permission_id: pRes.rows[0]?.uuid };
    }
    async removeUserPermissionOverride(tenantUuid, userUuid, permissionUuid) {
        const userId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_users", userUuid);
        const permissionId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_permissions", permissionUuid);
        if (!userId || !permissionId) {
            throw new common_1.NotFoundException("Override nao encontrado.");
        }
        const result = await this.pool.query("DELETE FROM res_user_permission_overrides WHERE user_id = $1 AND permission_id = $2", [userId, permissionId]);
        if (result.rowCount === 0) {
            throw new common_1.NotFoundException("Override nao encontrado.");
        }
        return { status: "ok" };
    }
    async getOrganizationSettings(tenantUuid, organizationUuid) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const orgId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", organizationUuid);
        if (!orgId) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        const orgCheck = await this.pool.query("SELECT 1 FROM res_organizations WHERE id = $1 AND tenant_id = $2", [orgId, tenantId]);
        if (orgCheck.rowCount === 0) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        const result = await this.pool.query(`SELECT s.id, s.uuid, s.organization_id, s.workspace_mode, s.remember_last_context, s.menu_cache_ttl, s.enable_mfa, s.enable_oauth, s.created_at, s.updated_at, o.uuid AS org_uuid
       FROM res_organization_settings s
       JOIN res_organizations o ON o.id = s.organization_id
       WHERE s.organization_id = $1`, [orgId]);
        if (result.rowCount === 0) {
            return null;
        }
        const row = result.rows[0];
        return { ...row, organization_id: row.org_uuid };
    }
    async setOrganizationSettings(tenantUuid, organizationUuid, input) {
        const tenantId = await this.resolveTenantId(tenantUuid);
        const orgId = await (0, uuid_resolver_1.resolveUuidToId)(this.pool, "res_organizations", organizationUuid);
        if (!orgId) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        const orgCheck = await this.pool.query("SELECT 1 FROM res_organizations WHERE id = $1 AND tenant_id = $2", [orgId, tenantId]);
        if (orgCheck.rowCount === 0) {
            throw new common_1.NotFoundException("Organizacao nao encontrada.");
        }
        const existing = await this.pool.query("SELECT id FROM res_organization_settings WHERE organization_id = $1", [orgId]);
        if (existing.rowCount === 0) {
            const result = await this.pool.query(`INSERT INTO res_organization_settings (organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         RETURNING id, uuid, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at`, [
                orgId,
                input.workspace_mode ?? null,
                input.remember_last_context ?? null,
                input.menu_cache_ttl ?? null,
                input.enable_mfa ?? null,
                input.enable_oauth ?? null
            ]);
            const row = result.rows[0];
            const oRes = await this.pool.query("SELECT uuid FROM res_organizations WHERE id = $1", [row.organization_id]);
            return { ...row, organization_id: oRes.rows[0]?.uuid };
        }
        const result = await this.pool.query(`UPDATE res_organization_settings
       SET workspace_mode = $2, remember_last_context = $3, menu_cache_ttl = $4, enable_mfa = $5, enable_oauth = $6, updated_at = now()
       WHERE organization_id = $1
       RETURNING id, uuid, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at`, [
            orgId,
            input.workspace_mode ?? null,
            input.remember_last_context ?? null,
            input.menu_cache_ttl ?? null,
            input.enable_mfa ?? null,
            input.enable_oauth ?? null
        ]);
        const row = result.rows[0];
        const oRes = await this.pool.query("SELECT uuid FROM res_organizations WHERE id = $1", [row.organization_id]);
        return { ...row, organization_id: oRes.rows[0]?.uuid };
    }
};
exports.TenantService = TenantService;
exports.TenantService = TenantService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], TenantService);
