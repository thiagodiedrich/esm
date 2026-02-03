import { Injectable, NestMiddleware } from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import { RequestContextService } from "./request-context.service";

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const headerValue = req.headers["x-correlation-id"];
    const correlationId =
      typeof headerValue === "string" && headerValue.trim()
        ? headerValue.trim()
        : randomUUID();

    req.correlationId = correlationId;
    res.header("x-correlation-id", correlationId);

    const tenantId = req.user?.tenant_id;
    this.requestContext.run({ correlationId, tenantId }, () => next());
  }
}
