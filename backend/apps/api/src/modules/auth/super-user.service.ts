import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import { AuthUser } from "./auth.types";

interface SuperUserRow {
  user_is_super_tenant: boolean;
  user_is_super_admin: boolean;
  user_organization_uuid: string | null;
  tenant_is_super_tenant: boolean;
}

/**
 * Regras de acesso total (ignora roles e permissions):
 *
 * 1) Super tenant: usuário com is_super_tenant = true do tenant com is_super_tenant = true
 *    (empresa principal SaaS). Acesso total a todos os tenants, organizations, workspaces,
 *    rotas, menus e funcionalidades.
 *
 * 2) Super admin: usuário com is_super_admin = true no contexto (organization_id do JWT)
 *    igual ao organization_id do res_users. Acesso total a todas as organizations e
 *    workspaces do tenant e a todas as funcionalidades (rotas, menus, botões).
 */
@Injectable()
export class SuperUserService {
  private cache = new Map<string, { row: SuperUserRow; at: number }>();
  private readonly cacheTtlMs = 60_000;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Retorna true se o usuário tem acesso total (super tenant ou super admin).
   * Nesse caso, roles e permissions são ignorados.
   */
  async hasFullAccess(user: AuthUser | undefined): Promise<boolean> {
    if (!user?.sub || !user.tenant_id || user.auth_type !== "user") {
      return false;
    }
    const row = await this.loadSuperFlags(user.sub, user.tenant_id);
    if (!row) {
      return false;
    }
    if (row.user_is_super_tenant && row.tenant_is_super_tenant) {
      return true;
    }
    if (
      row.user_is_super_admin &&
      row.user_organization_uuid &&
      user.organization_id &&
      row.user_organization_uuid === user.organization_id
    ) {
      return true;
    }
    return false;
  }

  private async loadSuperFlags(
    userId: string,
    tenantId: string
  ): Promise<SuperUserRow | null> {
    const key = `${userId}:${tenantId}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.row;
    }
    const result = await this.pool.query<SuperUserRow>(
      `SELECT
         u.is_super_tenant AS user_is_super_tenant,
         u.is_super_admin AS user_is_super_admin,
         o.uuid AS user_organization_uuid,
         COALESCE(t.is_super_tenant, false) AS tenant_is_super_tenant
       FROM res_users u
       JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN res_organizations o ON o.id = u.organization_id
       WHERE u.uuid = $1 AND t.uuid = $2`,
      [userId, tenantId]
    );
    if (result.rowCount === 0) {
      return null;
    }
    const row = result.rows[0];
    this.cache.set(key, { row, at: Date.now() });
    return row;
  }
}
