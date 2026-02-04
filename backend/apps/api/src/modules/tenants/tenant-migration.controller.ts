import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags
} from "@nestjs/swagger";
import { TenantMigrationService, TenantPointerUpdate } from "./tenant-migration.service";
import { FastifyRequest } from "fastify";

class TenantPointerUpdateDto implements TenantPointerUpdate {
  @ApiProperty()
  tenant_id!: string;

  @ApiProperty({ enum: ["shared", "dedicated", "hybrid"] })
  db_strategy!: string;

  @ApiProperty({ required: false, nullable: true })
  control_plane_db?: string | null;

  @ApiProperty({ required: false, nullable: true })
  erp_db?: string | null;

  @ApiProperty({ required: false, nullable: true })
  telemetry_db?: string | null;

  @ApiProperty({ enum: ["idle", "migrating", "failed"] })
  migration_status!: string;
}

class StatusResponseDto {
  @ApiProperty({ example: "ok" })
  status!: string;
}

@ApiTags("Internal")
@Controller("/internal/tenants/migration")
export class TenantMigrationController {
  constructor(private readonly tenantMigration: TenantMigrationService) {}

  @Post("/pointer")
  @ApiOperation({ summary: "Atualiza ponteiros de migracao (service token)" })
  @ApiBearerAuth("serviceAuth")
  @ApiBody({ type: TenantPointerUpdateDto })
  @ApiOkResponse({ type: StatusResponseDto })
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
