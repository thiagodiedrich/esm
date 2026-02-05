import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { TenantService } from "./tenant.service";

class OrganizationRequestDto {
  @ApiProperty({ example: "Organizacao Principal" })
  name!: string;

  @ApiProperty({ required: false, nullable: true, example: true })
  is_default?: boolean | null;

  @ApiProperty({ required: false, description: "Email do primeiro usuario da organizacao (is_super_admin = true)" })
  first_user_email?: string | null;

  @ApiProperty({ required: false, description: "Senha do primeiro usuario" })
  first_user_password?: string | null;

  @ApiProperty({ required: false, description: "Nome do primeiro usuario" })
  first_user_name?: string | null;
}

class WorkspaceRequestDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  organization_id!: string;

  @ApiProperty({ example: "Workspace Vendas" })
  name!: string;
}

class UserRequestDto {
  @ApiProperty({ example: "usuario@empresa.com" })
  email!: string;

  @ApiProperty({ required: false, example: "senhaSegura123" })
  password?: string;

  @ApiProperty({ required: false, nullable: true, example: "550e8400-e29b-41d4-a716-446655440002" })
  partner_id?: string | null;

  @ApiProperty({ required: false, nullable: true, description: "Obrigatorio se partner_id nao for informado (cria partner e associa ao usuario)" })
  organization_id?: string | null;

  @ApiProperty({ required: false, nullable: true, description: "Nome do contato (partner) quando organization_id e informado sem partner_id" })
  name?: string | null;

  @ApiProperty({ required: false, nullable: true, example: true })
  is_active?: boolean | null;
}

class UserPasswordDto {
  @ApiProperty({ example: "novaSenhaSegura123" })
  password!: string;
}

class UserStatusDto {
  @ApiProperty({ example: false, description: "Ativa ou desativa o usuario" })
  is_active!: boolean;
}

class PartnerRequestDto {
  @ApiProperty({ required: false, nullable: true })
  organization_id?: string | null;
  @ApiProperty({ example: "João Silva" })
  name!: string;
  @ApiProperty({ required: false, nullable: true })
  email?: string | null;
  @ApiProperty({ required: false, nullable: true })
  telephone?: string | null;
  @ApiProperty({ required: false, nullable: true })
  type?: string | null;
  @ApiProperty({ required: false, nullable: true })
  document?: string | null;
  @ApiProperty({ required: false, nullable: true })
  location_address?: string | null;
  @ApiProperty({ required: false, nullable: true })
  location_address_number?: string | null;
  @ApiProperty({ required: false, nullable: true })
  location_address_zip?: string | null;
}

class RoleRequestDto {
  @ApiProperty({ example: "Vendedor" })
  name!: string;
  @ApiProperty({ required: false, nullable: true })
  description?: string | null;
}

class UserRoleRequestDto {
  @ApiProperty()
  role_id!: string;
  @ApiProperty({ required: false, nullable: true })
  scope_type?: string | null;
  @ApiProperty({ required: false, nullable: true })
  scope_id?: string | null;
}

class UserPermissionOverrideRequestDto {
  @ApiProperty()
  permission_id!: string;
  @ApiProperty({ example: "allow", description: "allow ou deny" })
  effect!: string;
}

class OrganizationSettingsRequestDto {
  @ApiProperty({ required: false, nullable: true })
  workspace_mode?: string | null;
  @ApiProperty({ required: false, nullable: true })
  remember_last_context?: boolean | null;
  @ApiProperty({ required: false, nullable: true })
  menu_cache_ttl?: number | null;
  @ApiProperty({ required: false, nullable: true })
  enable_mfa?: boolean | null;
  @ApiProperty({ required: false, nullable: true })
  enable_oauth?: boolean | null;
}

