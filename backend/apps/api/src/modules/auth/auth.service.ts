import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Algorithm } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import { AuthUserPayload } from "./auth.types";

interface IssuedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface IssueTokensInput {
  userId: string;
  tenantId: string;
  organizationId: string;
  workspaceId: string | null;
}

interface UserRecord {
  id: string;
  password_hash: string | null;
  is_active: boolean | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(PG_POOL) private readonly pool: Pool
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

  async validateUserCredentials(tenantId: string, email: string, password: string) {
    const result = await this.pool.query<UserRecord>(
      "SELECT id, password_hash, is_active FROM res_users WHERE tenant_id = $1 AND email = $2",
      [tenantId, email]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const user = result.rows[0];
    if (!user.is_active || !user.password_hash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    return isValid ? { id: user.id } : null;
  }

  async issueTokens(input: IssueTokensInput): Promise<IssuedTokens> {
    const accessTtlSeconds = 15 * 60;
    const refreshTtlSeconds = 7 * 24 * 60 * 60;

    const accessPayload: AuthUserPayload = {
      sub: input.userId,
      tenant_id: input.tenantId,
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      type: "access"
    };

    const refreshPayload: AuthUserPayload = {
      sub: input.userId,
      tenant_id: input.tenantId,
      type: "refresh"
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, { expiresIn: accessTtlSeconds }),
      this.jwtService.signAsync(refreshPayload, { expiresIn: refreshTtlSeconds })
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: accessTtlSeconds
    };
  }
}
