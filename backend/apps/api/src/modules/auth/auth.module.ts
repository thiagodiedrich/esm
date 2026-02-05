import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { readFileSync } from "fs";
import type { Algorithm } from "jsonwebtoken";
import { AuthService } from "./auth.service";
import { SuperUserService } from "./super-user.service";
import { DatabaseModule } from "../database/database.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const algorithm =
          (configService.get<string>("JWT_ALGORITHM") || "RS256") as Algorithm;

        if (algorithm.startsWith("HS")) {
          const secret = configService.get<string>("JWT_SECRET");
          if (!secret) {
            throw new Error("JWT_SECRET nao configurado em .env.");
          }

          return {
            secret,
            signOptions: {
              algorithm
            }
          };
        }

        const privateKeyPath = configService.get<string>("JWT_PRIVATE_KEY_PATH");
        const publicKeyPath = configService.get<string>("JWT_PUBLIC_KEY_PATH");

        if (!privateKeyPath || !publicKeyPath) {
          throw new Error("JWT key paths nao configurados em .env.");
        }

        return {
          privateKey: readFileSync(privateKeyPath, "utf8"),
          publicKey: readFileSync(publicKeyPath, "utf8"),
          signOptions: {
            algorithm
          }
        };
      }
    })
  ],
  providers: [AuthService, SuperUserService],
  exports: [AuthService, SuperUserService]
})
export class AuthModule {}
