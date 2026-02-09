import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { PG_POOL } from "../database/database.module";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return UUID_REGEX.test(value.trim()) ? value.trim() : null;
}

interface TenantInput {
  name: string;
  slug: string;
  id?: string | null;
  db_strategy?: string | null;
  control_plane_db?: string | null;
  erp_db?: string | null;
  telemetry_db?: string | null;
  migration_status?: string | null;
  first_organization_name?: string | null;
  first_user_email?: string | null;
  first_user_password?: string | null;
  first_user_name?: string | null;
}

interface PlanInput {
  code: string;
  name: string;
  description?: string | null;
}

interface PlatformProductInput {
  code: string;
  name: string;
  description?: string | null;
}

interface PlatformProductModuleInput {
  product_id: string;
  code: string;
  name: string;
}

interface TenantPlatformProductInput {
  product_id: string;
  plan_id: string;
  is_active?: boolean | null;
}

interface PermissionInput {
  resource: string;
  action: string;
  description?: string | null;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly configService: ConfigService
  ) {}

  async createTenant(input: TenantInput) {
    const slugExists = await this.pool.query(
      "SELECT id FROM tenants WHERE LOWER(slug) = LOWER($1)",
      [input.slug]
    );
    if ((slugExists.rowCount ?? 0) > 0) {
      throw new BadRequestException("Slug do tenant ja existe.");
    }

    const tenantId =
      parseUuid(input.id) ?? randomUUID();
    const countBefore = await this.pool.query("SELECT COUNT(*)::int AS c FROM tenants", []);
    const isFirstTenant = (countBefore.rows[0]?.c ?? 0) === 0;
    const masterTenantIdFromEnv = parseUuid(
      this.configService.get<string>("TENANT_MASTER_ADMIN_TENANT_ID") ?? null
    );
    const isSuperTenant =
      isFirstTenant || (!!masterTenantIdFromEnv && tenantId === masterTenantIdFromEnv);

    const createFirstOrgAndUser =
      !!input.first_organization_name?.trim() &&
      !!input.first_user_email?.trim() &&
      !!input.first_user_password;

    let transactionOpen = false;
    try {
      await this.pool.query("BEGIN");
      transactionOpen = true;

      await this.pool.query(
        `INSERT INTO tenants
         (id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
        [
          tenantId,
          input.name,
          input.slug,
          input.db_strategy ?? null,
          input.control_plane_db ?? null,
          input.erp_db ?? null,
          input.telemetry_db ?? null,
          input.migration_status ?? null,
          isSuperTenant
        ]
      );

      let organization: Record<string, unknown> | null = null;
      let user: Record<string, unknown> | null = null;

      if (createFirstOrgAndUser) {
        const orgId = randomUUID();
        await this.pool.query(
          `INSERT INTO res_organizations (id, tenant_id, partner_id, name, is_default, created_at, updated_at)
           VALUES ($1, $2, NULL, $3, TRUE, now(), now())`,
          [orgId, tenantId, input.first_organization_name!.trim()]
        );
        organization = {
          id: orgId,
          tenant_id: tenantId,
          name: input.first_organization_name!.trim(),
          is_default: true
        };

        const partnerId = randomUUID();
        const partnerName =
          (input.first_user_name ?? input.first_organization_name ?? input.first_user_email)!.trim();
        const userEmail = input.first_user_email!.trim();
        await this.pool.query(
          `INSERT INTO res_partners (id, tenant_id, organization_id, name, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, now(), now())`,
          [partnerId, tenantId, orgId, partnerName, userEmail]
        );
        await this.pool.query(
          "UPDATE res_organizations SET partner_id = $2, updated_at = now() WHERE id = $1 AND tenant_id = $3",
          [orgId, partnerId, tenantId]
        );

        const userId = randomUUID();
        const passwordHash = await bcrypt.hash(input.first_user_password!, 12);
        await this.pool.query(
          `INSERT INTO res_users
           (id, tenant_id, partner_id, email, password_hash, is_active, is_super_tenant, is_super_admin, organization_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8, now(), now())`,
          [
            userId,
            tenantId,
            partnerId,
            userEmail,
            passwordHash,
            isSuperTenant,
            isSuperTenant,
            orgId
          ]
        );
        user = {
          id: userId,
          tenant_id: tenantId,
          partner_id: partnerId,
          email: userEmail,
          is_super_tenant: isSuperTenant,
          is_super_admin: isSuperTenant,
          organization_id: orgId
        };
      }

      await this.pool.query("COMMIT");
      transactionOpen = false;

      const tenantRow = await this.pool.query(
        `SELECT id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
         FROM tenants WHERE id = $1`,
        [tenantId]
      );
      const tenant = tenantRow.rows[0];
      return organization ? { ...tenant, organization, user } : tenant;
    } catch (e) {
      if (transactionOpen) await this.pool.query("ROLLBACK");
      throw e;
    }
  }

  async listTenants() {
    const result = await this.pool.query(
      `SELECT id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
       FROM tenants
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async getTenant(id: string) {
    const result = await this.pool.query(
      `SELECT id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Code 8: Tenant nao encontrado");
    }
    return result.rows[0];
  }

  async updateTenant(id: string, input: TenantInput) {
    const result = await this.pool.query(
      `UPDATE tenants
       SET name = $2,
           slug = $3,
           db_strategy = $4,
           control_plane_db = $5,
           erp_db = $6,
           telemetry_db = $7,
           migration_status = $8,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, db_strategy, control_plane_db, erp_db, telemetry_db, migration_status, is_super_tenant, created_at, updated_at`,
      [
        id,
        input.name,
        input.slug,
        input.db_strategy ?? null,
        input.control_plane_db ?? null,
        input.erp_db ?? null,
        input.telemetry_db ?? null,
        input.migration_status ?? null
      ]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Code 5: Tenant nao encontrado");
    }
    return result.rows[0];
  }

  async updateTenantStatus(id: string, status: string) {
    const result = await this.pool.query(
      `UPDATE tenants
       SET migration_status = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, migration_status, updated_at`,
      [id, status]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Code65: Tenant nao encontrado");
    }
    return result.rows[0];
  }

  async createPlan(input: PlanInput) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO platform_plans (id, code, name, description, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, code, name, description, created_at`,
      [id, input.code, input.name, input.description ?? null]
    );
    return result.rows[0];
  }

  async listPlans() {
    const result = await this.pool.query(
      "SELECT id, code, name, description, created_at FROM platform_plans ORDER BY created_at DESC"
    );
    return result.rows;
  }

  async updatePlan(code: string, input: PlanInput) {
    const result = await this.pool.query(
      `UPDATE platform_plans
       SET name = $2, description = $3
       WHERE code = $1
       RETURNING id, code, name, description, created_at`,
      [code, input.name, input.description ?? null]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Plano nao encontrado.");
    }
    return result.rows[0];
  }

  async updatePlanStatus(code: string, status: string) {
    const current = await this.pool.query(
      "SELECT description FROM platform_plans WHERE code = $1",
      [code]
    );
    if (current.rowCount === 0) {
      throw new NotFoundException("Plano nao encontrado.");
    }
    const description = current.rows[0]?.description ?? null;
    let payload: Record<string, unknown> = {};
    if (description) {
      try {
        payload = JSON.parse(description);
      } catch {
        payload = { description };
      }
    }
    payload.status = status;
    const updated = await this.pool.query(
      "UPDATE platform_plans SET description = $2 WHERE code = $1 RETURNING id, code, name, description, created_at",
      [code, JSON.stringify(payload)]
    );
    return updated.rows[0];
  }

  async createPlatformProduct(input: PlatformProductInput) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO platform_products (id, code, name, description, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, code, name, description, created_at`,
      [id, input.code, input.name, input.description ?? null]
    );
    return result.rows[0];
  }

  async listPlatformProducts() {
    const result = await this.pool.query(
      "SELECT id, code, name, description, created_at FROM platform_products ORDER BY created_at DESC"
    );
    return result.rows;
  }

  async getPlatformProduct(id: string) {
    const result = await this.pool.query(
      "SELECT id, code, name, description, created_at FROM platform_products WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Produto nao encontrado.");
    }
    return result.rows[0];
  }

  async updatePlatformProduct(id: string, input: PlatformProductInput) {
    const result = await this.pool.query(
      `UPDATE platform_products SET code = $2, name = $3, description = $4
       WHERE id = $1 RETURNING id, code, name, description, created_at`,
      [id, input.code, input.name, input.description ?? null]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Produto nao encontrado.");
    }
    return result.rows[0];
  }

  async deletePlatformProduct(id: string) {
    const result = await this.pool.query("DELETE FROM platform_products WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException("Produto nao encontrado.");
    }
    return { status: "ok" };
  }

  async createPlatformProductModule(input: PlatformProductModuleInput) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO platform_product_modules (id, product_id, code, name, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, product_id, code, name, created_at`,
      [id, input.product_id, input.code, input.name]
    );
    return result.rows[0];
  }

  async listPlatformProductModules(productId?: string) {
    if (productId) {
      const result = await this.pool.query(
        `SELECT id, product_id, code, name, created_at FROM platform_product_modules WHERE product_id = $1 ORDER BY created_at DESC`,
        [productId]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      "SELECT id, product_id, code, name, created_at FROM platform_product_modules ORDER BY created_at DESC"
    );
    return result.rows;
  }

  async getPlatformProductModule(id: string) {
    const result = await this.pool.query(
      "SELECT id, product_id, code, name, created_at FROM platform_product_modules WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Modulo nao encontrado.");
    }
    return result.rows[0];
  }

  async updatePlatformProductModule(id: string, input: PlatformProductModuleInput) {
    const result = await this.pool.query(
      `UPDATE platform_product_modules SET product_id = $2, code = $3, name = $4 WHERE id = $1
       RETURNING id, product_id, code, name, created_at`,
      [id, input.product_id, input.code, input.name]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Modulo nao encontrado.");
    }
    return result.rows[0];
  }

  async deletePlatformProductModule(id: string) {
    const result = await this.pool.query("DELETE FROM platform_product_modules WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException("Modulo nao encontrado.");
    }
    return { status: "ok" };
  }

  async createTenantPlatformProduct(tenantId: string, input: TenantPlatformProductInput) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO tenant_platform_products (id, tenant_id, product_id, plan_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, tenant_id, product_id, plan_id, is_active, created_at`,
      [id, tenantId, input.product_id, input.plan_id, input.is_active ?? true]
    );
    return result.rows[0];
  }

  async listTenantPlatformProducts(tenantId: string) {
    const result = await this.pool.query(
      `SELECT id, tenant_id, product_id, plan_id, is_active, created_at
       FROM tenant_platform_products WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  async getTenantPlatformProduct(tenantId: string, id: string) {
    const result = await this.pool.query(
      `SELECT id, tenant_id, product_id, plan_id, is_active, created_at
       FROM tenant_platform_products WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Produto do tenant nao encontrado.");
    }
    return result.rows[0];
  }

  async updateTenantPlatformProduct(tenantId: string, id: string, input: TenantPlatformProductInput) {
    const result = await this.pool.query(
      `UPDATE tenant_platform_products SET product_id = $3, plan_id = $4, is_active = $5
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, product_id, plan_id, is_active, created_at`,
      [id, tenantId, input.product_id, input.plan_id, input.is_active ?? true]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Produto do tenant nao encontrado.");
    }
    return result.rows[0];
  }

  async deleteTenantPlatformProduct(tenantId: string, id: string) {
    const result = await this.pool.query(
      "DELETE FROM tenant_platform_products WHERE id = $1 AND tenant_id = $2",
      [id, tenantId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Produto do tenant nao encontrado.");
    }
    return { status: "ok" };
  }

  async listTenantUsageMetrics(tenantId: string) {
    const result = await this.pool.query(
      `SELECT id, tenant_id, metric_key, metric_value, period, source, created_at
       FROM tenant_usage_metrics WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  async createPermission(input: PermissionInput) {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO res_permissions (id, resource, action, description, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, resource, action, description, created_at`,
      [id, input.resource, input.action, input.description ?? null]
    );
    return result.rows[0];
  }

  async listPermissions() {
    const result = await this.pool.query(
      "SELECT id, resource, action, description, created_at FROM res_permissions ORDER BY resource, action"
    );
    return result.rows;
  }

  async getPermission(id: string) {
    const result = await this.pool.query(
      "SELECT id, resource, action, description, created_at FROM res_permissions WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Permissao nao encontrada.");
    }
    return result.rows[0];
  }

  async updatePermission(id: string, input: PermissionInput) {
    const result = await this.pool.query(
      `UPDATE res_permissions SET resource = $2, action = $3, description = $4 WHERE id = $1
       RETURNING id, resource, action, description, created_at`,
      [id, input.resource, input.action, input.description ?? null]
    );
    if (result.rowCount === 0) {
      throw new NotFoundException("Permissao nao encontrada.");
    }
    return result.rows[0];
  }

  async deletePermission(id: string) {
    const result = await this.pool.query("DELETE FROM res_permissions WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException("Permissao nao encontrada.");
    }
    return { status: "ok" };
  }
}
