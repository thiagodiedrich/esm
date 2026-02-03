import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { AuthService } from "../auth/auth.service";
import { AuthContextService } from "./context.service";

interface ContextSwitchRequest {
  organization_id: string;
  workspace_id?: string | null;
}

@Controller("/api/context")
export class ContextController {
  constructor(
    private readonly authService: AuthService,
    private readonly contextService: AuthContextService
  ) {}

  @Post("/switch")
  async switchContext(
    @Body() body: ContextSwitchRequest,
    @Req() request: FastifyRequest
  ) {
    const user = request.user;

    if (!user || user.type !== "access") {
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
