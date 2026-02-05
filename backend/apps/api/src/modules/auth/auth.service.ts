import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Algorithm } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import Redis from "ioredis";
import { PG_POOL } from "../database/database.module";
import { AuthUserPayload } from "./auth.types";

const PREFIX_BLACKLIST_ACCESS = "auth:blacklist:access:";
const PREFIX_BLACKLIST_REFRESH = "auth:blacklist:refresh:";

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
  tenant_id?: string;
  partner_id?: string | null;
  email?: string | null;
}

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<
    string,
    { count: number; blockedUntil?: number }
  >();
  private readonly redis: Redis | null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(PG_POOL) private readonly pool: Pool
  ) {
    const redisUrl = this.configService.get<string>("REDIS_URL");
    this.redis = redisUrl?.trim() ? new Redis(redisUrl) : null;
  }

  async verifyUserToken(token: string): Promise<AuthUserPayload> {
    return this.verifyToken(token);
  }

  async verifyServiceToken(token: string): Promise<AuthUserPayload> {
    return this.verifyToken(token);
  }

  private async verifyToken(token: string): Promise<AuthUserPayload> {
    const algorithm =
      (this.configService.get<string>("JWT_ALGORITHM") || "RS256") as Algorithm;

    let payload: AuthUserPayload;
    try {
      payload = await this.jwtService.verifyAsync<AuthUserPayload>(token, {
        algorithms: [algorithm]
      });
    } catch (error) {
      throw new UnauthorizedException("Token invalido ou expirado.");
    }

    if (payload.jti && this.redis) {
      const prefix =
        payload.type === "refresh" ? PREFIX_BLACKLIST_REFRESH : PREFIX_BLACKLIST_ACCESS;
      const key = `${prefix}${payload.jti}`;
      const revoked = await this.redis.get(key);
      if (revoked) {
        throw new UnauthorizedException("Token revogado.");
      }
    }

    return payload;
  }

  async validateUserCredentials(tenantId: string, email: string, password: string) {
    const key = `${tenantId}:${email.toLowerCase()}`;
    this.assertNotBlocked(key);

    const result = await this.pool.query<UserRecord>(
      "SELECT id, password_hash, is_active FROM res_users WHERE tenant_id = $1 AND email = $2",
      [tenantId, email]
    );

    if (result.rowCount === 0) {
      this.registerFailedAttempt(key);
      return null;
    }

    const user = result.rows[0];
    if (!user.is_active || !user.password_hash) {
      this.registerFailedAttempt(key);
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      this.registerFailedAttempt(key);
      return null;
    }

    this.clearFailedAttempts(key);
    return { id: user.id };
  }

  async getUserById(tenantId: string, userId: string) {
    const result = await this.pool.query<UserRecord>(
      "SELECT id, tenant_id, partner_id, email, is_active FROM res_users WHERE tenant_id = $1 AND id = $2",
      [tenantId, userId]
    );
    if (result.rowCount === 0) {
      return null;
    }
    const user = result.rows[0];
    return {
      id: user.id,
      tenant_id: user.tenant_id,
      partner_id: user.partner_id ?? null,
      email: user.email ?? "",
      is_active: user.is_active ?? null
    };
  }

  async issueTokens(input: IssueTokensInput): Promise<IssuedTokens> {
    const accessMinutes = Number(
      this.configService.get<string>("ACCESS_TOKEN_EXPIRE_MINUTES") || 15
    );
    const accessTtlSeconds = Math.max(1, accessMinutes) * 60;
    const refreshTtlSeconds = 7 * 24 * 60 * 60;

    const accessPayload: AuthUserPayload = {
      sub: input.userId,
      jti: randomUUID(),
      tenant_id: input.tenantId,
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      type: "access"
    };

    const refreshPayload: AuthUserPayload = {
      sub: input.userId,
      jti: randomUUID(),
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

  /**
   * Invalida o access token, revoga o refresh token (se informado) e registra o logout.
   * Requer Redis para blacklist; sem Redis apenas loga (tokens continuam válidos até expirar).
   */
  async logout(
    accessToken: string,
    refreshToken?: string | null
  ): Promise<{ sub: string; tenant_id?: string } | null> {
    let accessPayload: AuthUserPayload;
    try {
      accessPayload = await this.verifyUserToken(accessToken);
    } catch {
      return null;
    }
    if (accessPayload.type !== "access" || !accessPayload.jti) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const accessTtlMs = Math.max(0, ((accessPayload.exp ?? nowSec) - nowSec) * 1000);

    if (this.redis) {
      await this.redis.set(
        `${PREFIX_BLACKLIST_ACCESS}${accessPayload.jti}`,
        "1",
        "PX",
        accessTtlMs
      );
    }

    if (refreshToken?.trim()) {
      try {
        const refreshPayload = await this.verifyUserToken(refreshToken);
        if (refreshPayload.type === "refresh" && refreshPayload.jti) {
          const refreshTtlMs = Math.max(0, ((refreshPayload.exp ?? nowSec) - nowSec) * 1000);
          if (this.redis) {
            await this.redis.set(
              `${PREFIX_BLACKLIST_REFRESH}${refreshPayload.jti}`,
              "1",
              "PX",
              refreshTtlMs
            );
          }
        }
      } catch {
        // refresh inválido ou já expirado — ignorar
      }
    }

    return { sub: accessPayload.sub, tenant_id: accessPayload.tenant_id };
  }

  private assertNotBlocked(key: string) {
    const config = this.getFailbanConfig();
    if (!config) {
      return;
    }

    const state = this.loginAttempts.get(key);
    if (state?.blockedUntil && state.blockedUntil > Date.now()) {
      throw new UnauthorizedException("Usuario bloqueado temporariamente.");
    }
  }

  private registerFailedAttempt(key: string) {
    const config = this.getFailbanConfig();
    if (!config) {
      return;
    }

    const current = this.loginAttempts.get(key) ?? { count: 0 };
    const nextCount = current.count + 1;

    if (nextCount >= config.maxAttempts) {
      const blockedUntil = Date.now() + config.blockMinutes * 60 * 1000;
      this.loginAttempts.set(key, { count: 0, blockedUntil });
      return;
    }

    this.loginAttempts.set(key, { count: nextCount });
  }

  private clearFailedAttempts(key: string) {
    this.loginAttempts.delete(key);
  }

  private getFailbanConfig() {
    const maxAttempts = Number(this.configService.get("LOGIN_MAX_ATTEMPTS") ?? 0);
    const blockMinutes = Number(this.configService.get("LOGIN_BLOCK_MINUTES") ?? 0);
    if (maxAttempts > 0 && blockMinutes > 0) {
      return { maxAttempts, blockMinutes };
    }
    return null;
  }
}
