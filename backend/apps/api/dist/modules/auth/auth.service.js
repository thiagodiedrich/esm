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
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
let AuthService = class AuthService {
    constructor(jwtService, configService, pool) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.pool = pool;
        this.loginAttempts = new Map();
    }
    async verifyUserToken(token) {
        return this.verifyToken(token);
    }
    async verifyServiceToken(token) {
        return this.verifyToken(token);
    }
    async verifyToken(token) {
        const algorithm = (this.configService.get("JWT_ALGORITHM") || "RS256");
        try {
            return await this.jwtService.verifyAsync(token, {
                algorithms: [algorithm]
            });
        }
        catch (error) {
            throw new common_1.UnauthorizedException("Token invalido ou expirado.");
        }
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
    async issueTokens(input) {
        const accessMinutes = Number(this.configService.get("ACCESS_TOKEN_EXPIRE_MINUTES") || 15);
        const accessTtlSeconds = Math.max(1, accessMinutes) * 60;
        const refreshTtlSeconds = 7 * 24 * 60 * 60;
        const accessPayload = {
            sub: input.userId,
            tenant_id: input.tenantId,
            organization_id: input.organizationId,
            workspace_id: input.workspaceId,
            type: "access"
        };
        const refreshPayload = {
            sub: input.userId,
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
