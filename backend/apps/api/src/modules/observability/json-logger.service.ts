import { LoggerService } from "@nestjs/common";
import { RequestContextService } from "./request-context.service";

type LogLevel = "log" | "error" | "warn" | "debug" | "verbose";

interface LoggerOptions {
  level: LogLevel;
  format: "json" | "text";
}

export class JsonLoggerService implements LoggerService {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly serviceName: string,
    private readonly options: LoggerOptions
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
    if (!shouldLog(level, this.options.level)) {
      return;
    }

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

    if (this.options.format === "text") {
      process.stdout.write(
        `[${logEntry.timestamp}] ${logEntry.level.toUpperCase()} ${logEntry.service} ${
          logEntry.context
        }: ${logEntry.message}\n`
      );
      return;
    }

    process.stdout.write(`${JSON.stringify(logEntry)}\n`);
  }
}

function shouldLog(level: LogLevel, minLevel: LogLevel) {
  const order: LogLevel[] = ["error", "warn", "log", "debug", "verbose"];
  return order.indexOf(level) <= order.indexOf(minLevel);
}
