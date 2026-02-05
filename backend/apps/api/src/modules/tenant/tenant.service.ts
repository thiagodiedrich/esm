import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { PG_POOL } from "../database/database.module";

interface OrganizationInput {
  name: string;
  is_default?: boolean | null;
  first_user_email?: string | null;
  first_user_password?: string | null;
  first_user_name?: string | null;
}

interface WorkspaceInput {
  organization_id: string;
  name: string;
}

interface UserInput {
  email: string;
  password?: string;
  partner_id?: string | null;
  organization_id?: string | null;
  name?: string | null;
  is_active?: boolean | null;
}

interface PartnerInput {
  organization_id?: string | null;
  name: string;
  email?: string | null;
  telephone?: string | null;
  type?: string | null;
  document?: string | null;
  location_address?: string | null;
  location_address_number?: string | null;
  location_address_zip?: string | null;
}

interface RoleInput {
  name: string;
  description?: string | null;
}

interface UserRoleInput {
  role_id: string;
  scope_type?: string | null;
  scope_id?: string | null;
}

interface UserPermissionOverrideInput {
  permission_id: string;
  effect: string;
}

interface OrganizationSettingsInput {
  workspace_mode?: string | null;
  remember_last_context?: boolean | null;
  menu_cache_ttl?: number | null;
  enable_mfa?: boolean | null;
  enable_oauth?: boolean | null;
}

@Injectable()
export class TenantService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createOrganization(tenantId: string, input: OrganizationInput) {
    const orgId = randomUUID();
    const createFirstUser =
      !!input.first_user_email?.trim() && !!input.first_user_password;

