import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { AdminService } from "./admin.service";

class TenantRequestDto {
  @ApiProperty({ example: "Empresa ABC" })
  name!: string;

  @ApiProperty({ example: "empresa-abc" })
  slug!: string;

  @ApiProperty({ required: false, nullable: true, example: "shared" })
  db_strategy?: string | null;

  @ApiProperty({ required: false, nullable: true, example: "postgresql://..." })
  control_plane_db?: string | null;

  @ApiProperty({ required: false, nullable: true, example: "postgresql://..." })
  erp_db?: string | null;

  @ApiProperty({ required: false, nullable: true, example: "postgresql://..." })
  telemetry_db?: string | null;

  @ApiProperty({ required: false, nullable: true, example: "pending" })
  migration_status?: string | null;

  @ApiProperty({ required: false, description: "UUID do tenant (opcional; usado para alinhar com TENANT_MASTER_ADMIN_TENANT_ID)" })
  id?: string | null;

  @ApiProperty({ required: false, description: "Nome da primeira organização (cria org + partner + primeiro usuário)" })
  first_organization_name?: string | null;

  @ApiProperty({ required: false, description: "Email do primeiro usuário (requer first_organization_name)" })
  first_user_email?: string | null;

  @ApiProperty({ required: false, description: "Senha do primeiro usuário" })
  first_user_password?: string | null;

  @ApiProperty({ required: false, description: "Nome do primeiro usuário" })
  first_user_name?: string | null;
}

class TenantStatusDto {
  @ApiProperty({ example: "completed", description: "Ex: pending, in_progress, completed" })
  migration_status!: string;
}

class PlanRequestDto {
  @ApiProperty({ example: "starter" })
  code!: string;

  @ApiProperty({ example: "Plano Starter" })
  name!: string;

  @ApiProperty({ required: false, nullable: true, example: "Para pequenos projetos" })
  description?: string | null;
}

class PlanStatusDto {
  @ApiProperty({ example: "active", description: "Ex: active, inactive" })
  status!: string;
}

class PlatformProductRequestDto {
  @ApiProperty({ example: "erp" })
  code!: string;
  @ApiProperty({ example: "ERP" })
  name!: string;
  @ApiProperty({ required: false, nullable: true })
  description?: string | null;
}

class PlatformProductModuleRequestDto {
  @ApiProperty()
  product_id!: string;
  @ApiProperty({ example: "erp.product" })
  code!: string;
  @ApiProperty({ example: "Produtos" })
  name!: string;
}

class TenantPlatformProductRequestDto {
  @ApiProperty()
  product_id!: string;
  @ApiProperty()
  plan_id!: string;
  @ApiProperty({ required: false, nullable: true })
  is_active?: boolean | null;
}

class PermissionRequestDto {
  @ApiProperty({ example: "admin.tenant" })
  resource!: string;
  @ApiProperty({ example: "read" })
  action!: string;
  @ApiProperty({ required: false, nullable: true })
  description?: string | null;
}

