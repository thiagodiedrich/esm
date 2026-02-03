"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const kafkajs_1 = require("kafkajs");
const request_context_service_1 = require("../observability/request-context.service");
let KafkaService = class KafkaService {
    constructor(configService, requestContext) {
        this.configService = configService;
        this.requestContext = requestContext;
        this.producer = null;
        this.enabled = this.configService.get("KAFKA_ENABLED") === "true";
        this.clientId = this.configService.get("KAFKA_CLIENT_ID") || "esm-api";
        const brokersRaw = this.configService.get("KAFKA_BROKERS") || "";
        this.brokers = brokersRaw.split(",").map((b) => b.trim()).filter(Boolean);
    }
    async getProducer() {
        if (!this.enabled) {
            throw new Error("Kafka desabilitado.");
        }
        if (this.producer) {
            return this.producer;
        }
        const kafka = new kafkajs_1.Kafka({
            clientId: this.clientId,
            brokers: this.brokers,
            logLevel: kafkajs_1.logLevel.NOTHING
        });
        const producer = kafka.producer();
        await producer.connect();
        this.producer = producer;
        return producer;
    }
    async publish(topic, message) {
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
};
exports.KafkaService = KafkaService;
exports.KafkaService = KafkaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        request_context_service_1.RequestContextService])
], KafkaService);
