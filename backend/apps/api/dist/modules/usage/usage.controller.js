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
exports.UsageController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const usage_service_1 = require("./usage.service");
class UsageMetricInputDto {
}
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UsageMetricInputDto.prototype, "tenant_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: [
            "api.requests",
            "telemetry.events_ingested",
            "telemetry.payload_bytes",
            "erp.purchase_requests.created",
            "erp.purchase_orders.created"
        ]
    }),
    __metadata("design:type", String)
], UsageMetricInputDto.prototype, "metric_key", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], UsageMetricInputDto.prototype, "metric_value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "2026-02-03" }),
    __metadata("design:type", String)
], UsageMetricInputDto.prototype, "period", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "gateway" }),
    __metadata("design:type", String)
], UsageMetricInputDto.prototype, "source", void 0);
class UsageRequestDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UsageMetricInputDto] }),
    __metadata("design:type", Array)
], UsageRequestDto.prototype, "metrics", void 0);
class StatusResponseDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "ok" }),
    __metadata("design:type", String)
], StatusResponseDto.prototype, "status", void 0);
let UsageController = class UsageController {
    constructor(usageService) {
        this.usageService = usageService;
    }
    async recordMetrics(body, request) {
        if (request.user?.auth_type !== "service") {
            throw new common_1.UnauthorizedException("Service token necessario.");
        }
        if (!body.metrics?.length) {
            return { status: "ignored" };
        }
        for (const metric of body.metrics) {
            await this.usageService.recordMetric(metric);
        }
        return { status: "ok" };
    }
};
exports.UsageController = UsageController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: "Registra metricas internas (service token)" }),
    (0, swagger_1.ApiBearerAuth)("serviceAuth"),
    (0, swagger_1.ApiBody)({ type: UsageRequestDto }),
    (0, swagger_1.ApiOkResponse)({ type: StatusResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UsageController.prototype, "recordMetrics", null);
exports.UsageController = UsageController = __decorate([
    (0, swagger_1.ApiTags)("Internal"),
    (0, common_1.Controller)("/internal/usage/metrics"),
    __metadata("design:paramtypes", [usage_service_1.UsageService])
], UsageController);
