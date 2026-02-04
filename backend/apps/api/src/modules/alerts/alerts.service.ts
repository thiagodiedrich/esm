import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AlertsService {
  constructor(private readonly configService: ConfigService) {}

  isAlertsEnabled(): boolean {
    return (this.configService.get<string>("ALERTS_ENABLED") ?? "false").toLowerCase() === "true";
  }

  getPollSeconds(): number {
    return Number(this.configService.get<string>("ALERT_POLL_SECONDS") ?? 60);
  }
}
