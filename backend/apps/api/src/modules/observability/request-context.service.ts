import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";

interface RequestContextStore {
  correlationId: string;
  tenantId?: string;
  organizationId?: string;
  workspaceId?: string | null;
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

  getOrganizationId(): string | undefined {
    return this.storage.getStore()?.organizationId;
  }

  getWorkspaceId(): string | null | undefined {
    return this.storage.getStore()?.workspaceId;
  }

  updateUserContext(params: {
    tenantId?: string;
    organizationId?: string;
    workspaceId?: string | null;
  }) {
    const store = this.storage.getStore();
    if (!store) {
      return;
    }

    store.tenantId = params.tenantId ?? store.tenantId;
    store.organizationId = params.organizationId ?? store.organizationId;
    store.workspaceId = params.workspaceId ?? store.workspaceId;
  }
}
