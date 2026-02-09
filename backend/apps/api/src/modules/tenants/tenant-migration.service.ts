import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

const VALID_DB_STRATEGIES = new Set(["shared", "dedicated", "hybrid"]);
const VALID_MIGRATION_STATUS = new Set(["idle", "migrating", "failed"]);

export interface TenantPointerUpdate {
  tenant_id: string;
  db_strategy: string;
  control_plane_db?: string | null;
  erp_db?: string | null;
  telemetry_db?: string | null;
  migration_status: string;
}

@Injectable()
export class TenantMigrationService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async updatePointers(input: TenantPointerUpdate) {
    if (!VALID_DB_STRATEGIES.has(input.db_strategy)) {
      throw new BadRequestException("db_strategy invalido.");
    }

    if (!VALID_MIGRATION_STATUS.has(input.migration_status)) {
      throw new BadRequestException("migration_status invalido.");
    }

    const result = await this.pool.query(
      `UPDATE tenants
       SET db_strategy = $1,
           control_plane_db = $2,
           erp_db = $3,
           telemetry_db = $4,
           migration_status = $5,
           updated_at = now()
       WHERE id = $6`,
      [
        input.db_strategy,
        input.control_plane_db ?? null,
        input.erp_db ?? null,
        input.telemetry_db ?? null,
        input.migration_status,
        input.tenant_id
      ]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new BadRequestException("Code 9: Tenant nao encontrado");
    }
  }
}
