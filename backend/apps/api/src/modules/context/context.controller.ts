import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags
} from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { AuthService } from "../auth/auth.service";
import { AuthContextService } from "./context.service";

class ContextSwitchRequestDto {
  @ApiProperty()
  organization_id!: string;

  @ApiProperty({ required: false, nullable: true })
  workspace_id?: string | null;
}

class TokenResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  refresh_token!: string;

  @ApiProperty({ example: 900 })
  expires_in!: number;
}

interface ContextSwitchRequest {
  organization_id: string;
  workspace_id?: string | null;
}

@ApiTags("Context")
@Controller("/api/context")
export class ContextController {
  constructor(
    private readonly authService: AuthService,
    private readonly contextService: AuthContextService
  ) {}

  @Post("/switch")
  @ApiOperation({ summary: "Troca de contexto (org/workspace)" })
  @ApiBearerAuth("userAuth")
  @ApiBody({ type: ContextSwitchRequestDto })
  @ApiOkResponse({ type: TokenResponseDto })
  async switchContext(
    @Body() body: ContextSwitchRequest,
    @Req() request: FastifyRequest
  ) {
    const user = request.user;

    if (!user || user.auth_type !== "user" || user.type !== "access") {
      throw new UnauthorizedException("Access token necessario.");
    }

    const context = await this.contextService.switchContext({
      tenantId: user.tenant_id ?? "",
      userId: user.sub,
      organizationId: body.organization_id,
      workspaceId: body.workspace_id ?? null
    });

    return this.authService.issueTokens({
      userId: user.sub,
      tenantId: user.tenant_id ?? "",
      organizationId: context.organizationId,
      workspaceId: context.workspaceId
    });
  }
}
