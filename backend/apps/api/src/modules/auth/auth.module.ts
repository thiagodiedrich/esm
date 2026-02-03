import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { readFileSync } from "fs";
import type { Algorithm } from "jsonwebtoken";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const privateKeyPath = configService.get<string>("JWT_PRIVATE_KEY_PATH");
        const publicKeyPath = configService.get<string>("JWT_PUBLIC_KEY_PATH");
        const algorithm =
          (configService.get<string>("JWT_ALGORITHM") || "RS256") as Algorithm;

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
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
