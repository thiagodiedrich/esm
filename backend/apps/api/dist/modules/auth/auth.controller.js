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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorators_1 = require("./auth.decorators");
const auth_service_1 = require("./auth.service");
const auth_tenant_service_1 = require("./auth.tenant.service");
const context_service_1 = require("../context/context.service");
class LoginRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "admin@empresa.com" }),
    __metadata("design:type", String)
], LoginRequestDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "senhaSegura123" }),
    __metadata("design:type", String)
], LoginRequestDto.prototype, "password", void 0);
class TokenResponseDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TokenResponseDto.prototype, "access_token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TokenResponseDto.prototype, "refresh_token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 900 }),
    __metadata("design:type", Number)
], TokenResponseDto.prototype, "expires_in", void 0);
class RefreshRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], RefreshRequestDto.prototype, "refresh_token", void 0);
class MeResponseDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MeResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MeResponseDto.prototype, "tenant_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], MeResponseDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], MeResponseDto.prototype, "partner_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], MeResponseDto.prototype, "is_active", void 0);
let AuthController = class AuthController {
    constructor(authService, tenantService, contextService) {
        this.authService = authService;
        this.tenantService = tenantService;
        this.contextService = contextService;
    }
    async login(body, request) {
        const tenant = await this.tenantService.resolveTenantOrFail(request);
        const user = await this.authService.validateUserCredentials(tenant.id, body.email, body.password);
        if (!user) {
            throw new common_1.UnauthorizedException("Credenciais invalidas.");
        }
        const context = await this.contextService.resolveLoginContext(tenant.id, user.id);
        if (!context) {
            throw new common_1.UnauthorizedException("Contexto invalido para login.");
        }
        const tokens = await this.authService.issueTokens({
            userId: user.id,
            tenantId: tenant.id,
            organizationId: context.organizationId,
            workspaceId: context.workspaceId
        });
        return tokens;
    }
    async refresh(body) {
        if (!body?.refresh_token) {
            throw new common_1.BadRequestException("Refresh token ausente.");
        }
        const payload = await this.authService.verifyUserToken(body.refresh_token);
        if (payload.type !== "refresh" || !payload.tenant_id || !payload.sub) {
            throw new common_1.UnauthorizedException("Refresh token invalido.");
        }
        const user = await this.authService.getUserById(payload.tenant_id, payload.sub);
        if (!user || !user.is_active) {
            throw new common_1.UnauthorizedException("Usuario inativo.");
        }
        const context = await this.contextService.resolveLoginContext(payload.tenant_id, payload.sub);
        if (!context?.organizationId || !context?.workspaceId) {
            throw new common_1.UnauthorizedException("Contexto invalido para login.");
        }
        return this.authService.issueTokens({
            userId: payload.sub,
            tenantId: payload.tenant_id,
            organizationId: context.organizationId,
            workspaceId: context.workspaceId
        });
    }
    async me(request) {
        const user = request.user;
        if (!user || user.auth_type !== "user" || user.type !== "access") {
            throw new common_1.UnauthorizedException("Access token necessario.");
        }
        const record = await this.authService.getUserById(user.tenant_id ?? "", user.sub);
        if (!record) {
            throw new common_1.UnauthorizedException("Usuario nao encontrado.");
        }
        return record;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.Post)("/login"),
    (0, swagger_1.ApiOperation)({ summary: "Login de usuario" }),
    (0, swagger_1.ApiBody)({ type: LoginRequestDto }),
    (0, swagger_1.ApiOkResponse)({ type: TokenResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.Post)("/refresh"),
    (0, swagger_1.ApiOperation)({ summary: "Refresh de token" }),
    (0, swagger_1.ApiBody)({ type: RefreshRequestDto }),
    (0, swagger_1.ApiOkResponse)({ type: TokenResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RefreshRequestDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Get)("/me"),
    (0, swagger_1.ApiOperation)({ summary: "Dados do usuario logado" }),
    (0, swagger_1.ApiBearerAuth)("userAuth"),
    (0, swagger_1.ApiOkResponse)({ type: MeResponseDto }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)("Autenticação"),
    (0, common_1.Controller)("/api/v1/auth"),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        auth_tenant_service_1.AuthTenantService,
        context_service_1.AuthContextService])
], AuthController);
