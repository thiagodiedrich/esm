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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthContextService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
let AuthContextService = class AuthContextService {
    constructor(pool) {
        this.pool = pool;
    }
    async resolveLoginContext(tenantUuid, userUuid) {
        const lastContext = await this.getUserLastContext(userUuid);
        if (lastContext?.organization_uuid) {
            const settings = await this.getOrganizationSettings(lastContext.organization_uuid);
            if (settings?.remember_last_context) {
                await this.ensureWorkspaceRequirement(lastContext.organization_uuid, lastContext.workspace_uuid);
                return {
                    organizationId: lastContext.organization_uuid,
                    workspaceId: lastContext.workspace_uuid
                };
            }
        }
        const defaultOrgUuid = await this.getDefaultOrganization(tenantUuid);
        if (!defaultOrgUuid) {
            throw new common_1.BadRequestException("Organizacao padrao nao configurada.");
        }
        await this.ensureWorkspaceRequirement(defaultOrgUuid, null);
        return { organizationId: defaultOrgUuid, workspaceId: null };
    }
    async switchContext(params) {
        const belongs = await this.organizationBelongsToTenant(params.organizationId, params.tenantId);
        if (!belongs) {
            throw new common_1.BadRequestException("Organizacao invalida para o tenant.");
        }
        if (params.workspaceId) {
            const validWorkspace = await this.workspaceBelongsToOrganization(params.workspaceId, params.organizationId);
            if (!validWorkspace) {
                throw new common_1.BadRequestException("Workspace invalido para a organizacao.");
            }
        }
        await this.ensureWorkspaceRequirement(params.organizationId, params.workspaceId);
        const settings = await this.getOrganizationSettings(params.organizationId);
        if (settings?.remember_last_context) {
            await this.saveUserLastContext(params.userId, params.organizationId, params.workspaceId);
        }
        return { organizationId: params.organizationId, workspaceId: params.workspaceId };
    }
    async getUserLastContext(userUuid) {
        const result = await this.pool.query(`SELECT o.uuid AS organization_uuid, w.uuid AS workspace_uuid
       FROM res_user_last_context uc
       JOIN res_users u ON u.id = uc.user_id
       LEFT JOIN res_organizations o ON o.id = uc.organization_id
       LEFT JOIN res_workspaces w ON w.id = uc.workspace_id
       WHERE u.uuid = $1
       ORDER BY uc.updated_at DESC LIMIT 1`, [userUuid]);
        return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
    }
    async getOrganizationSettings(organizationUuid) {
        if (!organizationUuid) {
            return null;
        }
        const result = await this.pool.query(`SELECT s.workspace_mode, s.remember_last_context
       FROM res_organization_settings s
       JOIN res_organizations o ON o.id = s.organization_id
       WHERE o.uuid = $1`, [organizationUuid]);
        return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
    }
    async getDefaultOrganization(tenantUuid) {
        const result = await this.pool.query(`SELECT o.uuid FROM res_organizations o
       JOIN tenants t ON t.id = o.tenant_id
       WHERE t.uuid = $1 AND o.is_default = true LIMIT 1`, [tenantUuid]);
        return (result.rowCount ?? 0) > 0 ? result.rows[0].uuid : null;
    }
    async ensureWorkspaceRequirement(organizationUuid, workspaceUuid) {
        const settings = await this.getOrganizationSettings(organizationUuid);
        if (settings?.workspace_mode === "required" && !workspaceUuid) {
            throw new common_1.BadRequestException("Workspace obrigatorio para esta organizacao.");
        }
    }
    async organizationBelongsToTenant(organizationUuid, tenantUuid) {
        const result = await this.pool.query(`SELECT 1 FROM res_organizations o
       JOIN tenants t ON t.id = o.tenant_id
       WHERE o.uuid = $1 AND t.uuid = $2`, [organizationUuid, tenantUuid]);
        return (result.rowCount ?? 0) > 0;
    }
    async workspaceBelongsToOrganization(workspaceUuid, organizationUuid) {
        const result = await this.pool.query(`SELECT 1 FROM res_workspaces w
       JOIN res_organizations o ON o.id = w.organization_id
       WHERE w.uuid = $1 AND o.uuid = $2`, [workspaceUuid, organizationUuid]);
        return (result.rowCount ?? 0) > 0;
    }
    async saveUserLastContext(userUuid, organizationUuid, workspaceUuid) {
        const userIdRes = await this.pool.query("SELECT id FROM res_users WHERE uuid = $1", [userUuid]);
        const userId = userIdRes.rows[0]?.id;
        if (!userId)
            return;
        const orgIdRes = await this.pool.query("SELECT id FROM res_organizations WHERE uuid = $1", [organizationUuid]);
        const organizationId = orgIdRes.rows[0]?.id;
        if (!organizationId)
            return;
        let workspaceId = null;
        if (workspaceUuid) {
            const wsIdRes = await this.pool.query("SELECT id FROM res_workspaces WHERE uuid = $1", [workspaceUuid]);
            workspaceId = wsIdRes.rows[0]?.id ?? null;
        }
        const existing = await this.pool.query("SELECT id FROM res_user_last_context WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1", [userId]);
        if (existing.rowCount) {
            await this.pool.query("UPDATE res_user_last_context SET organization_id = $1, workspace_id = $2, updated_at = now() WHERE id = $3", [organizationId, workspaceId, existing.rows[0].id]);
            return;
        }
        await this.pool.query("INSERT INTO res_user_last_context (user_id, organization_id, workspace_id, updated_at) VALUES ($1, $2, $3, now())", [userId, organizationId, workspaceId]);
    }
};
exports.AuthContextService = AuthContextService;
exports.AuthContextService = AuthContextService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], AuthContextService);
