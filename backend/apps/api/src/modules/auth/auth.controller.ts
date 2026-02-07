import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus
} from "@nestjs/common";
import {
  ApiBody,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags
} from "@nestjs/swagger";
import { Public } from "./auth.decorators";
import { AuthService } from "./auth.service";
import { AuthTenantService } from "./auth.tenant.service";
import { AuthContextService } from "../context/context.service";
import { FastifyRequest } from "fastify";

class LoginRequestDto {
  @ApiProperty({ example: "admin@empresa.com" })
  email!: string;

  @ApiProperty({ example: "senhaSegura123" })
  password!: string;
}

class TokenResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  refresh_token!: string;

  @ApiProperty({ example: 900 })
  expires_in!: number;
}

class RefreshRequestDto {
  @ApiProperty()
  refresh_token!: string;
}

class LogoutRequestDto {
  @ApiProperty({ required: false, description: "Refresh token a revogar" })
  refresh_token?: string;
}

class MeWorkspaceDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  is_active!: boolean;
}

class MeOrganizationDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  is_default!: boolean;
  @ApiProperty({ type: [MeWorkspaceDto] })
  workspaces!: MeWorkspaceDto[];
}

class MeCurrentContextDto {
  @ApiProperty()
  organization_id!: string;
  @ApiProperty()
  organization_name!: string;
  @ApiProperty({ nullable: true })
  workspace_id!: string | null;
  @ApiProperty({ nullable: true })
  workspace_name!: string | null;
  @ApiProperty({ enum: ["required", "optional"] })
  workspace_mode!: "required" | "optional";
}

class MeResponseDto {
  @ApiProperty({ description: "ID do usuário (res_users.id)" })
  user_id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  tenant_id!: string;

  @ApiProperty()
  tenant_slug!: string;

  @ApiProperty({ required: false, nullable: true })
  partner_id?: string | null;

  @ApiProperty({ required: false, nullable: true })
  is_active?: boolean | null;

  @ApiProperty({ type: [MeOrganizationDto] })
  organizations!: MeOrganizationDto[];

  @ApiProperty({ type: MeCurrentContextDto, nullable: true })
  current_context!: MeCurrentContextDto | null;

  @ApiProperty()
  requires_context_selection!: boolean;
}

interface LoginRequest {
  email: string;
  password: string;
}

@ApiTags("Autenticação")
@Controller("/api/v1/auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: AuthTenantService,
    private readonly contextService: AuthContextService
  ) {}

  @Public()
  @Post("/login")
  @ApiOperation({ summary: "Login de usuario" })
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ type: TokenResponseDto })
  async login(@Body() body: LoginRequest, @Req() request: FastifyRequest) {
    const tenant = await this.tenantService.resolveTenantOrFail(request);
    const user = await this.authService.validateUserCredentials(
      tenant.id,
      body.email,
      body.password
    );

    if (!user) {
      throw new UnauthorizedException("Credenciais invalidas.");
    }

    const context = await this.contextService.resolveLoginContext(tenant.id, user.id);

    if (!context) {
      throw new UnauthorizedException("Contexto invalido para login.");
    }

    const displayNames = await this.authService.getLoginDisplayNames(
      tenant.id,
      user.id,
      context.organizationId,
      context.workspaceId
    );
    const tokens = await this.authService.issueTokens({
      userId: user.id,
      tenantId: tenant.id,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      tenantSlug: displayNames.tenantSlug,
      name: displayNames.name,
      organizationName: displayNames.organizationName,
      workspaceName: displayNames.workspaceName
    });

    return tokens;
  }

  @Public()
  @Post("/refresh")
  @ApiOperation({ summary: "Refresh de token" })
  @ApiBody({ type: RefreshRequestDto })
  @ApiOkResponse({ type: TokenResponseDto })
  async refresh(@Body() body: RefreshRequestDto) {
    if (!body?.refresh_token) {
      throw new BadRequestException("Refresh token ausente.");
    }

    const payload = await this.authService.verifyUserToken(body.refresh_token);
    if (payload.type !== "refresh" || !payload.tenant_id || !payload.sub) {
      throw new UnauthorizedException("Refresh token invalido.");
    }

    const user = await this.authService.getUserById(payload.tenant_id, payload.sub);
    if (!user || !user.is_active) {
      throw new UnauthorizedException("Usuario inativo.");
    }

    const context = await this.contextService.resolveLoginContext(payload.tenant_id, payload.sub);
    if (!context?.organizationId) {
      throw new UnauthorizedException("Contexto invalido para login.");
    }

    const displayNames = await this.authService.getLoginDisplayNames(
      payload.tenant_id,
      payload.sub,
      context.organizationId,
      context.workspaceId ?? null
    );
    return this.authService.issueTokens({
      userId: payload.sub,
      tenantId: payload.tenant_id,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId ?? null,
      tenantSlug: displayNames.tenantSlug,
      name: displayNames.name,
      organizationName: displayNames.organizationName,
      workspaceName: displayNames.workspaceName
    });
  }

  @Public()
  @Post("/logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Logout — invalida token, revoga refresh e encerra sessão" })
  @ApiBearerAuth("userAuth")
  @ApiBody({ type: LogoutRequestDto, required: false })
  @ApiOkResponse({ description: "204 No Content" })
  async logout(
    @Req() request: FastifyRequest,
    @Body() body?: { refresh_token?: string }
  ): Promise<void> {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";
    try {
      if (token) {
        const payload = await this.authService.logout(token, body?.refresh_token);
        if (payload) {
          this.logger.log({
            message: "Logout",
            event: "auth.logout",
            user_id: payload.sub,
            tenant_id: payload.tenant_id
          });
        }
      }
    } catch {
      // Token inválido/expirado ou Redis indisponível: não relançar; frontend deve sempre receber 204.
    }
    // Sempre 204 para o cliente poder limpar estado e redirecionar para login.
  }

  @Get("/me")
  @ApiOperation({ summary: "Dados do usuario logado (sessão completa para o frontend)" })
  @ApiBearerAuth("userAuth")
  @ApiOkResponse({ type: MeResponseDto })
  async me(@Req() request: FastifyRequest) {
    const user = request.user;
    if (!user || user.auth_type !== "user" || user.type !== "access") {
      throw new UnauthorizedException("Access token necessario.");
    }

    const payload = await this.authService.getMePayload(
      user.tenant_id ?? "",
      user.sub,
      {
        organizationId: user.organization_id,
        workspaceId: user.workspace_id ?? null
      }
    );
    if (!payload) {
      throw new UnauthorizedException("Usuario nao encontrado.");
    }

    return payload;
  }
}
