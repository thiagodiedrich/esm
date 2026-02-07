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
  tenantSlug?: string;
  name?: string;
  organizationName?: string;
  workspaceName?: string | null;
}

interface UserRecord {
  id: string;
  password_hash: string | null;
  is_active: boolean | null;
  tenant_id?: string;
  partner_id?: string | null;
  organization_id?: string | null;
  email?: string | null;
}

export interface MeOrganization {
  id: string;
  name: string;
  is_default: boolean;
  workspaces: Array<{ id: string; name: string; is_active: boolean }>;
}

export interface MeCurrentContext {
  organization_id: string;
  organization_name: string;
  workspace_id: string | null;
  workspace_name: string | null;
  workspace_mode: "required" | "optional";
}

export interface GetMePayloadResult {
  user_id: string;
  email: string;
  name: string;
  tenant_id: string;
  tenant_slug: string;
  partner_id: string | null;
  is_active: boolean | null;
  organizations: MeOrganization[];
  current_context: MeCurrentContext | null;
  requires_context_selection: boolean;
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

  /**
   * Nomes para preencher o JWT (tenant_slug, name, organization_name, workspace_name).
   * Usado em login e refresh para o frontend exibir header/contexto sem depender de GET /me.
   */
  async getLoginDisplayNames(
    tenantId: string,
    userId: string,
    organizationId: string,
    workspaceId: string | null
  ): Promise<{ tenantSlug: string; name: string; organizationName: string; workspaceName: string | null }> {
    const slugResult = await this.pool.query<{ slug: string }>(
      "SELECT slug FROM tenants WHERE id = $1",
      [tenantId]
    );
    const tenantSlug = slugResult.rows[0]?.slug ?? "";
    const userResult = await this.pool.query<{ partner_id: string | null; email: string | null }>(
      "SELECT partner_id, email FROM res_users WHERE tenant_id = $1 AND id = $2",
      [tenantId, userId]
    );
    let name = "Usuário";
    if (userResult.rowCount) {
      const pid = userResult.rows[0].partner_id;
      const email = userResult.rows[0].email ?? "";
      if (pid) {
        const pResult = await this.pool.query<{ name: string | null }>(
          "SELECT name FROM res_partners WHERE id = $1",
          [pid]
        );
        name = (pResult.rows[0]?.name ?? email).trim() || email || "Usuário";
      } else {
        name = email.trim() || "Usuário";
      }
    }
    const orgResult = await this.pool.query<{ name: string | null }>(
      "SELECT name FROM res_organizations WHERE id = $1 AND tenant_id = $2",
      [organizationId, tenantId]
    );
    const organizationName = orgResult.rows[0]?.name ?? "";
    let workspaceName: string | null = null;
    if (workspaceId) {
      const wsResult = await this.pool.query<{ name: string | null }>(
        "SELECT name FROM res_workspaces WHERE id = $1 AND organization_id = $2",
        [workspaceId, organizationId]
      );
      workspaceName = wsResult.rows[0]?.name ?? null;
    }
    return { tenantSlug, name, organizationName, workspaceName };
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

  /**
   * Payload completo para GET /me: user_id, name, tenant_slug, organizations (com workspaces),
   * current_context (com nomes e workspace_mode), requires_context_selection.
   */
  async getMePayload(
    tenantId: string,
    userId: string,
    context: { organizationId?: string; workspaceId?: string | null }
  ): Promise<GetMePayloadResult | null> {
    const userResult = await this.pool.query<{
      id: string;
      tenant_id: string;
      partner_id: string | null;
      email: string | null;
      is_active: boolean | null;
      tenant_slug: string;
      partner_name: string | null;
    }>(
      `SELECT u.id, u.tenant_id, u.partner_id, u.email, u.is_active, t.slug AS tenant_slug, p.name AS partner_name
       FROM res_users u
       JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN res_partners p ON p.id = u.partner_id
       WHERE u.tenant_id = $1 AND u.id = $2`,
      [tenantId, userId]
    );
    if (userResult.rowCount === 0) {
      return null;
    }
    const row = userResult.rows[0];
    const name = (row.partner_name ?? row.email ?? "Usuário").trim() || "Usuário";

    const orgsResult = await this.pool.query<{
      id: string;
      name: string | null;
      is_default: boolean | null;
    }>(
      "SELECT id, name, is_default FROM res_organizations WHERE tenant_id = $1 ORDER BY created_at",
      [tenantId]
    );
    const orgIds = orgsResult.rows.map((o) => o.id);
    let workspacesByOrg: Map<string, Array<{ id: string; name: string; is_active: boolean }>> =
      new Map();
    if (orgIds.length > 0) {
      const wsResult = await this.pool.query<{
        id: string;
        organization_id: string;
        name: string | null;
      }>(
        "SELECT id, organization_id, name FROM res_workspaces WHERE organization_id = ANY($1::uuid[])",
        [orgIds]
      );
      for (const ws of wsResult.rows) {
        const list = workspacesByOrg.get(ws.organization_id) ?? [];
        list.push({
          id: ws.id,
          name: ws.name ?? "",
          is_active: true
        });
        workspacesByOrg.set(ws.organization_id, list);
      }
    }
    const organizations: MeOrganization[] = orgsResult.rows.map((o) => ({
      id: o.id,
      name: o.name ?? "",
      is_default: o.is_default ?? false,
      workspaces: workspacesByOrg.get(o.id) ?? []
    }));

    let current_context: MeCurrentContext | null = null;
    const organizationId = context.organizationId;
    const workspaceId = context.workspaceId ?? null;

    if (organizationId) {
      const orgRow = await this.pool.query<{ name: string | null }>(
        "SELECT name FROM res_organizations WHERE id = $1 AND tenant_id = $2",
        [organizationId, tenantId]
      );
      const organization_name = orgRow.rowCount ? (orgRow.rows[0].name ?? "") : "";
      let workspace_name: string | null = null;
      if (workspaceId) {
        const wsRow = await this.pool.query<{ name: string | null }>(
          "SELECT name FROM res_workspaces WHERE id = $1 AND organization_id = $2",
          [workspaceId, organizationId]
        );
        workspace_name = wsRow.rowCount ? (wsRow.rows[0].name ?? null) : null;
      }
      const settingsRow = await this.pool.query<{ workspace_mode: string | null }>(
        "SELECT workspace_mode FROM res_organization_settings WHERE organization_id = $1",
        [organizationId]
      );
      const workspace_mode =
        settingsRow.rows[0]?.workspace_mode === "required" ? "required" : "optional";

      current_context = {
        organization_id: organizationId,
        organization_name,
        workspace_id: workspaceId,
        workspace_name,
        workspace_mode
      };
    }

    return {
      user_id: row.id,
      email: row.email ?? "",
      name,
      tenant_id: row.tenant_id,
      tenant_slug: row.tenant_slug ?? "",
      partner_id: row.partner_id,
      is_active: row.is_active,
      organizations,
      current_context,
      requires_context_selection: !current_context
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
      tenant_slug: input.tenantSlug,
      organization_id: input.organizationId,
      organization_name: input.organizationName,
      workspace_id: input.workspaceId,
      workspace_name: input.workspaceName,
      name: input.name,
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
