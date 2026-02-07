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
exports.SuperUserService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
/**
 * Regras de acesso total (ignora roles e permissions):
 *
 * 1) Super tenant: usuário com is_super_tenant = true do tenant com is_super_tenant = true
 *    (empresa principal SaaS). Acesso total a todos os tenants, organizations, workspaces,
 *    rotas, menus e funcionalidades.
 *
 * 2) Super admin: usuário com is_super_admin = true no contexto (organization_id do JWT)
 *    igual ao organization_id do res_users. Acesso total a todas as organizations e
 *    workspaces do tenant e a todas as funcionalidades (rotas, menus, botões).
 */
let SuperUserService = class SuperUserService {
    constructor(pool) {
        this.pool = pool;
        this.cache = new Map();
        this.cacheTtlMs = 60_000;
    }
    /**
     * Retorna true se o usuário tem acesso total (super tenant ou super admin).
     * Nesse caso, roles e permissions são ignorados.
     */
    async hasFullAccess(user) {
        if (!user?.sub || !user.tenant_id || user.auth_type !== "user") {
            return false;
        }
        const row = await this.loadSuperFlags(user.sub, user.tenant_id);
        if (!row) {
            return false;
        }
        if (row.user_is_super_tenant && row.tenant_is_super_tenant) {
            return true;
        }
        if (row.user_is_super_admin &&
            row.user_organization_id &&
            user.organization_id &&
            row.user_organization_id === user.organization_id) {
            return true;
        }
        return false;
    }
    async loadSuperFlags(userId, tenantId) {
        const key = `${userId}:${tenantId}`;
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.at < this.cacheTtlMs) {
            return cached.row;
        }
        const result = await this.pool.query(`SELECT
         u.is_super_tenant AS user_is_super_tenant,
         u.is_super_admin AS user_is_super_admin,
         u.organization_id AS user_organization_id,
         COALESCE(t.is_super_tenant, false) AS tenant_is_super_tenant
       FROM res_users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.tenant_id = $2`, [userId, tenantId]);
        if (result.rowCount === 0) {
            return null;
        }
        const row = result.rows[0];
        this.cache.set(key, { row, at: Date.now() });
        return row;
    }
};
exports.SuperUserService = SuperUserService;
exports.SuperUserService = SuperUserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], SuperUserService);
