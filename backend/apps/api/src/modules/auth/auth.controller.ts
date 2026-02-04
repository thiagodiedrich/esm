import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import {
  ApiBody,
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

interface LoginRequest {
  email: string;
  password: string;
}

@ApiTags("Auth")
@Controller("/api/auth")
export class AuthController {
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

    const tokens = await this.authService.issueTokens({
      userId: user.id,
      tenantId: tenant.id,
      organizationId: context.organizationId,
      workspaceId: context.workspaceId
    });

    return tokens;
  }
}
