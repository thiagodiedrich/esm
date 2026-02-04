import { Controller, Get } from "@nestjs/common";
import { BrandingService } from "./branding.service";

@Controller("/api/branding")
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get("/defaults")
  getDefaults() {
    return this.brandingService.getWhiteLabelDefaults();
  }
}
