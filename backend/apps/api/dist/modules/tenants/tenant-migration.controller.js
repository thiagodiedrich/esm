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
exports.TenantMigrationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tenant_migration_service_1 = require("./tenant-migration.service");
class TenantPointerUpdateDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], TenantPointerUpdateDto.prototype, "tenant_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ["shared", "dedicated", "hybrid"] }),
    __metadata("design:type", String)
], TenantPointerUpdateDto.prototype, "db_strategy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], TenantPointerUpdateDto.prototype, "control_plane_db", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], TenantPointerUpdateDto.prototype, "erp_db", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, nullable: true }),
    __metadata("design:type", Object)
], TenantPointerUpdateDto.prototype, "telemetry_db", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ["idle", "migrating", "failed"] }),
    __metadata("design:type", String)
], TenantPointerUpdateDto.prototype, "migration_status", void 0);
class StatusResponseDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "ok" }),
    __metadata("design:type", String)
], StatusResponseDto.prototype, "status", void 0);
let TenantMigrationController = class TenantMigrationController {
    constructor(tenantMigration) {
        this.tenantMigration = tenantMigration;
    }
    async updatePointer(body, request) {
        if (request.user?.auth_type !== "service") {
            throw new common_1.UnauthorizedException("Service token necessario.");
        }
        if (!body?.tenant_id) {
            return { status: "ignored" };
        }
        await this.tenantMigration.updatePointers(body);
        return { status: "ok" };
    }
};
exports.TenantMigrationController = TenantMigrationController;
__decorate([
    (0, common_1.Post)("/pointer"),
    (0, swagger_1.ApiOperation)({ summary: "Atualiza ponteiros de migracao (service token)" }),
    (0, swagger_1.ApiBearerAuth)("serviceAuth"),
    (0, swagger_1.ApiBody)({ type: TenantPointerUpdateDto }),
    (0, swagger_1.ApiOkResponse)({ type: StatusResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TenantMigrationController.prototype, "updatePointer", null);
exports.TenantMigrationController = TenantMigrationController = __decorate([
    (0, swagger_1.ApiTags)("Internal"),
    (0, common_1.Controller)("/internal/tenants/migration"),
    __metadata("design:paramtypes", [tenant_migration_service_1.TenantMigrationService])
], TenantMigrationController);
