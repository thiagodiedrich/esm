import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import { DbCatalogService } from "./db-catalog.service";

interface TenantDbRow {
  erp_db: string | null;
}

@Injectable()
export class TenantDbService {
  private readonly poolCache = new Map<string, Pool>();

  constructor(
    @Inject(PG_POOL) private readonly controlPlanePool: Pool,
    private readonly catalog: DbCatalogService
  ) {}

  async getErpPool(tenantId: string): Promise<Pool> {
    const logicalName = await this.getTenantErpLogicalName(tenantId);
    if (!logicalName) {
      throw new BadRequestException("ERP DB nao configurado para o tenant.");
    }

    const connectionString = this.catalog.resolveConnectionString(logicalName);
    if (!connectionString) {
      throw new BadRequestException("Connection string nao encontrada no catalogo.");
    }

    const cached = this.poolCache.get(logicalName);
    if (cached) {
      return cached;
    }

    const pool = new Pool({ connectionString });
    this.poolCache.set(logicalName, pool);
    return pool;
  }

  private async getTenantErpLogicalName(tenantId: string): Promise<string | null> {
    const result = await this.controlPlanePool.query<TenantDbRow>(
      "SELECT erp_db FROM tenants WHERE id = $1",
      [tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new BadRequestException("Code 6: Tenant nao encontrado");
    }

    return result.rows[0].erp_db;
  }
}