    let transactionOpen = false;
    try {
      await this.pool.query("BEGIN");
      transactionOpen = true;

      await this.pool.query(
        `INSERT INTO res_organizations (id, tenant_id, partner_id, name, is_default, created_at, updated_at)
         VALUES ($1, $2, NULL, $3, $4, now(), now())`,
        [orgId, tenantId, input.name, input.is_default ?? false]
      );

      const partnerName =
        (input.first_user_name ?? input.name)?.trim() || input.name;
      const partnerEmail = input.first_user_email?.trim() ?? null;
      const partnerId = randomUUID();
      await this.pool.query(
        `INSERT INTO res_partners (id, tenant_id, organization_id, name, email, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, now(), now())`,
        [partnerId, tenantId, orgId, partnerName, partnerEmail]
      );
      await this.pool.query(
        "UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3",
        [orgId, partnerId, tenantId]
      );

      let user: Record<string, unknown> | null = null;
      if (createFirstUser) {
        const userEmail = input.first_user_email!.trim();
        const existing = await this.pool.query(
          "SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)",
          [tenantId, userEmail]
        );
        if ((existing.rowCount ?? 0) > 0) {
          await this.pool.query("ROLLBACK");
          transactionOpen = false;
          throw new BadRequestException("Email ja cadastrado no tenant.");
        }
        const userId = randomUUID();
        const passwordHash = await bcrypt.hash(input.first_user_password!, 12);
        await this.pool.query(
          `INSERT INTO res_users
           (id, tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, FALSE, TRUE, $6, now(), now())`,
          [userId, tenantId, partnerId, userEmail, passwordHash, orgId]
        );
        user = {
          id: userId,
          tenant_id: tenantId,
          partner_id: partnerId,
          email: userEmail,
          is_super_admin: true,
          organization_id: orgId
        };
      }

      await this.pool.query("COMMIT");
      transactionOpen = false;

      const orgRow = await this.pool.query(
        `SELECT id, tenant_id, partner_id, name, is_default, created_at, updated_at
         FROM res_organizations WHERE id = $1`,
        [orgId]
      );
      const org = orgRow.rows[0];
      return user ? { ...org, user } : org;
    } catch (e) {
      if (transactionOpen) await this.pool.query("ROLLBACK");
      throw e;
    }
  }

  async listOrganizations(tenantId: string) {
    const result = await this.pool.query(
      "SELECT id, tenant_id, name, is_default, created_at, updated_at FROM res_organizations WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    return result.rows;
  }

  async updateOrganization(tenantId: string, id: string, input: OrganizationInput) {
    const result = await this.pool.query(
      `UPDATE res_organizations
       SET name = $3, is_default = $4, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, name, is_default, created_at, updated_at`,
      [id, tenantId, input.name, input.is_default ?? false]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Organizacao nao encontrada.");
    }
    return result.rows[0];
  }

  async deleteOrganization(tenantId: string, id: string) {
    const result = await this.pool.query(
      "DELETE FROM res_organizations WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Organizacao nao encontrada.");
    }
    return { status: "ok" };
  }

  async createWorkspace(tenantId: string, input: WorkspaceInput) {
    const org = await this.pool.query(
      "SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2",
      [input.organization_id, tenantId]
    );
    if (org.rowCount === 0) {
      throw new BadRequestException("Organizacao invalida.");
    }
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO res_workspaces (id, tenant_id, organization_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, tenant_id, organization_id, name, created_at, updated_at`,
      [id, tenantId, input.organization_id, input.name]
    );
    return result.rows[0];
  }

  async listWorkspaces(tenantId: string) {
    const result = await this.pool.query(
      "SELECT id, tenant_id, organization_id, name, created_at, updated_at FROM res_workspaces WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    return result.rows;
  }

  async updateWorkspace(tenantId: string, id: string, input: WorkspaceInput) {
    const org = await this.pool.query(
      "SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2",
      [input.organization_id, tenantId]
    );
    if (org.rowCount === 0) {
      throw new BadRequestException("Organizacao invalida.");
    }
    const result = await this.pool.query(
      `UPDATE res_workspaces
       SET organization_id = $3, name = $4, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, organization_id, name, created_at, updated_at`,
      [id, tenantId, input.organization_id, input.name]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Workspace nao encontrado.");
    }
    return result.rows[0];
  }

  async deleteWorkspace(tenantId: string, id: string) {
    const result = await this.pool.query(
      "DELETE FROM res_workspaces WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Workspace nao encontrado.");
    }
    return { status: "ok" };
  }

  async createUser(tenantId: string, input: UserInput) {
    const existing = await this.pool.query(
      "SELECT id FROM res_users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)",
      [tenantId, input.email]
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new BadRequestException("Email ja cadastrado no tenant.");
    }

    const hasPartnerId = !!input.partner_id?.trim();
    const createPartner = !hasPartnerId && !!input.organization_id?.trim();

    if (!hasPartnerId && !createPartner) {
      throw new BadRequestException(
        "Informe partner_id ou organization_id para criar o contato (partner) do usuario."
      );
    }

    if (createPartner) {
      const org = await this.pool.query(
        "SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2",
        [input.organization_id!, tenantId]
      );
      if ((org.rowCount ?? 0) === 0) {
        throw new BadRequestException("Organizacao invalida ou nao pertence ao tenant.");
      }
    }

    const userId = randomUUID();
    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;

    if (createPartner) {
      const organizationId = input.organization_id!.trim();
      const partnerName = (input.name ?? input.email).trim();
      const partnerId = randomUUID();

      await this.pool.query("BEGIN");
      try {
        await this.pool.query(
          `INSERT INTO res_users
           (id, tenant_id, partner_id, email, password_hash, is_active, organization_id, created_at, updated_at)
           VALUES ($1, $2, NULL, $3, $4, $5, $6, now(), now())`,
          [userId, tenantId, input.email, passwordHash, input.is_active ?? true, organizationId]
        );
        await this.pool.query(
          `INSERT INTO res_partners (id, tenant_id, organization_id, name, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, now(), now())`,
          [partnerId, tenantId, organizationId, partnerName, input.email]
        );
        await this.pool.query(
          "UPDATE res_users SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3",
          [userId, partnerId, tenantId]
        );
        await this.pool.query("COMMIT");
      } catch (e) {
        await this.pool.query("ROLLBACK");
        throw e;
      }

      const result = await this.pool.query(
        `SELECT id, tenant_id, partner_id, email, is_active, organization_id, created_at, updated_at
         FROM res_users WHERE id = $1`,
        [userId]
      );
      return result.rows[0];
    }

    const result = await this.pool.query(
      `INSERT INTO res_users
       (id, tenant_id, partner_id, email, password_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING id, tenant_id, partner_id, email, is_active, created_at, updated_at`,
      [
        userId,
        tenantId,
        input.partner_id ?? null,
        input.email,
        passwordHash,
        input.is_active ?? true
      ]
    );
    return result.rows[0];
  }

  async listUsers(tenantId: string) {
    const result = await this.pool.query(
      "SELECT id, tenant_id, partner_id, email, is_active, created_at, updated_at FROM res_users WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    return result.rows;
  }

  async updateUser(tenantId: string, id: string, input: UserInput) {
    const result = await this.pool.query(
      `UPDATE res_users
       SET partner_id = $3, email = $4, is_active = $5, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, partner_id, email, is_active, created_at, updated_at`,
      [id, tenantId, input.partner_id ?? null, input.email, input.is_active ?? true]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    return result.rows[0];
  }

  async deleteUser(tenantId: string, id: string) {
    const result = await this.pool.query(
      "DELETE FROM res_users WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    return { status: "ok" };
  }

  async updateUserPassword(tenantId: string, id: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await this.pool.query(
      `UPDATE res_users
       SET password_hash = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, passwordHash]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    return { status: "ok" };
  }

  async updateUserStatus(tenantId: string, id: string, isActive: boolean) {
    const result = await this.pool.query(
      `UPDATE res_users
       SET is_active = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, isActive]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    return { status: "ok" };
  }

  async createPartner(tenantId: string, input: PartnerInput) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO res_partners (id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
       RETURNING id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at`,
      [
        id,
        tenantId,
        input.organization_id ?? null,
        input.name,
        input.email ?? null,
        input.telephone ?? null,
        input.type ?? null,
        input.document ?? null,
        input.location_address ?? null,
        input.location_address_number ?? null,
        input.location_address_zip ?? null
      ]
    );
    return result.rows[0];
  }

  async listPartners(tenantId: string, organizationId?: string) {
    if (organizationId) {
      const result = await this.pool.query(
        `SELECT id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at
         FROM res_partners WHERE tenant_id = $1 AND organization_id = $2 ORDER BY created_at DESC`,
        [tenantId, organizationId]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      `SELECT id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at
       FROM res_partners WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  async getPartner(tenantId: string, id: string) {
    const result = await this.pool.query(
      `SELECT id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at
       FROM res_partners WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Contato nao encontrado.");
    }
    return result.rows[0];
  }

  async updatePartner(tenantId: string, id: string, input: PartnerInput) {
    const result = await this.pool.query(
      `UPDATE res_partners
       SET organization_id = $3, name = $4, email = $5, telephone = $6, type = $7, document = $8,
           location_address = $9, location_address_number = $10, location_address_zip = $11, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, organization_id, name, email, telephone, type, document, location_address, location_address_number, location_address_zip, created_at, updated_at`,
      [
        id,
        tenantId,
        input.organization_id ?? null,
        input.name,
        input.email ?? null,
        input.telephone ?? null,
        input.type ?? null,
        input.document ?? null,
        input.location_address ?? null,
        input.location_address_number ?? null,
        input.location_address_zip ?? null
      ]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Contato nao encontrado.");
    }
    return result.rows[0];
  }

  async deletePartner(tenantId: string, id: string) {
    const result = await this.pool.query(
      "DELETE FROM res_partners WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Contato nao encontrado.");
    }
    return { status: "ok" };
  }

  async createRole(tenantId: string, input: RoleInput) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO res_roles (id, tenant_id, name, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, tenant_id, name, description, created_at, updated_at`,
      [id, tenantId, input.name, input.description ?? null]
    );
    return result.rows[0];
  }

  async listRoles(tenantId: string) {
    const result = await this.pool.query(
      "SELECT id, tenant_id, name, description, created_at, updated_at FROM res_roles WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    return result.rows;
  }

  async getRole(tenantId: string, id: string) {
    const result = await this.pool.query(
      "SELECT id, tenant_id, name, description, created_at, updated_at FROM res_roles WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Regra nao encontrada.");
    }
    return result.rows[0];
  }

  async updateRole(tenantId: string, id: string, input: RoleInput) {
    const result = await this.pool.query(
      `UPDATE res_roles SET name = $3, description = $4, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, name, description, created_at, updated_at`,
      [id, tenantId, input.name, input.description ?? null]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Regra nao encontrada.");
    }
    return result.rows[0];
  }

  async deleteRole(tenantId: string, id: string) {
    const result = await this.pool.query(
      "DELETE FROM res_roles WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Regra nao encontrada.");
    }
    return { status: "ok" };
  }

  async listUserRoles(tenantId: string, userId: string) {
    const user = await this.pool.query(
      "SELECT id FROM res_users WHERE id = $1 AND tenant_id = $2",
      [userId, tenantId]
    );
    if (user.rowCount === 0) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    const result = await this.pool.query(
      `SELECT ur.id, ur.user_id, ur.role_id, ur.scope_type, ur.scope_id, ur.created_at, r.name as role_name
       FROM res_user_roles ur
       JOIN res_roles r ON r.id = ur.role_id AND r.tenant_id = $1
       WHERE ur.user_id = $2`,
      [tenantId, userId]
    );
    return result.rows;
  }

  async addUserRole(tenantId: string, userId: string, input: UserRoleInput) {
    const user = await this.pool.query(
      "SELECT id FROM res_users WHERE id = $1 AND tenant_id = $2",
      [userId, tenantId]
    );
    if (user.rowCount === 0) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    const role = await this.pool.query(
      "SELECT id FROM res_roles WHERE id = $1 AND tenant_id = $2",
      [input.role_id, tenantId]
    );
    if (role.rowCount === 0) {
      throw new BadRequestException("Regra invalida.");
    }
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO res_user_roles (id, user_id, role_id, scope_type, scope_id, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, user_id, role_id, scope_type, scope_id, created_at`,
      [id, userId, input.role_id, input.scope_type ?? null, input.scope_id ?? null]
    );
    return result.rows[0];
  }

  async removeUserRole(tenantId: string, userId: string, roleId: string) {
    const result = await this.pool.query(
      `DELETE FROM res_user_roles ur
       USING res_roles r
       WHERE ur.role_id = r.id AND r.tenant_id = $1 AND ur.user_id = $2 AND ur.role_id = $3`,
      [tenantId, userId, roleId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Vinculo nao encontrado.");
    }
    return { status: "ok" };
  }

  async listUserPermissionOverrides(tenantId: string, userId: string) {
    const user = await this.pool.query(
      "SELECT id FROM res_users WHERE id = $1 AND tenant_id = $2",
      [userId, tenantId]
    );
    if (user.rowCount === 0) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    const result = await this.pool.query(
      `SELECT o.id, o.user_id, o.permission_id, o.effect, o.created_at, p.resource, p.action
       FROM res_user_permission_overrides o
       JOIN res_permissions p ON p.id = o.permission_id
       WHERE o.user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  async addUserPermissionOverride(tenantId: string, userId: string, input: UserPermissionOverrideInput) {
    const user = await this.pool.query(
      "SELECT id FROM res_users WHERE id = $1 AND tenant_id = $2",
      [userId, tenantId]
    );
    if (user.rowCount === 0) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO res_user_permission_overrides (id, user_id, permission_id, effect, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, user_id, permission_id, effect, created_at`,
      [id, userId, input.permission_id, input.effect]
    );
    return result.rows[0];
  }

  async removeUserPermissionOverride(tenantId: string, userId: string, permissionId: string) {
    const result = await this.pool.query(
      "DELETE FROM res_user_permission_overrides WHERE user_id = $1 AND permission_id = $2",
      [userId, permissionId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Override nao encontrado.");
    }
    return { status: "ok" };
  }

  async getOrganizationSettings(tenantId: string, organizationId: string) {
    const org = await this.pool.query(
      "SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2",
      [organizationId, tenantId]
    );
    if (org.rowCount === 0) {
      throw new NotFoundException("Organizacao nao encontrada.");
    }
    const result = await this.pool.query(
      `SELECT id, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at
       FROM res_organization_settings WHERE organization_id = $1`,
      [organizationId]
    );
    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0];
  }

  async setOrganizationSettings(tenantId: string, organizationId: string, input: OrganizationSettingsInput) {
    const org = await this.pool.query(
      "SELECT id FROM res_organizations WHERE id = $1 AND tenant_id = $2",
      [organizationId, tenantId]
    );
    if (org.rowCount === 0) {
      throw new NotFoundException("Organizacao nao encontrada.");
    }
    const existing = await this.pool.query(
      "SELECT id FROM res_organization_settings WHERE organization_id = $1",
      [organizationId]
    );
    if (existing.rowCount === 0) {
      const id = randomUUID();
      const result = await this.pool.query(
        `INSERT INTO res_organization_settings (id, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
         RETURNING id, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at`,
        [
          id,
          organizationId,
          input.workspace_mode ?? null,
          input.remember_last_context ?? null,
          input.menu_cache_ttl ?? null,
          input.enable_mfa ?? null,
          input.enable_oauth ?? null
        ]
      );
      return result.rows[0];
    }
    const result = await this.pool.query(
      `UPDATE res_organization_settings
       SET workspace_mode = $2, remember_last_context = $3, menu_cache_ttl = $4, enable_mfa = $5, enable_oauth = $6, updated_at = now()
       WHERE organization_id = $1
       RETURNING id, organization_id, workspace_mode, remember_last_context, menu_cache_ttl, enable_mfa, enable_oauth, created_at, updated_at`,
      [
        organizationId,
        input.workspace_mode ?? null,
        input.remember_last_context ?? null,
        input.menu_cache_ttl ?? null,
        input.enable_mfa ?? null,
        input.enable_oauth ?? null
      ]
    );
    return result.rows[0];
  }
}
