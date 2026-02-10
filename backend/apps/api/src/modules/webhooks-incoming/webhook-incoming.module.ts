import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { WebhookIncomingController } from "./webhook-incoming.controller";
import { WebhookIncomingService } from "./webhook-incoming.service";

@Module({
  imports: [DatabaseModule],
  controllers: [WebhookIncomingController],
  providers: [WebhookIncomingService],
  exports: [WebhookIncomingService]
})
export class WebhookIncomingModule {}
