import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags
} from "@nestjs/swagger";
import { Public } from "../auth/auth.decorators";
import { WebhookIncomingGuard } from "./webhook-incoming.guard";
import { WebhookIncomingService } from "./webhook-incoming.service";

const WEBHOOK_SOURCE_HEADER = "x-webhook-source";
const WEBHOOK_IDEMPOTENCY_HEADER = "x-idempotency-key";

class WebhookReceivedDto {
  @ApiProperty({ example: true })
  received!: boolean;
  @ApiProperty({ example: 1 })
  id!: number;
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  uuid!: string;
  @ApiProperty({ required: false, example: false, description: "True se já existia registro com o mesmo idempotency_key" })
  duplicate?: boolean;
}

@ApiTags("Webhooks")
@Controller("/api/v1/webhooks/incoming")
@Public()
@UseGuards(WebhookIncomingGuard)
export class WebhookIncomingController {
  constructor(private readonly webhookIncomingService: WebhookIncomingService) {}

  @Post()
  @ApiBearerAuth("webhookAuth")
  @ApiOperation({
    summary: "Recebe webhook de serviço externo",
    description:
      "Rota pública; valida Authorization contra WEBHOOK_INCOMING_SECRET se configurado. " +
      "Persiste headers (sem auth/cookie), payload e metadados no banco. " +
      "Para testar: use 'Authorize' com webhookAuth = valor de WEBHOOK_INCOMING_SECRET (ou deixe vazio se o servidor não exige)."
  })
  @ApiHeader({
    name: "X-Webhook-Source",
    required: false,
    description: "Identificador da origem (gravado em source)"
  })
  @ApiHeader({
    name: "X-Idempotency-Key",
    required: false,
    description: "Chave para deduplicação (evita duplicar evento no banco)"
  })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: true,
      example: { event: "order.created", id: "evt_123", data: { orderId: "ord_456" } }
    }
  })
  @ApiOkResponse({ type: WebhookReceivedDto })
  async receive(
    @Body() body: Record<string, unknown>,
    @Req() req: FastifyRequest
  ): Promise<WebhookReceivedDto> {
    const headers = req.headers;
    const source =
      (headers[WEBHOOK_SOURCE_HEADER] as string)?.trim() ||
      (headers[WEBHOOK_SOURCE_HEADER.toLowerCase()] as string)?.trim() ||
      "external";
    const idempotencyKey =
      (headers[WEBHOOK_IDEMPOTENCY_HEADER] as string)?.trim() ||
      (headers[WEBHOOK_IDEMPOTENCY_HEADER.toLowerCase()] as string)?.trim() ||
      (body?.id as string) ||
      undefined;

    const result = await this.webhookIncomingService.save({
      source,
      idempotencyKey: idempotencyKey || null,
      headers,
      payload: body ?? {}
    });

    return {
      received: true,
      id: result.id,
      uuid: result.uuid,
      ...(result.isDuplicate && { duplicate: true })
    };
  }
}
