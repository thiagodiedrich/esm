import { Module } from "@nestjs/common";
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"]
    }),
    DatabaseModule,
    AuthModule
  ],
  controllers: [AppController, AuthController, ContextController],
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
    AuthContextService
  ]
})
export class AppModule {}
