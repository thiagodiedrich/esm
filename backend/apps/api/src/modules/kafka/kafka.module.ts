import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { KafkaService } from "./kafka.service";
import { ObservabilityModule } from "../observability/observability.module";

@Module({
  imports: [ConfigModule, ObservabilityModule],
  providers: [KafkaService],
  exports: [KafkaService]
})
export class KafkaModule {}
