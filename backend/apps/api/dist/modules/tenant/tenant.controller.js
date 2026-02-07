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
exports.TenantController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tenant_service_1 = require("./tenant.service");
class OrganizationRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "Organizacao Principal" }),
    __metadata("design:type", String)
], OrganizationRequestDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: true }),
    __metadata("design:type", Object)
], OrganizationRequestDto.prototype, "is_default", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: "Email do primeiro usuario da organizacao (is_super_admin = true)" }),
    __metadata("design:type", Object)
], OrganizationRequestDto.prototype, "first_user_email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: "Senha do primeiro usuario" }),
    __metadata("design:type", Object)
], OrganizationRequestDto.prototype, "first_user_password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, description: "Nome do primeiro usuario" }),
    __metadata("design:type", Object)
], OrganizationRequestDto.prototype, "first_user_name", void 0);
class WorkspaceRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    __metadata("design:type", String)
], WorkspaceRequestDto.prototype, "organization_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "Workspace Vendas" }),
    __metadata("design:type", String)
], WorkspaceRequestDto.prototype, "name", void 0);
class UserRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "usuario@empresa.com" }),
    __metadata("design:type", String)
], UserRequestDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: "senhaSegura123" }),
    __metadata("design:type", String)
], UserRequestDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: "550e8400-e29b-41d4-a716-446655440002" }),
    __metadata("design:type", Object)
], UserRequestDto.prototype, "partner_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, description: "Obrigatorio se partner_id nao for informado (cria partner e associa ao usuario)" }),
    __metadata("design:type", Object)
], UserRequestDto.prototype, "organization_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, description: "Nome do contato (partner) quando organization_id e informado sem partner_id" }),
    __metadata("design:type", Object)
], UserRequestDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true, example: true }),
    __metadata("design:type", Object)
], UserRequestDto.prototype, "is_active", void 0);
class UserPasswordDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "novaSenhaSegura123" }),
    __metadata("design:type", String)
], UserPasswordDto.prototype, "password", void 0);
class UserStatusDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: "Ativa ou desativa o usuario" }),
    __metadata("design:type", Boolean)
], UserStatusDto.prototype, "is_active", void 0);
class PartnerRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PartnerRequestDto.prototype, "organization_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "João Silva" }),
    __metadata("design:type", String)
], PartnerRequestDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PartnerRequestDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PartnerRequestDto.prototype, "telephone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PartnerRequestDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PartnerRequestDto.prototype, "document", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PartnerRequestDto.prototype, "location_address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PartnerRequestDto.prototype, "location_address_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], PartnerRequestDto.prototype, "location_address_zip", void 0);
class RoleRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "Vendedor" }),
    __metadata("design:type", String)
], RoleRequestDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], RoleRequestDto.prototype, "description", void 0);
class UserRoleRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserRoleRequestDto.prototype, "role_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], UserRoleRequestDto.prototype, "scope_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], UserRoleRequestDto.prototype, "scope_id", void 0);
class UserPermissionOverrideRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserPermissionOverrideRequestDto.prototype, "permission_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "allow", description: "allow ou deny" }),
    __metadata("design:type", String)
], UserPermissionOverrideRequestDto.prototype, "effect", void 0);
class OrganizationSettingsRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], OrganizationSettingsRequestDto.prototype, "workspace_mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], OrganizationSettingsRequestDto.prototype, "remember_last_context", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], OrganizationSettingsRequestDto.prototype, "menu_cache_ttl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], OrganizationSettingsRequestDto.prototype, "enable_mfa", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], OrganizationSettingsRequestDto.prototype, "enable_oauth", void 0);
let TenantController = class TenantController {
    constructor(tenantService) {
        this.tenantService = tenantService;
    }
    async createOrganization(body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.createOrganization(tenantId, body);
    }
    async listOrganizations(request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.listOrganizations(tenantId);
    }
    async updateOrganization(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.updateOrganization(tenantId, id, body);
    }
    async deleteOrganization(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.deleteOrganization(tenantId, id);
    }
    async createWorkspace(body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.createWorkspace(tenantId, body);
    }
    async listWorkspaces(request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.listWorkspaces(tenantId);
    }
    async updateWorkspace(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.updateWorkspace(tenantId, id, body);
    }
    async deleteWorkspace(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.deleteWorkspace(tenantId, id);
    }
    async createUser(body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.createUser(tenantId, body);
    }
    async listUsers(request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.listUsers(tenantId);
    }
    async updateUser(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.updateUser(tenantId, id, body);
    }
    async deleteUser(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.deleteUser(tenantId, id);
    }
    async updateUserPassword(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.updateUserPassword(tenantId, id, body.password);
    }
    async updateUserStatus(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.updateUserStatus(tenantId, id, body.is_active);
    }
    async createPartner(body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.createPartner(tenantId, body);
    }
    async listPartners(organizationId, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.listPartners(tenantId, organizationId);
    }
    async getPartner(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.getPartner(tenantId, id);
    }
    async updatePartner(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.updatePartner(tenantId, id, body);
    }
    async deletePartner(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.deletePartner(tenantId, id);
    }
    async createRole(body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.createRole(tenantId, body);
    }
    async listRoles(request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.listRoles(tenantId);
    }
    async getRole(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.getRole(tenantId, id);
    }
    async updateRole(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.updateRole(tenantId, id, body);
    }
    async deleteRole(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.deleteRole(tenantId, id);
    }
    async listUserRoles(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.listUserRoles(tenantId, id);
    }
    async addUserRole(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.addUserRole(tenantId, id, body);
    }
    async removeUserRole(userId, roleId, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.removeUserRole(tenantId, userId, roleId);
    }
    async listUserPermissionOverrides(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.listUserPermissionOverrides(tenantId, id);
    }
    async addUserPermissionOverride(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.addUserPermissionOverride(tenantId, id, body);
    }
    async removeUserPermissionOverride(userId, permissionId, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.removeUserPermissionOverride(tenantId, userId, permissionId);
    }
    async getOrganizationSettings(id, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.getOrganizationSettings(tenantId, id);
    }
    async setOrganizationSettings(id, body, request) {
        const tenantId = this.getTenantId(request);
        return this.tenantService.setOrganizationSettings(tenantId, id, body);
    }
    getTenantId(request) {
        const user = request.user;
        if (!user || user.auth_type !== "user" || user.type !== "access" || !user.tenant_id) {
            throw new common_1.UnauthorizedException("Access token necessario.");
        }
        return user.tenant_id;
    }
};
exports.TenantController = TenantController;
__decorate([
    (0, common_1.Post)("/organizations"),
    (0, swagger_1.ApiOperation)({ summary: "Cria organizacao" }),
    (0, swagger_1.ApiBody)({
        type: OrganizationRequestDto,
        examples: {
            default: { summary: "Exemplo", value: { name: "Organizacao Principal", is_default: true } }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [OrganizationRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createOrganization", null);
__decorate([
    (0, common_1.Get)("/organizations"),
    (0, swagger_1.ApiOperation)({ summary: "Lista organizacoes" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "listOrganizations", null);
__decorate([
    (0, common_1.Put)("/organizations/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza organizacao" }),
    (0, swagger_1.ApiBody)({
        type: OrganizationRequestDto,
        examples: { default: { summary: "Exemplo", value: { name: "Organizacao Atualizada", is_default: false } } }
    }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, OrganizationRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateOrganization", null);
__decorate([
    (0, common_1.Delete)("/organizations/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove organizacao" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "deleteOrganization", null);
__decorate([
    (0, common_1.Post)("/workspaces"),
    (0, swagger_1.ApiOperation)({ summary: "Cria workspace" }),
    (0, swagger_1.ApiBody)({
        type: WorkspaceRequestDto,
        examples: {
            default: {
                summary: "Exemplo",
                value: { organization_id: "550e8400-e29b-41d4-a716-446655440000", name: "Workspace Vendas" }
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [WorkspaceRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createWorkspace", null);
__decorate([
    (0, common_1.Get)("/workspaces"),
    (0, swagger_1.ApiOperation)({ summary: "Lista workspaces" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "listWorkspaces", null);
__decorate([
    (0, common_1.Put)("/workspaces/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza workspace" }),
    (0, swagger_1.ApiBody)({
        type: WorkspaceRequestDto,
        examples: {
            default: {
                summary: "Exemplo",
                value: { organization_id: "550e8400-e29b-41d4-a716-446655440000", name: "Workspace Vendas Atualizado" }
            }
        }
    }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, WorkspaceRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateWorkspace", null);
__decorate([
    (0, common_1.Delete)("/workspaces/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove workspace" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "deleteWorkspace", null);
__decorate([
    (0, common_1.Post)("/users"),
    (0, swagger_1.ApiOperation)({ summary: "Cria usuario" }),
    (0, swagger_1.ApiBody)({
        type: UserRequestDto,
        examples: {
            default: {
                summary: "Exemplo",
                value: {
                    email: "usuario@empresa.com",
                    password: "senhaSegura123",
                    is_active: true
                }
            }
        }
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UserRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createUser", null);
__decorate([
    (0, common_1.Get)("/users"),
    (0, swagger_1.ApiOperation)({ summary: "Lista usuarios" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Put)("/users/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza usuario" }),
    (0, swagger_1.ApiBody)({ type: UserRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UserRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Delete)("/users/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove usuario" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "deleteUser", null);
__decorate([
    (0, common_1.Patch)("/users/:id/password"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza senha do usuario" }),
    (0, swagger_1.ApiBody)({
        type: UserPasswordDto,
        examples: { default: { summary: "Exemplo", value: { password: "novaSenhaSegura123" } } }
    }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UserPasswordDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateUserPassword", null);
__decorate([
    (0, common_1.Patch)("/users/:id/status"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza status do usuario" }),
    (0, swagger_1.ApiBody)({
        type: UserStatusDto,
        examples: { default: { summary: "Exemplo", value: { is_active: false } } }
    }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UserStatusDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateUserStatus", null);
__decorate([
    (0, common_1.Post)("/partners"),
    (0, swagger_1.ApiOperation)({ summary: "Cria contato" }),
    (0, swagger_1.ApiBody)({ type: PartnerRequestDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PartnerRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createPartner", null);
__decorate([
    (0, common_1.Get)("/partners"),
    (0, swagger_1.ApiOperation)({ summary: "Lista contatos" }),
    __param(0, (0, common_1.Query)("organization_id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "listPartners", null);
__decorate([
    (0, common_1.Get)("/partners/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Busca contato por id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getPartner", null);
__decorate([
    (0, common_1.Put)("/partners/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza contato" }),
    (0, swagger_1.ApiBody)({ type: PartnerRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PartnerRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updatePartner", null);
__decorate([
    (0, common_1.Delete)("/partners/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove contato" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "deletePartner", null);
__decorate([
    (0, common_1.Post)("/roles"),
    (0, swagger_1.ApiOperation)({ summary: "Cria regra de acesso" }),
    (0, swagger_1.ApiBody)({ type: RoleRequestDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RoleRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "createRole", null);
__decorate([
    (0, common_1.Get)("/roles"),
    (0, swagger_1.ApiOperation)({ summary: "Lista regras de acesso" }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "listRoles", null);
__decorate([
    (0, common_1.Get)("/roles/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Busca regra por id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getRole", null);
__decorate([
    (0, common_1.Put)("/roles/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza regra" }),
    (0, swagger_1.ApiBody)({ type: RoleRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, RoleRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "updateRole", null);
__decorate([
    (0, common_1.Delete)("/roles/:id"),
    (0, swagger_1.ApiOperation)({ summary: "Remove regra" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "deleteRole", null);
__decorate([
    (0, common_1.Get)("/users/:id/roles"),
    (0, swagger_1.ApiOperation)({ summary: "Lista regras do usuario" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "listUserRoles", null);
__decorate([
    (0, common_1.Post)("/users/:id/roles"),
    (0, swagger_1.ApiOperation)({ summary: "Associa regra ao usuario" }),
    (0, swagger_1.ApiBody)({ type: UserRoleRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UserRoleRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "addUserRole", null);
__decorate([
    (0, common_1.Delete)("/users/:userId/roles/:roleId"),
    (0, swagger_1.ApiOperation)({ summary: "Remove regra do usuario" }),
    __param(0, (0, common_1.Param)("userId")),
    __param(1, (0, common_1.Param)("roleId")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "removeUserRole", null);
__decorate([
    (0, common_1.Get)("/users/:id/permission-overrides"),
    (0, swagger_1.ApiOperation)({ summary: "Lista overrides de permissao do usuario" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "listUserPermissionOverrides", null);
__decorate([
    (0, common_1.Post)("/users/:id/permission-overrides"),
    (0, swagger_1.ApiOperation)({ summary: "Adiciona override de permissao ao usuario" }),
    (0, swagger_1.ApiBody)({ type: UserPermissionOverrideRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UserPermissionOverrideRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "addUserPermissionOverride", null);
__decorate([
    (0, common_1.Delete)("/users/:userId/permission-overrides/:permissionId"),
    (0, swagger_1.ApiOperation)({ summary: "Remove override de permissao do usuario" }),
    __param(0, (0, common_1.Param)("userId")),
    __param(1, (0, common_1.Param)("permissionId")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "removeUserPermissionOverride", null);
__decorate([
    (0, common_1.Get)("/organizations/:id/settings"),
    (0, swagger_1.ApiOperation)({ summary: "Busca configuracoes da empresa" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "getOrganizationSettings", null);
__decorate([
    (0, common_1.Put)("/organizations/:id/settings"),
    (0, swagger_1.ApiOperation)({ summary: "Cria ou atualiza configuracoes da empresa" }),
    (0, swagger_1.ApiBody)({ type: OrganizationSettingsRequestDto }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, OrganizationSettingsRequestDto, Object]),
    __metadata("design:returntype", Promise)
], TenantController.prototype, "setOrganizationSettings", null);
exports.TenantController = TenantController = __decorate([
    (0, swagger_1.ApiTags)("Tenant"),
    (0, swagger_1.ApiBearerAuth)("userAuth"),
    (0, common_1.Controller)("/api/v1/tenant"),
    __metadata("design:paramtypes", [tenant_service_1.TenantService])
], TenantController);
