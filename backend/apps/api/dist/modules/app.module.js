"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const auth_module_1 = require("./auth/auth.module");
const auth_guard_1 = require("./auth/auth.guard");
const rbac_guard_1 = require("./rbac/rbac.guard");
const database_module_1 = require("./database/database.module");
const auth_controller_1 = require("./auth/auth.controller");
const auth_tenant_service_1 = require("./auth/auth.tenant.service");
const context_service_1 = require("./context/context.service");
const context_controller_1 = require("./context/context.controller");
const menu_controller_1 = require("./menu/menu.controller");
const menu_service_1 = require("./menu/menu.service");
const observability_module_1 = require("./observability/observability.module");
const correlation_middleware_1 = require("./observability/correlation.middleware");
const cors_validation_middleware_1 = require("./observability/cors-validation.middleware");
const audit_middleware_1 = require("./observability/audit.middleware");
const db_router_module_1 = require("./db-router/db-router.module");
const kafka_module_1 = require("./kafka/kafka.module");
const usage_controller_1 = require("./usage/usage.controller");
const usage_service_1 = require("./usage/usage.service");
const tenant_migration_controller_1 = require("./tenants/tenant-migration.controller");
const tenant_migration_service_1 = require("./tenants/tenant-migration.service");
const branding_service_1 = require("./branding/branding.service");
const bootstrap_service_1 = require("./bootstrap/bootstrap.service");
const storage_service_1 = require("./storage/storage.service");
const alerts_service_1 = require("./alerts/alerts.service");
const branding_controller_1 = require("./branding/branding.controller");
const tenancy_middleware_1 = require("./tenancy/tenancy.middleware");
const storage_controller_1 = require("./storage/storage.controller");
const telemetry_controller_1 = require("./telemetry/telemetry.controller");
const admin_controller_1 = require("./admin/admin.controller");
const admin_service_1 = require("./admin/admin.service");
const tenant_controller_1 = require("./tenant/tenant.controller");
const tenant_service_1 = require("./tenant/tenant.service");
let AppModule = class AppModule {
    configure(consumer) {
        consumer
            .apply(cors_validation_middleware_1.CorsValidationMiddleware, correlation_middleware_1.CorrelationMiddleware, tenancy_middleware_1.TenancyMiddleware, audit_middleware_1.AuditMiddleware)
            .forRoutes("*");
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true
            }),
            database_module_1.DatabaseModule,
            db_router_module_1.DbRouterModule,
            observability_module_1.ObservabilityModule,
            kafka_module_1.KafkaModule,
            auth_module_1.AuthModule
        ],
        controllers: [
            app_controller_1.AppController,
            auth_controller_1.AuthController,
            context_controller_1.ContextController,
            menu_controller_1.MenuController,
            branding_controller_1.BrandingController,
            storage_controller_1.StorageController,
            telemetry_controller_1.TelemetryController,
            usage_controller_1.UsageController,
            tenant_migration_controller_1.TenantMigrationController,
            admin_controller_1.AdminController,
            tenant_controller_1.TenantController
        ],
        providers: [
            cors_validation_middleware_1.CorsValidationMiddleware,
            {
                provide: core_1.APP_GUARD,
                useClass: auth_guard_1.AppAuthGuard
            },
            {
                provide: core_1.APP_GUARD,
                useClass: rbac_guard_1.RbacGuard
            },
            auth_tenant_service_1.AuthTenantService,
            context_service_1.AuthContextService,
            menu_service_1.MenuService,
            usage_service_1.UsageService,
            tenant_migration_service_1.TenantMigrationService,
            branding_service_1.BrandingService,
            bootstrap_service_1.BootstrapService,
            storage_service_1.StorageService,
            alerts_service_1.AlertsService,
            admin_service_1.AdminService,
            tenant_service_1.TenantService
        ]
    })
], AppModule);
