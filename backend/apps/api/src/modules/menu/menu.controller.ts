import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common";
import { MenuService } from "./menu.service";
import { FastifyRequest } from "fastify";
import { AuthUser } from "../auth/auth.types";

@Controller("/api/menu")
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  async getMenu(@Req() request: FastifyRequest) {
    const user = request.user as AuthUser | undefined;
    if (!user || user.type !== "access") {
      throw new UnauthorizedException("Access token necessario.");
    }

    return { items: await this.menuService.getMenu(user) };
  }
}
