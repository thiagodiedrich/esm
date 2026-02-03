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
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
let AuthTenantService = class AuthTenantService {
    constructor(pool) {
        this.pool = pool;
    }
    async resolveTenantOrFail(request) {
        const tenantSlug = this.extractTenantSlug(request);
        if (!tenantSlug) {
            throw new common_1.BadRequestException("Tenant nao identificado.");
        }
        const result = await this.pool.query("SELECT id, slug FROM tenants WHERE slug = $1", [tenantSlug]);
        if (result.rowCount === 0) {
            throw new common_1.BadRequestException("Tenant nao encontrado.");
        }
        return result.rows[0];
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
        const [subdomain] = host.split(".");
        return subdomain?.trim() || undefined;
    }
};
exports.AuthTenantService = AuthTenantService;
exports.AuthTenantService = AuthTenantService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], AuthTenantService);