@ApiTags("Admin")
@ApiBearerAuth("userAuth")
@Controller("/api/v1/admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post("/tenants")
  @ApiOperation({ summary: "Cria tenant" })
  @ApiBody({
    type: TenantRequestDto,
    examples: {
      minimal: {
        summary: "Minimo",
        value: { name: "Empresa ABC", slug: "empresa-abc" }
      },
      full: {
        summary: "Completo",
        value: {
          name: "Empresa ABC",
          slug: "empresa-abc",
          db_strategy: "shared",
          migration_status: "pending"
        }
      }
    }
  })
  @ApiOkResponse({ type: Object })
  async createTenant(@Body() body: TenantRequestDto, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.createTenant(body);
  }

  @Get("/tenants")
  @ApiOperation({ summary: "Lista tenants" })
  async listTenants(@Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.listTenants();
  }

  @Get("/tenants/:id")
  @ApiOperation({ summary: "Busca tenant por id" })
  async getTenant(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.getTenant(id);
  }

  @Put("/tenants/:id")
  @ApiOperation({ summary: "Atualiza tenant" })
  @ApiBody({
    type: TenantRequestDto,
    examples: {
      default: {
        summary: "Exemplo",
        value: { name: "Empresa ABC Atualizada", slug: "empresa-abc", migration_status: "completed" }
      }
    }
  })
  async updateTenant(
    @Param("id") id: string,
    @Body() body: TenantRequestDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.updateTenant(id, body);
  }

  @Patch("/tenants/:id/status")
  @ApiOperation({ summary: "Atualiza status de migracao do tenant" })
  @ApiBody({
    type: TenantStatusDto,
    examples: { default: { summary: "Exemplo", value: { migration_status: "completed" } } }
  })
  async updateTenantStatus(
    @Param("id") id: string,
    @Body() body: TenantStatusDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.updateTenantStatus(id, body.migration_status);
  }

  @Post("/plans")
  @ApiOperation({ summary: "Cria plano" })
  @ApiBody({
    type: PlanRequestDto,
    examples: {
      default: {
        summary: "Exemplo",
        value: { code: "starter", name: "Plano Starter", description: "Para pequenos projetos" }
      }
    }
  })
  async createPlan(@Body() body: PlanRequestDto, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.createPlan(body);
  }

  @Get("/plans")
  @ApiOperation({ summary: "Lista planos" })
  async listPlans(@Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.listPlans();
  }

  @Put("/plans/:code")
  @ApiOperation({ summary: "Atualiza plano" })
  @ApiBody({
    type: PlanRequestDto,
    examples: {
      default: {
        summary: "Exemplo",
        value: { code: "starter", name: "Plano Starter Atualizado", description: "Descricao atualizada" }
      }
    }
  })
  async updatePlan(
    @Param("code") code: string,
    @Body() body: PlanRequestDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.updatePlan(code, body);
  }

  @Patch("/plans/:code/status")
  @ApiOperation({ summary: "Atualiza status do plano" })
  @ApiBody({
    type: PlanStatusDto,
    examples: { default: { summary: "Exemplo", value: { status: "active" } } }
  })
  async updatePlanStatus(
    @Param("code") code: string,
    @Body() body: PlanStatusDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.updatePlanStatus(code, body.status);
  }

  @Post("/platform-products")
  @ApiOperation({ summary: "Cria produto da plataforma" })
  @ApiBody({ type: PlatformProductRequestDto })
  async createPlatformProduct(@Body() body: PlatformProductRequestDto, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.createPlatformProduct(body);
  }

  @Get("/platform-products")
  @ApiOperation({ summary: "Lista produtos da plataforma" })
  async listPlatformProducts(@Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.listPlatformProducts();
  }

  @Get("/platform-products/:id")
  @ApiOperation({ summary: "Busca produto da plataforma por id" })
  async getPlatformProduct(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.getPlatformProduct(id);
  }

  @Put("/platform-products/:id")
  @ApiOperation({ summary: "Atualiza produto da plataforma" })
  @ApiBody({ type: PlatformProductRequestDto })
  async updatePlatformProduct(
    @Param("id") id: string,
    @Body() body: PlatformProductRequestDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.updatePlatformProduct(id, body);
  }

  @Delete("/platform-products/:id")
  @ApiOperation({ summary: "Remove produto da plataforma" })
  async deletePlatformProduct(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.deletePlatformProduct(id);
  }

  @Post("/platform-product-modules")
  @ApiOperation({ summary: "Cria modulo/aplicativo da plataforma" })
  @ApiBody({ type: PlatformProductModuleRequestDto })
  async createPlatformProductModule(
    @Body() body: PlatformProductModuleRequestDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.createPlatformProductModule(body);
  }

  @Get("/platform-product-modules")
  @ApiOperation({ summary: "Lista modulos/aplicativos" })
  async listPlatformProductModules(
    @Query("product_id") productId: string | undefined,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.listPlatformProductModules(productId);
  }

  @Get("/platform-product-modules/:id")
  @ApiOperation({ summary: "Busca modulo por id" })
  async getPlatformProductModule(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.getPlatformProductModule(id);
  }

  @Put("/platform-product-modules/:id")
  @ApiOperation({ summary: "Atualiza modulo/aplicativo" })
  @ApiBody({ type: PlatformProductModuleRequestDto })
  async updatePlatformProductModule(
    @Param("id") id: string,
    @Body() body: PlatformProductModuleRequestDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.updatePlatformProductModule(id, body);
  }

  @Delete("/platform-product-modules/:id")
  @ApiOperation({ summary: "Remove modulo/aplicativo" })
  async deletePlatformProductModule(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.deletePlatformProductModule(id);
  }

  @Post("/tenants/:id/products")
  @ApiOperation({ summary: "Associa produto ao tenant" })
  @ApiBody({ type: TenantPlatformProductRequestDto })
  async createTenantPlatformProduct(
    @Param("id") id: string,
    @Body() body: TenantPlatformProductRequestDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.createTenantPlatformProduct(id, body);
  }

  @Get("/tenants/:id/products")
  @ApiOperation({ summary: "Lista produtos do tenant" })
  async listTenantPlatformProducts(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.listTenantPlatformProducts(id);
  }

  @Get("/tenants/:tenantId/products/:id")
  @ApiOperation({ summary: "Busca produto do tenant" })
  async getTenantPlatformProduct(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.getTenantPlatformProduct(tenantId, id);
  }

  @Put("/tenants/:tenantId/products/:id")
  @ApiOperation({ summary: "Atualiza produto do tenant" })
  @ApiBody({ type: TenantPlatformProductRequestDto })
  async updateTenantPlatformProduct(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: TenantPlatformProductRequestDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.updateTenantPlatformProduct(tenantId, id, body);
  }

  @Delete("/tenants/:tenantId/products/:id")
  @ApiOperation({ summary: "Remove produto do tenant" })
  async deleteTenantPlatformProduct(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.deleteTenantPlatformProduct(tenantId, id);
  }

  @Get("/tenants/:id/usage-metrics")
  @ApiOperation({ summary: "Lista metricas de uso do tenant" })
  async listTenantUsageMetrics(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.listTenantUsageMetrics(id);
  }

  @Post("/permissions")
  @ApiOperation({ summary: "Cria permissao" })
  @ApiBody({ type: PermissionRequestDto })
  async createPermission(@Body() body: PermissionRequestDto, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.createPermission(body);
  }

  @Get("/permissions")
  @ApiOperation({ summary: "Lista permissoes" })
  async listPermissions(@Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.listPermissions();
  }

  @Get("/permissions/:id")
  @ApiOperation({ summary: "Busca permissao por id" })
  async getPermission(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.getPermission(id);
  }

  @Put("/permissions/:id")
  @ApiOperation({ summary: "Atualiza permissao" })
  @ApiBody({ type: PermissionRequestDto })
  async updatePermission(
    @Param("id") id: string,
    @Body() body: PermissionRequestDto,
    @Req() request: FastifyRequest
  ) {
    this.assertAccess(request);
    return this.adminService.updatePermission(id, body);
  }

  @Delete("/permissions/:id")
  @ApiOperation({ summary: "Remove permissao" })
  async deletePermission(@Param("id") id: string, @Req() request: FastifyRequest) {
    this.assertAccess(request);
    return this.adminService.deletePermission(id);
  }

  private assertAccess(request: FastifyRequest) {
    const user = request.user;
    if (!user || user.auth_type !== "user" || user.type !== "access") {
      throw new UnauthorizedException("Access token necessario.");
    }
  }
}
