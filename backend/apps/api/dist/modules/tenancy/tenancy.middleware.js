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
exports.TenancyMiddleware = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const request_context_service_1 = require("../observability/request-context.service");
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
let TenancyMiddleware = class TenancyMiddleware {
    constructor(configService, requestContext, pool) {
        this.configService = configService;
        this.requestContext = requestContext;
        this.pool = pool;
    }
    async use(req, _res, next) {
        const enabled = (this.configService.get("MULTI_TENANT_ENABLED") ?? "false").toLowerCase() === "true";
        if (!enabled) {
            return next();
        }
        const tenantHeader = (this.configService.get("TENANT_HEADER") ?? "x-tenant-id").toLowerCase();
        const organizationHeader = (this.configService.get("ORGANIZATION_HEADER") ?? "x-organization-id").toLowerCase();
        const workspaceHeader = (this.configService.get("WORKSPACE_HEADER") ?? "x-workspace-id").toLowerCase();
        const headerTenant = this.getHeaderValue(req, tenantHeader);
        const headerOrganization = this.getHeaderValue(req, organizationHeader);
        const headerWorkspace = this.getHeaderValue(req, workspaceHeader);
        const tokenTenant = req.user?.tenant_id;
        const tokenOrganization = req.user?.organization_id;
        const tokenWorkspace = req.user?.workspace_id ?? undefined;
        if (req.user?.auth_type === "user") {
            if (!tokenTenant) {
                throw new common_1.BadRequestException("Tenant ausente no token.");
            }
            if (headerTenant && headerTenant !== tokenTenant) {
                throw new common_1.BadRequestException("Tenant do header nao corresponde ao token.");
            }
            if (headerOrganization && !tokenOrganization) {
                throw new common_1.BadRequestException("Organizacao ausente no token.");
            }
            if (headerOrganization && headerOrganization !== tokenOrganization) {
                throw new common_1.BadRequestException("Organizacao do header nao corresponde ao token.");
            }
            if (headerWorkspace && !tokenWorkspace) {
                throw new common_1.BadRequestException("Workspace ausente no token.");
            }
            if (headerWorkspace && headerWorkspace !== tokenWorkspace) {
                throw new common_1.BadRequestException("Workspace do header nao corresponde ao token.");
            }
        }
        if (headerTenant || headerOrganization || headerWorkspace) {
            if (headerTenant) {
                await this.ensureTenantExists(headerTenant, "id");
            }
            if (headerOrganization) {
                await this.ensureOrganizationExists(headerOrganization, headerTenant ?? tokenTenant ?? null);
            }
            if (headerWorkspace) {
                const orgId = headerOrganization ?? tokenOrganization ?? null;
                const tenantId = headerTenant ?? tokenTenant ?? null;
                await this.ensureWorkspaceExists(headerWorkspace, orgId, tenantId);
            }
            this.requestContext.updateUserContext({
                tenantId: headerTenant ?? undefined,
                organizationId: headerOrganization ?? undefined,
                workspaceId: headerWorkspace ?? undefined
            });
        }
        const tenantSlugHeader = this.getHeaderValue(req, "x-tenant-slug");
        const hostTenantSlug = this.extractTenantFromHost(req);
        if (tenantSlugHeader) {
            await this.ensureTenantExists(tenantSlugHeader, "slug");
        }
        if (hostTenantSlug) {
            await this.ensureTenantExists(hostTenantSlug, "slug");
        }
        if (!tokenTenant && !headerTenant && !tenantSlugHeader && !hostTenantSlug) {
            throw new common_1.BadRequestException("Tenant nao informado.");
        }
        return next();
    }
    getHeaderValue(req, headerName) {
        const value = req.headers[headerName];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
        return undefined;
    }
    extractTenantFromHost(req) {
        const hostHeader = req.headers.host;
        if (!hostHeader) {
            return undefined;
        }
        const host = hostHeader.split(":")[0];
        const [subdomain] = host.split(".");
        return subdomain?.trim() || undefined;
    }
    async ensureTenantExists(value, field) {
        const query = field === "id" ? "SELECT id FROM tenants WHERE id = $1" : "SELECT id FROM tenants WHERE slug = $1";
        const result = await this.pool.query(query, [value]);
        if ((result.rowCount ?? 0) === 0) {
            throw new common_1.BadRequestException("Code 7: Tenant nao encontrado");
        }
    }
    async ensureOrganizationExists(value, tenantId) {
        const result = tenantId
            ? await this.pool.query("SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2", [value, tenantId])
            : await this.pool.query("SELECT id FROM res_organizations WHERE id = $1", [value]);
        if ((result.rowCount ?? 0) === 0) {
            throw new common_1.BadRequestException("Organizacao nao encontrada.");
        }
    }
    async ensureWorkspaceExists(value, organizationId, tenantId) {
        let result;
        if (organizationId) {
            result = await this.pool.query("SELECT id FROM res_workspaces WHERE id = $1 AND organization_id = $2", [value, organizationId]);
        }
        else if (tenantId) {
            result = await this.pool.query(`SELECT rw.id
         FROM res_workspaces rw
         JOIN res_organizations ro ON ro.id = rw.organization_id
         WHERE rw.id = $1 AND ro.tenant_id = $2`, [value, tenantId]);
        }
        else {
            result = await this.pool.query("SELECT id FROM res_workspaces WHERE id = $1", [value]);
        }
        if ((result.rowCount ?? 0) === 0) {
            throw new common_1.BadRequestException("Workspace nao encontrado.");
        }
    }
};
exports.TenancyMiddleware = TenancyMiddleware;
exports.TenancyMiddleware = TenancyMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        request_context_service_1.RequestContextService,
        pg_1.Pool])
], TenancyMiddleware);
