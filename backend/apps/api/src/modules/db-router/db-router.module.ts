import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { DbCatalogService } from "./db-catalog.service";
import { TenantDbService } from "./tenant-db.service";

@Module({
  imports: [DatabaseModule],
  providers: [DbCatalogService, TenantDbService],
  exports: [TenantDbService]
})
export class DbRouterModule {}
