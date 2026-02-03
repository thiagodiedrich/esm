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
  controllers: [AppController, AuthController, ContextController, MenuController],
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
    MenuService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}
