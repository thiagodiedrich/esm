import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import { TenantMigrationService, TenantPointerUpdate } from "./tenant-migration.service";
import { FastifyRequest } from "fastify";

@Controller("/internal/tenants/migration")
export class TenantMigrationController {
  constructor(private readonly tenantMigration: TenantMigrationService) {}

  @Post("/pointer")
  async updatePointer(@Body() body: TenantPointerUpdate, @Req() request: FastifyRequest) {
    if (request.user?.auth_type !== "service") {
      throw new UnauthorizedException("Service token necessario.");
    }

    if (!body?.tenant_id) {
      return { status: "ignored" };
    }

    await this.tenantMigration.updatePointers(body);
    return { status: "ok" };
  }
}
