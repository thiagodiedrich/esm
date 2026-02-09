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
        const multiTenantEnabled = (this.configService.get("MULTI_TENANT_ENABLED") ?? "false").toLowerCase() === "true";
        if (multiTenantEnabled) {
            return this.resolveMultiTenant(request);
        }
        const defaultTenantEnabled = (this.configService.get("TENANT_DEFAULT_ENABLED") ?? "false").toLowerCase() === "true";
        if (defaultTenantEnabled) {
            return this.resolveDefaultTenant();
        }
        return this.resolveTenantFromRequest(request);
    }
    async resolveMultiTenant(request) {
        const tenantId = this.getTenantIdFromHeader(request);
        if (tenantId) {
            const tenant = await this.findTenantById(tenantId);
            if (tenant)
                return tenant;
        }
        const tenantSlug = this.getTenantSlugFromHeader(request);
        if (tenantSlug) {
            const tenant = await this.findTenantBySlug(tenantSlug);
            if (tenant)
                return tenant;
        }
        const hostSlug = this.extractTenantSlugFromHost(request);
        if (hostSlug) {
            const tenant = await this.findTenantBySlug(hostSlug);
            if (tenant)
                return tenant;
        }
        throw new common_1.BadRequestException("1 - Tenant não encontrado");
    }
    async resolveDefaultTenant() {
        const defaultTenantId = this.configService.get("TENANT_DEFAULT_ID")?.trim();
        const defaultTenantSlug = this.configService.get("TENANT_DEFAULT_SLUG")?.trim();
        if (defaultTenantId) {
            const tenant = await this.findTenantById(defaultTenantId);
            if (tenant)
                return tenant;
        }
        if (defaultTenantSlug) {
            const tenant = await this.findTenantBySlug(defaultTenantSlug);
            if (tenant)
                return tenant;
        }
        throw new common_1.BadRequestException("2 - Tenant padrão não encontrado");
    }
    async resolveTenantFromRequest(request) {
        const tenantId = this.getTenantIdFromHeader(request);
        if (tenantId) {
            const tenant = await this.findTenantById(tenantId);
            if (tenant)
                return tenant;
        }
        const tenantSlug = this.getTenantSlugFromHeader(request);
        if (tenantSlug) {
            const tenant = await this.findTenantBySlug(tenantSlug);
            if (tenant)
                return tenant;
        }
        const hostSlug = this.extractTenantSlugFromHost(request);
        if (hostSlug) {
            const tenant = await this.findTenantBySlug(hostSlug);
            if (tenant)
                return tenant;
        }
        throw new common_1.BadRequestException("3 - Tenant não encontrado");
    }
    getTenantIdFromHeader(request) {
        const header = (this.configService.get("TENANT_HEADER") ?? "x-tenant-id").toLowerCase();
        const value = request?.headers?.[header];
        return typeof value === "string" && value.trim() ? value.trim() : undefined;
    }
    getTenantSlugFromHeader(request) {
        const value = request?.headers?.["x-tenant-slug"];
        return typeof value === "string" && value.trim() ? value.trim() : undefined;
    }
    extractTenantSlugFromHost(request) {
        const hostHeader = request?.headers?.host;
        if (!hostHeader)
            return undefined;
        const host = hostHeader.split(":")[0];
        if (!host)
            return undefined;
        const normalizedHost = host.trim().toLowerCase();
        if (normalizedHost === "localhost")
            return undefined;
        if (!normalizedHost.includes("."))
            return undefined;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost))
            return undefined;
        const [subdomain] = host.split(".");
        return subdomain?.trim() || undefined;
    }
    async findTenantById(idOrUuid) {
        const isNumericId = /^\d+$/.test(idOrUuid.trim());
        const result = await this.pool.query(isNumericId
            ? "SELECT id, uuid, slug FROM tenants WHERE id = $1"
            : "SELECT id, uuid, slug FROM tenants WHERE uuid = $1", [isNumericId ? parseInt(idOrUuid, 10) : idOrUuid]);
        return result.rowCount && result.rowCount > 0 ? result.rows[0] : null;
    }
    async findTenantBySlug(slug) {
        const result = await this.pool.query("SELECT id, uuid, slug FROM tenants WHERE slug = $1", [slug]);
        return result.rowCount && result.rowCount > 0 ? result.rows[0] : null;
    }
    extractTenantSlug(request) {
        const headerSlug = this.getTenantSlugFromHeader(request);
        if (headerSlug)
            return headerSlug;
        return this.extractTenantSlugFromHost(request);
    }
};
exports.AuthTenantService = AuthTenantService;
exports.AuthTenantService = AuthTenantService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        pg_1.Pool])
], AuthTenantService);
