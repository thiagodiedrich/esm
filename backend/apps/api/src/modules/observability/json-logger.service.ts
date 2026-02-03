import { LoggerService } from "@nestjs/common";
import { RequestContextService } from "./request-context.service";

type LogLevel = "log" | "error" | "warn" | "debug" | "verbose";

export class JsonLoggerService implements LoggerService {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly serviceName: string
  ) {}

  log(message: unknown, context?: string) {
    this.write("log", message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string) {
    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write("verbose", message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      correlation_id: this.requestContext.getCorrelationId(),
      tenant_id: this.requestContext.getTenantId(),
      organization_id: this.requestContext.getOrganizationId(),
      workspace_id: this.requestContext.getWorkspaceId(),
      message: typeof message === "string" ? message : "log_event",
      context: context ?? "app",
      data: typeof message === "string" ? undefined : message,
      trace
    };

    process.stdout.write(`${JSON.stringify(logEntry)}\n`);
  }
}
