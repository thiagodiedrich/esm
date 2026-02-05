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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_service_1 = require("./admin.service");
class TenantRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "Empresa ABC" }),
    __metadata("design:type", String)
], TenantRequestDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "empresa-abc" }),
    __metadata("design:type", String)
], TenantRequestDto.prototype, "slug", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: "shared" }),
    __metadata("design:type", Object)
], TenantRequestDto.prototype, "db_strategy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: "postgresql://..." }),
    __metadata("design:type", Object)
], TenantRequestDto.prototype, "control_plane_db", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: "postgresql://..." }),
    __metadata("design:type", Object)
], TenantRequestDto.prototype, "erp_db", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: "postgresql://..." }),
    __metadata("design:type", Object)
], TenantRequestDto.prototype, "telemetry_db", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: "pending" }),
    __metadata("design:type", Object)
], TenantRequestDto.prototype, "migration_status", void 0);
class TenantStatusDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "completed", description: "Ex: pending, in_progress, completed" }),
    __metadata("design:type", String)
], TenantStatusDto.prototype, "migration_status", void 0);
class PlanRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "starter" }),
    __metadata("design:type", String)
], PlanRequestDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "Plano Starter" }),
    __metadata("design:type", String)
], PlanRequestDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: "Para pequenos projetos" }),
    __metadata("design:type", Object)
], PlanRequestDto.prototype, "description", void 0);
class PlanStatusDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "active", description: "Ex: active, inactive" }),
    __metadata("design:type", String)
], PlanStatusDto.prototype, "status", void 0);
class PlatformProductRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "erp" }),
    __metadata("design:type", String)
], PlatformProductRequestDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "ERP" }),
    __metadata("design:type", String)
], PlatformProductRequestDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PlatformProductRequestDto.prototype, "description", void 0);
class PlatformProductModuleRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PlatformProductModuleRequestDto.prototype, "product_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "erp.product" }),
    __metadata("design:type", String)
], PlatformProductModuleRequestDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "Produtos" }),
    __metadata("design:type", String)
], PlatformProductModuleRequestDto.prototype, "name", void 0);
class TenantPlatformProductRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TenantPlatformProductRequestDto.prototype, "product_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TenantPlatformProductRequestDto.prototype, "plan_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], TenantPlatformProductRequestDto.prototype, "is_active", void 0);
class PermissionRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "admin.tenant" }),
    __metadata("design:type", String)
], PermissionRequestDto.prototype, "resource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "read" }),
    __metadata("design:type", String)
], PermissionRequestDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PermissionRequestDto.prototype, "description", void 0);
let AdminController = class AdminController {
    constructor(adminService) {
        this.adminService = adminService;
    }
    async createTenant(body, request) {
        this.assertAccess(request);
        return this.adminService.createTenant(body);
    }
    async listTenants(request) {
        this.assertAccess(request);
        return this.adminService.listTenants();
    }
    async getTenant(id, request) {
        this.assertAccess(request);
        return this.adminService.getTenant(id);
    }
    async updateTenant(id, body, request) {
        this.assertAccess(request);
        return this.adminService.updateTenant(id, body);
    }
    async updateTenantStatus(id, body, request) {
        this.assertAccess(request);
        return this.adminService.updateTenantStatus(id, body.migration_status);
    }
    async createPlan(body, request) {
        this.assertAccess(request);
        return this.adminService.createPlan(body);
    }
    async listPlans(request) {
        this.assertAccess(request);
        return this.adminService.listPlans();
    }
    async updatePlan(code, body, request) {
        this.assertAccess(request);
        return this.adminService.updatePlan(code, body);
    }
    async updatePlanStatus(code, body, request) {
        this.assertAccess(request);
        return this.adminService.updatePlanStatus(code, body.status);
    }
    async createPlatformProduct(body, request) {
        this.assertAccess(request);
        return this.adminService.createPlatformProduct(body);
    }
    async listPlatformProducts(request) {
        this.assertAccess(request);
        return this.adminService.listPlatformProducts();
    }
    async getPlatformProduct(id, request) {
        this.assertAccess(request);
        return this.adminService.getPlatformProduct(id);
    }
    async updatePlatformProduct(id, body, request) {
        this.assertAccess(request);
        return this.adminService.updatePlatformProduct(id, body);
    }
    async deletePlatformProduct(id, request) {
        this.assertAccess(request);
        return this.adminService.deletePlatformProduct(id);
    }
    async createPlatformProductModule(body, request) {
        this.assertAccess(request);
        return this.adminService.createPlatformProductModule(body);
    }
    async listPlatformProductModules(productId, request) {
        this.assertAccess(request);
        return this.adminService.listPlatformProductModules(productId);
    }
    async getPlatformProductModule(id, request) {
        this.assertAccess(request);
        return this.adminService.getPlatformProductModule(id);
    }
    async updatePlatformProductModule(id, body, request) {
        this.assertAccess(request);
        return this.adminService.updatePlatformProductModule(id, body);
    }
    async deletePlatformProductModule(id, request) {
        this.assertAccess(request);
        return this.adminService.deletePlatformProductModule(id);
    }
    async createTenantPlatformProduct(id, body, request) {
        this.assertAccess(request);
        return this.adminService.createTenantPlatformProduct(id, body);
    }
    async listTenantPlatformProducts(id, request) {
        this.assertAccess(request);
        return this.adminService.listTenantPlatformProducts(id);
    }
    async getTenantPlatformProduct(tenantId, id, request) {
        this.assertAccess(request);
        return this.adminService.getTenantPlatformProduct(tenantId, id);
    }
    async updateTenantPlatformProduct(tenantId, id, body, request) {
        this.assertAccess(request);
        return this.adminService.updateTenantPlatformProduct(tenantId, id, body);
    }
    async deleteTenantPlatformProduct(tenantId, id, request) {
        this.assertAccess(request);
        return this.adminService.deleteTenantPlatformProduct(tenantId, id);
    }
    async listTenantUsageMetrics(id, request) {
        this.assertAccess(request);
        return this.adminService.listTenantUsageMetrics(id);
    }
    async createPermission(body, request) {
        this.assertAccess(request);
        return this.adminService.createPermission(body);
    }
    async listPermissions(request) {
        this.assertAccess(request);
        return this.adminService.listPermissions();
    }
    async getPermission(id, request) {
        this.assertAccess(request);
        return this.adminService.getPermission(id);
    }
    async updatePermission(id, body, request) {
        this.assertAccess(request);
        return this.adminService.updatePermission(id, body);
    }
    async deletePermission(id, request) {
        this.assertAccess(request);
        return this.adminService.deletePermission(id);
    }
    assertAccess(request) {
        const user = request.user;
        if (!user || user.auth_type !== "user" || user.type !== "access") {
            throw new common_1.UnauthorizedException("Access token necessario.");
        }
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Post)("/tenants"),
    (0, swagger_1.ApiOperation)({ summary: "Cria tenant" }),
    (0, swagger_1.ApiBody)({
        type: TenantRequestDto,
        examples: {
            minimal: {
                summary: "Minimo",
                value: { name: "Empresa ABC", slug: "empresa-abc" }
            },
            full: {
                summary: "Completo",
                value: {
                    name: "Empresa ABC",
                    slug: "empresa-abc",
                    db_strategy: "shared",
                    migration_status: "pending"
                }
            }
        }
    }),
    (0, swagger_1.ApiOkResponse)({ type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TenantRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createTenant", null);
__decorate([
    (0, common_1.Get)("/tenants"),
    (0, swagger_1.ApiOperation)({ summary: "Lista tenants" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listTenants", null);
__decorate([
    (0, common_1.Get)("/tenants/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Busca tenant por id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getTenant", null);
__decorate([
    (0, common_1.Put)("/tenants/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza tenant" }),
    (0, swagger_1.ApiBody)({
        type: TenantRequestDto,
        examples: {
            default: {
                summary: "Exemplo",
                value: { name: "Empresa ABC Atualizada", slug: "empresa-abc", migration_status: "completed" }
            }
        }
    }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TenantRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateTenant", null);
__decorate([
    (0, common_1.Patch)("/tenants/:id/status"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza status de migracao do tenant" }),
    (0, swagger_1.ApiBody)({
        type: TenantStatusDto,
        examples: { default: { summary: "Exemplo", value: { migration_status: "completed" } } }
    }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TenantStatusDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateTenantStatus", null);
__decorate([
    (0, common_1.Post)("/plans"),
    (0, swagger_1.ApiOperation)({ summary: "Cria plano" }),
    (0, swagger_1.ApiBody)({
        type: PlanRequestDto,
        examples: {
            default: {
                summary: "Exemplo",
                value: { code: "starter", name: "Plano Starter", description: "Para pequenos projetos" }
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PlanRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createPlan", null);
__decorate([
    (0, common_1.Get)("/plans"),
    (0, swagger_1.ApiOperation)({ summary: "Lista planos" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listPlans", null);
__decorate([
    (0, common_1.Put)("/plans/:code"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza plano" }),
    (0, swagger_1.ApiBody)({
        type: PlanRequestDto,
        examples: {
            default: {
                summary: "Exemplo",
                value: { code: "starter", name: "Plano Starter Atualizado", description: "Descricao atualizada" }
            }
        }
    }),
    __param(0, (0, common_1.Param)("code")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PlanRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Patch)("/plans/:code/status"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza status do plano" }),
    (0, swagger_1.ApiBody)({
        type: PlanStatusDto,
        examples: { default: { summary: "Exemplo", value: { status: "active" } } }
    }),
    __param(0, (0, common_1.Param)("code")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PlanStatusDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updatePlanStatus", null);
__decorate([
    (0, common_1.Post)("/platform-products"),
    (0, swagger_1.ApiOperation)({ summary: "Cria produto da plataforma" }),
    (0, swagger_1.ApiBody)({ type: PlatformProductRequestDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PlatformProductRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createPlatformProduct", null);
__decorate([
    (0, common_1.Get)("/platform-products"),
    (0, swagger_1.ApiOperation)({ summary: "Lista produtos da plataforma" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listPlatformProducts", null);
__decorate([
    (0, common_1.Get)("/platform-products/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Busca produto da plataforma por id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getPlatformProduct", null);
__decorate([
    (0, common_1.Put)("/platform-products/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza produto da plataforma" }),
    (0, swagger_1.ApiBody)({ type: PlatformProductRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PlatformProductRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updatePlatformProduct", null);
__decorate([
    (0, common_1.Delete)("/platform-products/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove produto da plataforma" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deletePlatformProduct", null);
__decorate([
    (0, common_1.Post)("/platform-product-modules"),
    (0, swagger_1.ApiOperation)({ summary: "Cria modulo/aplicativo da plataforma" }),
    (0, swagger_1.ApiBody)({ type: PlatformProductModuleRequestDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PlatformProductModuleRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createPlatformProductModule", null);
__decorate([
    (0, common_1.Get)("/platform-product-modules"),
    (0, swagger_1.ApiOperation)({ summary: "Lista modulos/aplicativos" }),
    __param(0, (0, common_1.Query)("product_id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listPlatformProductModules", null);
__decorate([
    (0, common_1.Get)("/platform-product-modules/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Busca modulo por id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getPlatformProductModule", null);
__decorate([
    (0, common_1.Put)("/platform-product-modules/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza modulo/aplicativo" }),
    (0, swagger_1.ApiBody)({ type: PlatformProductModuleRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PlatformProductModuleRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updatePlatformProductModule", null);
__decorate([
    (0, common_1.Delete)("/platform-product-modules/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove modulo/aplicativo" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deletePlatformProductModule", null);
__decorate([
    (0, common_1.Post)("/tenants/:id/products"),
    (0, swagger_1.ApiOperation)({ summary: "Associa produto ao tenant" }),
    (0, swagger_1.ApiBody)({ type: TenantPlatformProductRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TenantPlatformProductRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createTenantPlatformProduct", null);
__decorate([
    (0, common_1.Get)("/tenants/:id/products"),
    (0, swagger_1.ApiOperation)({ summary: "Lista produtos do tenant" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listTenantPlatformProducts", null);
__decorate([
    (0, common_1.Get)("/tenants/:tenantId/products/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Busca produto do tenant" }),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getTenantPlatformProduct", null);
__decorate([
    (0, common_1.Put)("/tenants/:tenantId/products/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza produto do tenant" }),
    (0, swagger_1.ApiBody)({ type: TenantPlatformProductRequestDto }),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, TenantPlatformProductRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateTenantPlatformProduct", null);
__decorate([
    (0, common_1.Delete)("/tenants/:tenantId/products/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove produto do tenant" }),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deleteTenantPlatformProduct", null);
__decorate([
    (0, common_1.Get)("/tenants/:id/usage-metrics"),
    (0, swagger_1.ApiOperation)({ summary: "Lista metricas de uso do tenant" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listTenantUsageMetrics", null);
__decorate([
    (0, common_1.Post)("/permissions"),
    (0, swagger_1.ApiOperation)({ summary: "Cria permissao" }),
    (0, swagger_1.ApiBody)({ type: PermissionRequestDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PermissionRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createPermission", null);
__decorate([
    (0, common_1.Get)("/permissions"),
    (0, swagger_1.ApiOperation)({ summary: "Lista permissoes" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listPermissions", null);
__decorate([
    (0, common_1.Get)("/permissions/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Busca permissao por id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getPermission", null);
__decorate([
    (0, common_1.Put)("/permissions/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza permissao" }),
    (0, swagger_1.ApiBody)({ type: PermissionRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PermissionRequestDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updatePermission", null);
__decorate([
    (0, common_1.Delete)("/permissions/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove permissao" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deletePermission", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)("Admin"),
    (0, swagger_1.ApiBearerAuth)("userAuth"),
    (0, common_1.Controller)("/api/v1/admin"),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
