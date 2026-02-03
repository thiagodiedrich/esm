import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { PG_POOL } from "../database/database.module";

interface OrganizationSettings {
  workspace_mode: string | null;
  remember_last_context: boolean | null;
}

interface LastContextRow {
  organization_id: string | null;
  workspace_id: string | null;
}

interface ResolvedContext {
  organizationId: string;
  workspaceId: string | null;
}

@Injectable()
export class AuthContextService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async resolveLoginContext(tenantId: string, userId: string): Promise<ResolvedContext> {
    const lastContext = await this.getUserLastContext(userId);
    if (lastContext?.organization_id) {
      const settings = await this.getOrganizationSettings(lastContext.organization_id);
      if (settings?.remember_last_context) {
        await this.ensureWorkspaceRequirement(
          lastContext.organization_id,
          lastContext.workspace_id
        );
        return {
          organizationId: lastContext.organization_id,
          workspaceId: lastContext.workspace_id
        };
      }
    }

    const defaultOrgId = await this.getDefaultOrganization(tenantId);
    if (!defaultOrgId) {
      throw new BadRequestException("Organizacao padrao nao configurada.");
    }

    await this.ensureWorkspaceRequirement(defaultOrgId, null);
    return { organizationId: defaultOrgId, workspaceId: null };
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

  private async getUserLastContext(userId: string): Promise<LastContextRow | null> {
    const result = await this.pool.query<LastContextRow>(
      "SELECT organization_id, workspace_id FROM res_user_last_context WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1",
      [userId]
    );

    return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
  }

  private async getOrganizationSettings(organizationId: string | null) {
    if (!organizationId) {
      return null;
    }

    const result = await this.pool.query<OrganizationSettings>(
      "SELECT workspace_mode, remember_last_context FROM res_organization_settings WHERE organization_id = $1",
      [organizationId]
    );

    return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
  }

  private async getDefaultOrganization(tenantId: string): Promise<string | null> {
    const result = await this.pool.query<{ id: string }>(
      "SELECT id FROM res_organizations WHERE tenant_id = $1 AND is_default = true LIMIT 1",
      [tenantId]
    );

    return (result.rowCount ?? 0) > 0 ? result.rows[0].id : null;
  }

  private async ensureWorkspaceRequirement(organizationId: string, workspaceId: string | null) {
    const settings = await this.getOrganizationSettings(organizationId);
    if (settings?.workspace_mode === "required" && !workspaceId) {
      throw new BadRequestException("Workspace obrigatorio para esta organizacao.");
    }
  }

  private async organizationBelongsToTenant(organizationId: string, tenantId: string) {
    const result = await this.pool.query(
      "SELECT 1 FROM res_organizations WHERE id = $1 AND tenant_id = $2",
      [organizationId, tenantId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private async workspaceBelongsToOrganization(workspaceId: string, organizationId: string) {
    const result = await this.pool.query(
      "SELECT 1 FROM res_workspaces WHERE id = $1 AND organization_id = $2",
      [workspaceId, organizationId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private async saveUserLastContext(
    userId: string,
    organizationId: string,
    workspaceId: string | null
  ) {
    const existing = await this.pool.query<{ id: string }>(
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
      "INSERT INTO res_user_last_context (id, user_id, organization_id, workspace_id, updated_at) VALUES ($1, $2, $3, $4, now())",
      [randomUUID(), userId, organizationId, workspaceId]
    );
  }
}
