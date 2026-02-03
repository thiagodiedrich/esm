import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kafka, Producer, logLevel } from "kafkajs";
import { RequestContextService } from "../observability/request-context.service";

@Injectable()
export class KafkaService {
  private producer: Producer | null = null;
  private enabled: boolean;
  private brokers: string[];
  private clientId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly requestContext: RequestContextService
  ) {
    this.enabled = this.configService.get<string>("KAFKA_ENABLED") === "true";
    this.clientId = this.configService.get<string>("KAFKA_CLIENT_ID") || "esm-api";
    const brokersRaw = this.configService.get<string>("KAFKA_BROKERS") || "";
    this.brokers = brokersRaw.split(",").map((b) => b.trim()).filter(Boolean);
  }

  private async getProducer(): Promise<Producer> {
    if (!this.enabled) {
      throw new Error("Kafka desabilitado.");
    }

    if (this.producer) {
      return this.producer;
    }

    const kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
      logLevel: logLevel.NOTHING
    });

    const producer = kafka.producer();
    await producer.connect();
    this.producer = producer;
    return producer;
  }

  async publish(topic: string, message: unknown) {
    if (!this.enabled) {
      return;
    }

    const correlationId = this.requestContext.getCorrelationId();
    const producer = await this.getProducer();
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
          headers: correlationId ? { "x-correlation-id": correlationId } : undefined
        }
      ]
    });
  }
}
