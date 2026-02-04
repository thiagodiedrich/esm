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
exports.ContextController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("../auth/auth.service");
const context_service_1 = require("./context.service");
class ContextSwitchRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ContextSwitchRequestDto.prototype, "organization_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], ContextSwitchRequestDto.prototype, "workspace_id", void 0);
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
let ContextController = class ContextController {
    constructor(authService, contextService) {
        this.authService = authService;
        this.contextService = contextService;
    }
    async switchContext(body, request) {
        const user = request.user;
        if (!user || user.auth_type !== "user" || user.type !== "access") {
            throw new common_1.UnauthorizedException("Access token necessario.");
        }
        const context = await this.contextService.switchContext({
            tenantId: user.tenant_id ?? "",
            userId: user.sub,
            organizationId: body.organization_id,
            workspaceId: body.workspace_id ?? null
        });
        return this.authService.issueTokens({
            userId: user.sub,
            tenantId: user.tenant_id ?? "",
            organizationId: context.organizationId,
            workspaceId: context.workspaceId
        });
    }
};
exports.ContextController = ContextController;
__decorate([
    (0, common_1.Post)("/switch"),
    (0, swagger_1.ApiOperation)({ summary: "Troca de contexto (org/workspace)" }),
    (0, swagger_1.ApiBearerAuth)("userAuth"),
    (0, swagger_1.ApiBody)({ type: ContextSwitchRequestDto }),
    (0, swagger_1.ApiOkResponse)({ type: TokenResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ContextController.prototype, "switchContext", null);
exports.ContextController = ContextController = __decorate([
    (0, swagger_1.ApiTags)("Context"),
    (0, common_1.Controller)("/api/context"),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        context_service_1.AuthContextService])
], ContextController);
