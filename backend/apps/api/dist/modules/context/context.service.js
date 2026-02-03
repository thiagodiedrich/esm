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
const crypto_1 = require("crypto");
const database_module_1 = require("../database/database.module");
let AuthContextService = class AuthContextService {
    constructor(pool) {
        this.pool = pool;
    }
    async resolveLoginContext(tenantId, userId) {
        const lastContext = await this.getUserLastContext(userId);
        if (lastContext?.organization_id) {
            const settings = await this.getOrganizationSettings(lastContext.organization_id);
            if (settings?.remember_last_context) {
                await this.ensureWorkspaceRequirement(lastContext.organization_id, lastContext.workspace_id);
                return {
                    organizationId: lastContext.organization_id,
                    workspaceId: lastContext.workspace_id
                };
            }
        }
        const defaultOrgId = await this.getDefaultOrganization(tenantId);
        if (!defaultOrgId) {
            throw new common_1.BadRequestException("Organizacao padrao nao configurada.");
        }
        await this.ensureWorkspaceRequirement(defaultOrgId, null);
        return { organizationId: defaultOrgId, workspaceId: null };
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
    async getUserLastContext(userId) {
        const result = await this.pool.query("SELECT organization_id, workspace_id FROM res_user_last_context WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1", [userId]);
        return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
    }
    async getOrganizationSettings(organizationId) {
        if (!organizationId) {
            return null;
        }
        const result = await this.pool.query("SELECT workspace_mode, remember_last_context FROM res_organization_settings WHERE organization_id = $1", [organizationId]);
        return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
    }
    async getDefaultOrganization(tenantId) {
        const result = await this.pool.query("SELECT id FROM res_organizations WHERE tenant_id = $1 AND is_default = true LIMIT 1", [tenantId]);
        return (result.rowCount ?? 0) > 0 ? result.rows[0].id : null;
    }
    async ensureWorkspaceRequirement(organizationId, workspaceId) {
        const settings = await this.getOrganizationSettings(organizationId);
        if (settings?.workspace_mode === "required" && !workspaceId) {
            throw new common_1.BadRequestException("Workspace obrigatorio para esta organizacao.");
        }
    }
    async organizationBelongsToTenant(organizationId, tenantId) {
        const result = await this.pool.query("SELECT 1 FROM res_organizations WHERE id = $1 AND tenant_id = $2", [organizationId, tenantId]);
        return (result.rowCount ?? 0) > 0;
    }
    async workspaceBelongsToOrganization(workspaceId, organizationId) {
        const result = await this.pool.query("SELECT 1 FROM res_workspaces WHERE id = $1 AND organization_id = $2", [workspaceId, organizationId]);
        return (result.rowCount ?? 0) > 0;
    }
    async saveUserLastContext(userId, organizationId, workspaceId) {
        const existing = await this.pool.query("SELECT id FROM res_user_last_context WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1", [userId]);
        if (existing.rowCount) {
            await this.pool.query("UPDATE res_user_last_context SET organization_id = $1, workspace_id = $2, updated_at = now() WHERE id = $3", [organizationId, workspaceId, existing.rows[0].id]);
            return;
        }
        await this.pool.query("INSERT INTO res_user_last_context (id, user_id, organization_id, workspace_id, updated_at) VALUES ($1, $2, $3, $4, now())", [(0, crypto_1.randomUUID)(), userId, organizationId, workspaceId]);
    }
};
exports.AuthContextService = AuthContextService;
exports.AuthContextService = AuthContextService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], AuthContextService);
