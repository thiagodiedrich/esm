import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags
} from "@nestjs/swagger";
import { MenuService } from "./menu.service";
import { FastifyRequest } from "fastify";
import { AuthUser } from "../auth/auth.types";

class MenuResponseDto {
  @ApiProperty({ type: "array", items: { type: "object" } })
  items!: Record<string, unknown>[];
}

@ApiTags("Menu")
@Controller("/api/menu")
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: "Retorna o menu do usuario logado" })
  @ApiBearerAuth("userAuth")
  @ApiOkResponse({ type: MenuResponseDto })
  async getMenu(@Req() request: FastifyRequest) {
    const user = request.user as AuthUser | undefined;
    if (!user || user.auth_type !== "user" || user.type !== "access") {
      throw new UnauthorizedException("Access token necessario.");
    }

    return { items: await this.menuService.getMenu(user) };
  }
}
