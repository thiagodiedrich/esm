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
import { DbRouterModule } from "./db-router/db-router.module";
import { KafkaModule } from "./kafka/kafka.module";
import { UsageController } from "./usage/usage.controller";
import { UsageService } from "./usage/usage.service";
import { TenantMigrationController } from "./tenants/tenant-migration.controller";
import { TenantMigrationService } from "./tenants/tenant-migration.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"]
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
    UsageController,
    TenantMigrationController
  ],
  providers: [
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
    TenantMigrationService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}
