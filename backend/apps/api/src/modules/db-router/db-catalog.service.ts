import { Injectable } from "@nestjs/common";

@Injectable()
export class DbCatalogService {
  resolveConnectionString(logicalName: string): string | undefined {
    const key = `DB_CATALOG__${logicalName}`;
    return process.env[key];
  }
}