@ApiTags("Tenant")
@ApiBearerAuth("userAuth")
@Controller("/api/v1/tenant")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post("/organizations")
  @ApiOperation({ summary: "Cria organizacao" })
  @ApiBody({
    type: OrganizationRequestDto,
    examples: {
      default: { summary: "Exemplo", value: { name: "Organizacao Principal", is_default: true } }
    }
  })
  async createOrganization(@Body() body: OrganizationRequestDto, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.createOrganization(tenantId, body);
  }

  @Get("/organizations")
  @ApiOperation({ summary: "Lista organizacoes" })
  async listOrganizations(@Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.listOrganizations(tenantId);
  }

  @Put("/organizations/:id")
  @ApiOperation({ summary: "Atualiza organizacao" })
  @ApiBody({
    type: OrganizationRequestDto,
    examples: { default: { summary: "Exemplo", value: { name: "Organizacao Atualizada", is_default: false } } }
  })
  async updateOrganization(
    @Param("id") id: string,
    @Body() body: OrganizationRequestDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.updateOrganization(tenantId, id, body);
  }

  @Delete("/organizations/:id")
  @ApiOperation({ summary: "Remove organizacao" })
  async deleteOrganization(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.deleteOrganization(tenantId, id);
  }

  @Post("/workspaces")
  @ApiOperation({ summary: "Cria workspace" })
  @ApiBody({
    type: WorkspaceRequestDto,
    examples: {
      default: {
        summary: "Exemplo",
        value: { organization_id: "550e8400-e29b-41d4-a716-446655440000", name: "Workspace Vendas" }
      }
    }
  })
  async createWorkspace(@Body() body: WorkspaceRequestDto, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.createWorkspace(tenantId, body);
  }

  @Get("/workspaces")
  @ApiOperation({ summary: "Lista workspaces" })
  async listWorkspaces(@Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.listWorkspaces(tenantId);
  }

  @Put("/workspaces/:id")
  @ApiOperation({ summary: "Atualiza workspace" })
  @ApiBody({
    type: WorkspaceRequestDto,
    examples: {
      default: {
        summary: "Exemplo",
        value: { organization_id: "550e8400-e29b-41d4-a716-446655440000", name: "Workspace Vendas Atualizado" }
      }
    }
  })
  async updateWorkspace(
    @Param("id") id: string,
    @Body() body: WorkspaceRequestDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.updateWorkspace(tenantId, id, body);
  }

  @Delete("/workspaces/:id")
  @ApiOperation({ summary: "Remove workspace" })
  async deleteWorkspace(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.deleteWorkspace(tenantId, id);
  }

  @Post("/users")
  @ApiOperation({ summary: "Cria usuario" })
  @ApiBody({
    type: UserRequestDto,
    examples: {
      default: {
        summary: "Exemplo",
        value: {
          email: "usuario@empresa.com",
          password: "senhaSegura123",
          is_active: true
        }
      }
    }
  })
  async createUser(@Body() body: UserRequestDto, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.createUser(tenantId, body);
  }

  @Get("/users")
  @ApiOperation({ summary: "Lista usuarios" })
  async listUsers(@Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.listUsers(tenantId);
  }

  @Put("/users/:id")
  @ApiOperation({ summary: "Atualiza usuario" })
  @ApiBody({ type: UserRequestDto })
  async updateUser(
    @Param("id") id: string,
    @Body() body: UserRequestDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.updateUser(tenantId, id, body);
  }

  @Delete("/users/:id")
  @ApiOperation({ summary: "Remove usuario" })
  async deleteUser(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.deleteUser(tenantId, id);
  }

  @Patch("/users/:id/password")
  @ApiOperation({ summary: "Atualiza senha do usuario" })
  @ApiBody({
    type: UserPasswordDto,
    examples: { default: { summary: "Exemplo", value: { password: "novaSenhaSegura123" } } }
  })
  async updateUserPassword(
    @Param("id") id: string,
    @Body() body: UserPasswordDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.updateUserPassword(tenantId, id, body.password);
  }

  @Patch("/users/:id/status")
  @ApiOperation({ summary: "Atualiza status do usuario" })
  @ApiBody({
    type: UserStatusDto,
    examples: { default: { summary: "Exemplo", value: { is_active: false } } }
  })
  async updateUserStatus(
    @Param("id") id: string,
    @Body() body: UserStatusDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.updateUserStatus(tenantId, id, body.is_active);
  }

  @Post("/partners")
  @ApiOperation({ summary: "Cria contato" })
  @ApiBody({ type: PartnerRequestDto })
  async createPartner(@Body() body: PartnerRequestDto, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.createPartner(tenantId, body);
  }

  @Get("/partners")
  @ApiOperation({ summary: "Lista contatos" })
  async listPartners(
    @Query("organization_id") organizationId: string | undefined,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.listPartners(tenantId, organizationId);
  }

  @Get("/partners/:id")
  @ApiOperation({ summary: "Busca contato por id" })
  async getPartner(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.getPartner(tenantId, id);
  }

  @Put("/partners/:id")
  @ApiOperation({ summary: "Atualiza contato" })
  @ApiBody({ type: PartnerRequestDto })
  async updatePartner(
    @Param("id") id: string,
    @Body() body: PartnerRequestDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.updatePartner(tenantId, id, body);
  }

  @Delete("/partners/:id")
  @ApiOperation({ summary: "Remove contato" })
  async deletePartner(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.deletePartner(tenantId, id);
  }

  @Post("/roles")
  @ApiOperation({ summary: "Cria regra de acesso" })
  @ApiBody({ type: RoleRequestDto })
  async createRole(@Body() body: RoleRequestDto, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.createRole(tenantId, body);
  }

  @Get("/roles")
  @ApiOperation({ summary: "Lista regras de acesso" })
  async listRoles(@Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.listRoles(tenantId);
  }

  @Get("/roles/:id")
  @ApiOperation({ summary: "Busca regra por id" })
  async getRole(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.getRole(tenantId, id);
  }

  @Put("/roles/:id")
  @ApiOperation({ summary: "Atualiza regra" })
  @ApiBody({ type: RoleRequestDto })
  async updateRole(
    @Param("id") id: string,
    @Body() body: RoleRequestDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.updateRole(tenantId, id, body);
  }

  @Delete("/roles/:id")
  @ApiOperation({ summary: "Remove regra" })
  async deleteRole(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.deleteRole(tenantId, id);
  }

  @Get("/users/:id/roles")
  @ApiOperation({ summary: "Lista regras do usuario" })
  async listUserRoles(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.listUserRoles(tenantId, id);
  }

  @Post("/users/:id/roles")
  @ApiOperation({ summary: "Associa regra ao usuario" })
  @ApiBody({ type: UserRoleRequestDto })
  async addUserRole(
    @Param("id") id: string,
    @Body() body: UserRoleRequestDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.addUserRole(tenantId, id, body);
  }

  @Delete("/users/:userId/roles/:roleId")
  @ApiOperation({ summary: "Remove regra do usuario" })
  async removeUserRole(
    @Param("userId") userId: string,
    @Param("roleId") roleId: string,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.removeUserRole(tenantId, userId, roleId);
  }

  @Get("/users/:id/permission-overrides")
  @ApiOperation({ summary: "Lista overrides de permissao do usuario" })
  async listUserPermissionOverrides(@Param("id") id: string, @Req() request: FastifyRequest) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.listUserPermissionOverrides(tenantId, id);
  }

  @Post("/users/:id/permission-overrides")
  @ApiOperation({ summary: "Adiciona override de permissao ao usuario" })
  @ApiBody({ type: UserPermissionOverrideRequestDto })
  async addUserPermissionOverride(
    @Param("id") id: string,
    @Body() body: UserPermissionOverrideRequestDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.addUserPermissionOverride(tenantId, id, body);
  }

  @Delete("/users/:userId/permission-overrides/:permissionId")
  @ApiOperation({ summary: "Remove override de permissao do usuario" })
  async removeUserPermissionOverride(
    @Param("userId") userId: string,
    @Param("permissionId") permissionId: string,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.removeUserPermissionOverride(tenantId, userId, permissionId);
  }

  @Get("/organizations/:id/settings")
  @ApiOperation({ summary: "Busca configuracoes da empresa" })
  async getOrganizationSettings(
    @Param("id") id: string,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.getOrganizationSettings(tenantId, id);
  }

  @Put("/organizations/:id/settings")
  @ApiOperation({ summary: "Cria ou atualiza configuracoes da empresa" })
  @ApiBody({ type: OrganizationSettingsRequestDto })
  async setOrganizationSettings(
    @Param("id") id: string,
    @Body() body: OrganizationSettingsRequestDto,
    @Req() request: FastifyRequest
  ) {
    const tenantId = this.getTenantId(request);
    return this.tenantService.setOrganizationSettings(tenantId, id, body);
  }

  private getTenantId(request: FastifyRequest) {
    const user = request.user;
    if (!user || user.auth_type !== "user" || user.type !== "access" || !user.tenant_id) {
      throw new UnauthorizedException("Access token necessario.");
    }
    return user.tenant_id;
  }
}
