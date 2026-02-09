import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { AppAuthGuard } from "./auth/auth.guard";
import { RbacGuard } from "./rbac/rbac.guard";
import { DatabaseModule } from "./database/database.module";
import { AuthController } from "./auth/auth.controller";
import { AuthTenantService } from "./auth/auth.tenant.service";
import { AuthContextService } from "./context/context.service";
import { ContextController } from "./context/context.controller";
import { MenuController } from "./menu/menu.controller";
import { MenuService } from "./menu/menu.service";
import { ObservabilityModule } from "./observability/observability.module";
import { CorrelationMiddleware } from "./observability/correlation.middleware";
import { CorsValidationMiddleware } from "./observability/cors-validation.middleware";
import { AuditMiddleware } from "./observability/audit.middleware";
import { DbRouterModule } from "./db-router/db-router.module";
import { KafkaModule } from "./kafka/kafka.module";
import { UsageController } from "./usage/usage.controller";
import { UsageService } from "./usage/usage.service";
import { TenantMigrationController } from "./tenants/tenant-migration.controller";
import { TenantMigrationService } from "./tenants/tenant-migration.service";
import { BrandingService } from "./branding/branding.service";
import { BootstrapService } from "./bootstrap/bootstrap.service";
import { StorageService } from "./storage/storage.service";
import { AlertsService } from "./alerts/alerts.service";
import { BrandingController } from "./branding/branding.controller";
import { TenancyMiddleware } from "./tenancy/tenancy.middleware";
import { StorageController } from "./storage/storage.controller";
import { TelemetryController } from "./telemetry/telemetry.controller";
import { AdminController } from "./admin/admin.controller";
import { AdminService } from "./admin/admin.service";
import { TenantController } from "./tenant/tenant.controller";
import { TenantService } from "./tenant/tenant.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    DatabaseModule,
    DbRouterModule,
    ObservabilityModule,
    KafkaModule,
    AuthModule
  ],
  controllers: [
    AppController,
    AuthController,
    ContextController,
    MenuController,
    BrandingController,
    StorageController,
    TelemetryController,
    UsageController,
    TenantMigrationController,
    AdminController,
    TenantController
  ],
  providers: [
    CorsValidationMiddleware,
    {
      provide: APP_GUARD,
      useClass: AppAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard
    },
    AuthTenantService,
    AuthContextService,
    MenuService,
    UsageService,
    TenantMigrationService,
    BrandingService,
    BootstrapService,
    StorageService,
    AlertsService,
    AdminService,
    TenantService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorsValidationMiddleware, CorrelationMiddleware, TenancyMiddleware, AuditMiddleware)
      .forRoutes("*");
  }
}
