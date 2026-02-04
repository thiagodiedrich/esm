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
const db_router_module_1 = require("./db-router/db-router.module");
const kafka_module_1 = require("./kafka/kafka.module");
const usage_controller_1 = require("./usage/usage.controller");
const usage_service_1 = require("./usage/usage.service");
const tenant_migration_controller_1 = require("./tenants/tenant-migration.controller");
const tenant_migration_service_1 = require("./tenants/tenant-migration.service");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(correlation_middleware_1.CorrelationMiddleware).forRoutes("*");
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
            usage_controller_1.UsageController,
            tenant_migration_controller_1.TenantMigrationController
        ],
        providers: [
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
            tenant_migration_service_1.TenantMigrationService
        ]
    })
], AppModule);
