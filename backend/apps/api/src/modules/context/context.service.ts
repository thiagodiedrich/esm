import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

interface OrganizationSettings {
  workspace_mode: string | null;
  remember_last_context: boolean | null;
}

interface LastContextRow {
  organization_uuid: string | null;
  workspace_uuid: string | null;
}

interface ResolvedContext {
  organizationId: string;
  workspaceId: string | null;
}

@Injectable()
export class AuthContextService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async resolveLoginContext(tenantUuid: string, userUuid: string): Promise<ResolvedContext> {
    const lastContext = await this.getUserLastContext(userUuid);
    if (lastContext?.organization_uuid) {
      const settings = await this.getOrganizationSettings(lastContext.organization_uuid);
      if (settings?.remember_last_context) {
        await this.ensureWorkspaceRequirement(
          lastContext.organization_uuid,
          lastContext.workspace_uuid
        );
        return {
          organizationId: lastContext.organization_uuid,
          workspaceId: lastContext.workspace_uuid
        };
      }
    }

    const defaultOrgUuid = await this.getDefaultOrganization(tenantUuid);
    if (!defaultOrgUuid) {
      throw new BadRequestException("Organizacao padrao nao configurada.");
    }

    await this.ensureWorkspaceRequirement(defaultOrgUuid, null);
    return { organizationId: defaultOrgUuid, workspaceId: null };
  }

  async switchContext(params: {
    tenantId: string;
    userId: string;
    organizationId: string;
    workspaceId: string | null;
  }) {
    const belongs = await this.organizationBelongsToTenant(
      params.organizationId,
      params.tenantId
    );
    if (!belongs) {
      throw new BadRequestException("Organizacao invalida para o tenant.");
    }

    if (params.workspaceId) {
      const validWorkspace = await this.workspaceBelongsToOrganization(
        params.workspaceId,
        params.organizationId
      );
      if (!validWorkspace) {
        throw new BadRequestException("Workspace invalido para a organizacao.");
      }
    }

    await this.ensureWorkspaceRequirement(params.organizationId, params.workspaceId);

    const settings = await this.getOrganizationSettings(params.organizationId);
    if (settings?.remember_last_context) {
      await this.saveUserLastContext(params.userId, params.organizationId, params.workspaceId);
    }

    return { organizationId: params.organizationId, workspaceId: params.workspaceId };
  }

  private async getUserLastContext(userUuid: string): Promise<LastContextRow | null> {
    const result = await this.pool.query<LastContextRow>(
      `SELECT o.uuid AS organization_uuid, w.uuid AS workspace_uuid
       FROM res_user_last_context uc
       JOIN res_users u ON u.id = uc.user_id
       LEFT JOIN res_organizations o ON o.id = uc.organization_id
       LEFT JOIN res_workspaces w ON w.id = uc.workspace_id
       WHERE u.uuid = $1
       ORDER BY uc.updated_at DESC LIMIT 1`,
      [userUuid]
    );

    return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
  }

  private async getOrganizationSettings(organizationUuid: string | null) {
    if (!organizationUuid) {
      return null;
    }

    const result = await this.pool.query<OrganizationSettings>(
      `SELECT s.workspace_mode, s.remember_last_context
       FROM res_organization_settings s
       JOIN res_organizations o ON o.id = s.organization_id
       WHERE o.uuid = $1`,
      [organizationUuid]
    );

    return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
  }

  private async getDefaultOrganization(tenantUuid: string): Promise<string | null> {
    const result = await this.pool.query<{ uuid: string }>(
      `SELECT o.uuid FROM res_organizations o
       JOIN tenants t ON t.id = o.tenant_id
       WHERE t.uuid = $1 AND o.is_default = true LIMIT 1`,
      [tenantUuid]
    );

    return (result.rowCount ?? 0) > 0 ? result.rows[0].uuid : null;
  }

  private async ensureWorkspaceRequirement(organizationUuid: string, workspaceUuid: string | null) {
    const settings = await this.getOrganizationSettings(organizationUuid);
    if (settings?.workspace_mode === "required" && !workspaceUuid) {
      throw new BadRequestException("Workspace obrigatorio para esta organizacao.");
    }
  }

  private async organizationBelongsToTenant(organizationUuid: string, tenantUuid: string) {
    const result = await this.pool.query(
      `SELECT 1 FROM res_organizations o
       JOIN tenants t ON t.id = o.tenant_id
       WHERE o.uuid = $1 AND t.uuid = $2`,
      [organizationUuid, tenantUuid]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private async workspaceBelongsToOrganization(workspaceUuid: string, organizationUuid: string) {
    const result = await this.pool.query(
      `SELECT 1 FROM res_workspaces w
       JOIN res_organizations o ON o.id = w.organization_id
       WHERE w.uuid = $1 AND o.uuid = $2`,
      [workspaceUuid, organizationUuid]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private async saveUserLastContext(
    userUuid: string,
    organizationUuid: string,
    workspaceUuid: string | null
  ) {
    const userIdRes = await this.pool.query<{ id: number }>(
      "SELECT id FROM res_users WHERE uuid = $1",
      [userUuid]
    );
    const userId = userIdRes.rows[0]?.id;
    if (!userId) return;

    const orgIdRes = await this.pool.query<{ id: number }>(
      "SELECT id FROM res_organizations WHERE uuid = $1",
      [organizationUuid]
    );
    const organizationId = orgIdRes.rows[0]?.id;
    if (!organizationId) return;

    let workspaceId: number | null = null;
    if (workspaceUuid) {
      const wsIdRes = await this.pool.query<{ id: number }>(
        "SELECT id FROM res_workspaces WHERE uuid = $1",
        [workspaceUuid]
      );
      workspaceId = wsIdRes.rows[0]?.id ?? null;
    }

    const existing = await this.pool.query<{ id: number }>(
      "SELECT id FROM res_user_last_context WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1",
      [userId]
    );

    if (existing.rowCount) {
      await this.pool.query(
        "UPDATE res_user_last_context SET organization_id = $1, workspace_id = $2, updated_at = now() WHERE id = $3",
        [organizationId, workspaceId, existing.rows[0].id]
      );
      return;
    }

    await this.pool.query(
      "INSERT INTO res_user_last_context (user_id, organization_id, workspace_id, updated_at) VALUES ($1, $2, $3, now())",
      [userId, organizationId, workspaceId]
    );
  }
}
