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
exports.AuthTenantService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
let AuthTenantService = class AuthTenantService {
    constructor(configService, pool) {
        this.configService = configService;
        this.pool = pool;
    }
    async resolveTenantOrFail(request) {
        const tenantHeader = (this.configService.get("TENANT_HEADER") ?? "x-tenant-id").toLowerCase();
        const tenantIdHeader = request?.headers?.[tenantHeader];
        if (typeof tenantIdHeader === "string" && tenantIdHeader.trim()) {
            const result = await this.pool.query("SELECT id, slug FROM tenants WHERE id = $1", [tenantIdHeader.trim()]);
            if (result.rowCount === 0) {
                throw new common_1.BadRequestException("Tenant nao encontrado.");
            }
            return result.rows[0];
        }
        const tenantSlug = this.extractTenantSlug(request);
        if (tenantSlug) {
            const result = await this.pool.query("SELECT id, slug FROM tenants WHERE slug = $1", [tenantSlug]);
            if (result.rowCount === 0) {
                throw new common_1.BadRequestException("Tenant nao encontrado.");
            }
            return result.rows[0];
        }
        const multiTenantEnabled = (this.configService.get("MULTI_TENANT_ENABLED") ?? "false").toLowerCase() ===
            "true";
        const defaultTenantEnabled = (this.configService.get("TENANT_DEFAULT_ENABLED") ?? "false").toLowerCase() ===
            "true";
        if (!multiTenantEnabled && defaultTenantEnabled) {
            const defaultTenantId = this.configService.get("TENANT_DEFAULT_ID")?.trim();
            if (!defaultTenantId) {
                throw new common_1.BadRequestException("TENANT_DEFAULT_ID nao configurado.");
            }
            const result = await this.pool.query("SELECT id, slug FROM tenants WHERE id = $1", [defaultTenantId]);
            if (result.rowCount === 0) {
                throw new common_1.BadRequestException("Tenant nao encontrado.");
            }
            return result.rows[0];
        }
        throw new common_1.BadRequestException("Tenant nao identificado.");
    }
    extractTenantSlug(request) {
        const headerSlug = request?.headers["x-tenant-slug"];
        if (typeof headerSlug === "string" && headerSlug.trim()) {
            return headerSlug.trim();
        }
        const hostHeader = request?.headers.host;
        if (!hostHeader) {
            return undefined;
        }
        const host = hostHeader.split(":")[0];
        if (!host) {
            return undefined;
        }
        const normalizedHost = host.trim().toLowerCase();
        if (normalizedHost === "localhost") {
            return undefined;
        }
        if (!normalizedHost.includes(".")) {
            return undefined;
        }
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost)) {
            return undefined;
        }
        const [subdomain] = host.split(".");
        return subdomain?.trim() || undefined;
    }
};
exports.AuthTenantService = AuthTenantService;
exports.AuthTenantService = AuthTenantService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        pg_1.Pool])
], AuthTenantService);
