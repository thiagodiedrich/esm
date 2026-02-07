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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = require("crypto");
const pg_1 = require("pg");
const ioredis_1 = __importDefault(require("ioredis"));
const database_module_1 = require("../database/database.module");
const PREFIX_BLACKLIST_ACCESS = "auth:blacklist:access:";
const PREFIX_BLACKLIST_REFRESH = "auth:blacklist:refresh:";
let AuthService = class AuthService {
    constructor(jwtService, configService, pool) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.pool = pool;
        this.loginAttempts = new Map();
        const redisUrl = this.configService.get("REDIS_URL");
        this.redis = redisUrl?.trim() ? new ioredis_1.default(redisUrl) : null;
    }
    async verifyUserToken(token) {
        return this.verifyToken(token);
    }
    async verifyServiceToken(token) {
        return this.verifyToken(token);
    }
    async verifyToken(token) {
        const algorithm = (this.configService.get("JWT_ALGORITHM") || "RS256");
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token, {
                algorithms: [algorithm]
            });
        }
        catch (error) {
            throw new common_1.UnauthorizedException("Token invalido ou expirado.");
        }
        if (payload.jti && this.redis) {
            const prefix = payload.type === "refresh" ? PREFIX_BLACKLIST_REFRESH : PREFIX_BLACKLIST_ACCESS;
            const key = `${prefix}${payload.jti}`;
            const revoked = await this.redis.get(key);
            if (revoked) {
                throw new common_1.UnauthorizedException("Token revogado.");
            }
        }
        return payload;
    }
    async validateUserCredentials(tenantId, email, password) {
        const key = `${tenantId}:${email.toLowerCase()}`;
        this.assertNotBlocked(key);
        const result = await this.pool.query("SELECT id, password_hash, is_active FROM res_users WHERE tenant_id = $1 AND email = $2", [tenantId, email]);
        if (result.rowCount === 0) {
            this.registerFailedAttempt(key);
            return null;
        }
        const user = result.rows[0];
        if (!user.is_active || !user.password_hash) {
            this.registerFailedAttempt(key);
            return null;
        }
        const isValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isValid) {
            this.registerFailedAttempt(key);
            return null;
        }
        this.clearFailedAttempts(key);
        return { id: user.id };
    }
    /**
     * Nomes para preencher o JWT (tenant_slug, name, organization_name, workspace_name).
     * Usado em login e refresh para o frontend exibir header/contexto sem depender de GET /me.
     */
    async getLoginDisplayNames(tenantId, userId, organizationId, workspaceId) {
        const slugResult = await this.pool.query("SELECT slug FROM tenants WHERE id = $1", [tenantId]);
        const tenantSlug = slugResult.rows[0]?.slug ?? "";
        const userResult = await this.pool.query("SELECT partner_id, email FROM res_users WHERE tenant_id = $1 AND id = $2", [tenantId, userId]);
        let name = "Usuário";
        if (userResult.rowCount) {
            const pid = userResult.rows[0].partner_id;
            const email = userResult.rows[0].email ?? "";
            if (pid) {
                const pResult = await this.pool.query("SELECT name FROM res_partners WHERE id = $1", [pid]);
                name = (pResult.rows[0]?.name ?? email).trim() || email || "Usuário";
            }
            else {
                name = email.trim() || "Usuário";
            }
        }
        const orgResult = await this.pool.query("SELECT name FROM res_organizations WHERE id = $1 AND tenant_id = $2", [organizationId, tenantId]);
        const organizationName = orgResult.rows[0]?.name ?? "";
        let workspaceName = null;
        if (workspaceId) {
            const wsResult = await this.pool.query("SELECT name FROM res_workspaces WHERE id = $1 AND organization_id = $2", [workspaceId, organizationId]);
            workspaceName = wsResult.rows[0]?.name ?? null;
        }
        return { tenantSlug, name, organizationName, workspaceName };
    }
    async getUserById(tenantId, userId) {
        const result = await this.pool.query("SELECT id, tenant_id, partner_id, email, is_active FROM res_users WHERE tenant_id = $1 AND id = $2", [tenantId, userId]);
        if (result.rowCount === 0) {
            return null;
        }
        const user = result.rows[0];
        return {
            id: user.id,
            tenant_id: user.tenant_id,
            partner_id: user.partner_id ?? null,
            email: user.email ?? "",
            is_active: user.is_active ?? null
        };
    }
    /**
     * Payload completo para GET /me: user_id, name, tenant_slug, organizations (com workspaces),
     * current_context (com nomes e workspace_mode), requires_context_selection.
     */
    async getMePayload(tenantId, userId, context) {
        const userResult = await this.pool.query(`SELECT u.id, u.tenant_id, u.partner_id, u.email, u.is_active, t.slug AS tenant_slug, p.name AS partner_name
       FROM res_users u
       JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN res_partners p ON p.id = u.partner_id
       WHERE u.tenant_id = $1 AND u.id = $2`, [tenantId, userId]);
        if (userResult.rowCount === 0) {
            return null;
        }
        const row = userResult.rows[0];
        const name = (row.partner_name ?? row.email ?? "Usuário").trim() || "Usuário";
        const orgsResult = await this.pool.query("SELECT id, name, is_default FROM res_organizations WHERE tenant_id = $1 ORDER BY created_at", [tenantId]);
        const orgIds = orgsResult.rows.map((o) => o.id);
        let workspacesByOrg = new Map();
        if (orgIds.length > 0) {
            const wsResult = await this.pool.query("SELECT id, organization_id, name FROM res_workspaces WHERE organization_id = ANY($1::uuid[])", [orgIds]);
            for (const ws of wsResult.rows) {
                const list = workspacesByOrg.get(ws.organization_id) ?? [];
                list.push({
                    id: ws.id,
                    name: ws.name ?? "",
                    is_active: true
                });
                workspacesByOrg.set(ws.organization_id, list);
            }
        }
        const organizations = orgsResult.rows.map((o) => ({
            id: o.id,
            name: o.name ?? "",
            is_default: o.is_default ?? false,
            workspaces: workspacesByOrg.get(o.id) ?? []
        }));
        let current_context = null;
        const organizationId = context.organizationId;
        const workspaceId = context.workspaceId ?? null;
        if (organizationId) {
            const orgRow = await this.pool.query("SELECT name FROM res_organizations WHERE id = $1 AND tenant_id = $2", [organizationId, tenantId]);
            const organization_name = orgRow.rowCount ? (orgRow.rows[0].name ?? "") : "";
            let workspace_name = null;
            if (workspaceId) {
                const wsRow = await this.pool.query("SELECT name FROM res_workspaces WHERE id = $1 AND organization_id = $2", [workspaceId, organizationId]);
                workspace_name = wsRow.rowCount ? (wsRow.rows[0].name ?? null) : null;
            }
            const settingsRow = await this.pool.query("SELECT workspace_mode FROM res_organization_settings WHERE organization_id = $1", [organizationId]);
            const workspace_mode = settingsRow.rows[0]?.workspace_mode === "required" ? "required" : "optional";
            current_context = {
                organization_id: organizationId,
                organization_name,
                workspace_id: workspaceId,
                workspace_name,
                workspace_mode
            };
        }
        return {
            user_id: row.id,
            email: row.email ?? "",
            name,
            tenant_id: row.tenant_id,
            tenant_slug: row.tenant_slug ?? "",
            partner_id: row.partner_id,
            is_active: row.is_active,
            organizations,
            current_context,
            requires_context_selection: !current_context
        };
    }
    async issueTokens(input) {
        const accessMinutes = Number(this.configService.get("ACCESS_TOKEN_EXPIRE_MINUTES") || 15);
        const accessTtlSeconds = Math.max(1, accessMinutes) * 60;
        const refreshTtlSeconds = 7 * 24 * 60 * 60;
        const accessPayload = {
            sub: input.userId,
            jti: (0, crypto_1.randomUUID)(),
            tenant_id: input.tenantId,
            tenant_slug: input.tenantSlug,
            organization_id: input.organizationId,
            organization_name: input.organizationName,
            workspace_id: input.workspaceId,
            workspace_name: input.workspaceName,
            name: input.name,
            type: "access"
        };
        const refreshPayload = {
            sub: input.userId,
            jti: (0, crypto_1.randomUUID)(),
            tenant_id: input.tenantId,
            type: "refresh"
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(accessPayload, { expiresIn: accessTtlSeconds }),
            this.jwtService.signAsync(refreshPayload, { expiresIn: refreshTtlSeconds })
        ]);
        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: accessTtlSeconds
        };
    }
    /**
     * Invalida o access token, revoga o refresh token (se informado) e registra o logout.
     * Requer Redis para blacklist; sem Redis apenas loga (tokens continuam válidos até expirar).
     */
    async logout(accessToken, refreshToken) {
        let accessPayload;
        try {
            accessPayload = await this.verifyUserToken(accessToken);
        }
        catch {
            return null;
        }
        if (accessPayload.type !== "access" || !accessPayload.jti) {
            return null;
        }
        const nowSec = Math.floor(Date.now() / 1000);
        const accessTtlMs = Math.max(0, ((accessPayload.exp ?? nowSec) - nowSec) * 1000);
        if (this.redis) {
            await this.redis.set(`${PREFIX_BLACKLIST_ACCESS}${accessPayload.jti}`, "1", "PX", accessTtlMs);
        }
        if (refreshToken?.trim()) {
            try {
                const refreshPayload = await this.verifyUserToken(refreshToken);
                if (refreshPayload.type === "refresh" && refreshPayload.jti) {
                    const refreshTtlMs = Math.max(0, ((refreshPayload.exp ?? nowSec) - nowSec) * 1000);
                    if (this.redis) {
                        await this.redis.set(`${PREFIX_BLACKLIST_REFRESH}${refreshPayload.jti}`, "1", "PX", refreshTtlMs);
                    }
                }
            }
            catch {
                // refresh inválido ou já expirado — ignorar
            }
        }
        return { sub: accessPayload.sub, tenant_id: accessPayload.tenant_id };
    }
    assertNotBlocked(key) {
        const config = this.getFailbanConfig();
        if (!config) {
            return;
        }
        const state = this.loginAttempts.get(key);
        if (state?.blockedUntil && state.blockedUntil > Date.now()) {
            throw new common_1.UnauthorizedException("Usuario bloqueado temporariamente.");
        }
    }
    registerFailedAttempt(key) {
        const config = this.getFailbanConfig();
        if (!config) {
            return;
        }
        const current = this.loginAttempts.get(key) ?? { count: 0 };
        const nextCount = current.count + 1;
        if (nextCount >= config.maxAttempts) {
            const blockedUntil = Date.now() + config.blockMinutes * 60 * 1000;
            this.loginAttempts.set(key, { count: 0, blockedUntil });
            return;
        }
        this.loginAttempts.set(key, { count: nextCount });
    }
    clearFailedAttempts(key) {
        this.loginAttempts.delete(key);
    }
    getFailbanConfig() {
        const maxAttempts = Number(this.configService.get("LOGIN_MAX_ATTEMPTS") ?? 0);
        const blockMinutes = Number(this.configService.get("LOGIN_BLOCK_MINUTES") ?? 0);
        if (maxAttempts > 0 && blockMinutes > 0) {
            return { maxAttempts, blockMinutes };
        }
        return null;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        pg_1.Pool])
], AuthService);
