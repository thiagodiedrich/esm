import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Algorithm } from "jsonwebtoken";
import { AuthUserPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async verifyUserToken(token: string): Promise<AuthUserPayload> {
    return this.verifyToken(token);
  }

  async verifyServiceToken(token: string): Promise<AuthUserPayload> {
    return this.verifyToken(token);
  }

  private async verifyToken(token: string): Promise<AuthUserPayload> {
    const algorithm =
      (this.configService.get<string>("JWT_ALGORITHM") || "RS256") as Algorithm;

    try {
      return await this.jwtService.verifyAsync<AuthUserPayload>(token, {
        algorithms: [algorithm]
      });
    } catch (error) {
      throw new UnauthorizedException("Token invalido ou expirado.");
    }
  }
}
