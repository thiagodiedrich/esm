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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let BrandingService = class BrandingService {
    constructor(configService) {
        this.configService = configService;
    }
    getWhiteLabelDefaults() {
        const enabled = (this.configService.get("TENANT_WHITE_LABEL_ENABLED") ?? "false").toLowerCase() ===
            "true";
        return {
            enabled,
            appName: this.configService.get("TENANT_WHITE_LABEL_DEFAULT_APP_NAME") ?? null,
            logoUrl: this.configService.get("TENANT_WHITE_LABEL_DEFAULT_LOGO_URL") ?? null,
            primaryColor: this.configService.get("TENANT_WHITE_LABEL_DEFAULT_PRIMARY_COLOR") ?? null,
            secondaryColor: this.configService.get("TENANT_WHITE_LABEL_DEFAULT_SECONDARY_COLOR") ?? null,
            supportEmail: this.configService.get("TENANT_WHITE_LABEL_DEFAULT_SUPPORT_EMAIL") ?? null,
            supportPhone: this.configService.get("TENANT_WHITE_LABEL_DEFAULT_SUPPORT_PHONE") ?? null,
            domain: this.configService.get("TENANT_WHITE_LABEL_DEFAULT_DOMAIN") ?? null
        };
    }
};
exports.BrandingService = BrandingService;
exports.BrandingService = BrandingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BrandingService);
