import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface WhiteLabelDefaults {
  enabled: boolean;
  appName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  domain: string | null;
}

@Injectable()
export class BrandingService {
  constructor(private readonly configService: ConfigService) {}

  getWhiteLabelDefaults(): WhiteLabelDefaults {
    const enabled =
      (this.configService.get<string>("TENANT_WHITE_LABEL_ENABLED") ?? "false").toLowerCase() ===
      "true";

    return {
      enabled,
      appName: this.configService.get<string>("TENANT_WHITE_LABEL_DEFAULT_APP_NAME") ?? null,
      logoUrl: this.configService.get<string>("TENANT_WHITE_LABEL_DEFAULT_LOGO_URL") ?? null,
      primaryColor:
        this.configService.get<string>("TENANT_WHITE_LABEL_DEFAULT_PRIMARY_COLOR") ?? null,
      secondaryColor:
        this.configService.get<string>("TENANT_WHITE_LABEL_DEFAULT_SECONDARY_COLOR") ?? null,
      supportEmail:
        this.configService.get<string>("TENANT_WHITE_LABEL_DEFAULT_SUPPORT_EMAIL") ?? null,
      supportPhone:
        this.configService.get<string>("TENANT_WHITE_LABEL_DEFAULT_SUPPORT_PHONE") ?? null,
      domain: this.configService.get<string>("TENANT_WHITE_LABEL_DEFAULT_DOMAIN") ?? null
    };
  }
}
