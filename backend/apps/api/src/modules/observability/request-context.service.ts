import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";

interface RequestContextStore {
  correlationId: string;
  tenantId?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run(context: RequestContextStore, callback: () => void) {
    this.storage.run(context, callback);
  }

  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }
}
