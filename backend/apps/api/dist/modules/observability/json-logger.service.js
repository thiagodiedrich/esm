"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonLoggerService = void 0;
class JsonLoggerService {
    constructor(requestContext, serviceName, options) {
        this.requestContext = requestContext;
        this.serviceName = serviceName;
        this.options = options;
    }
    log(message, context) {
        this.write("log", message, context);
    }
    error(message, trace, context) {
        this.write("error", message, context, trace);
    }
    warn(message, context) {
        this.write("warn", message, context);
    }
    debug(message, context) {
        this.write("debug", message, context);
    }
    verbose(message, context) {
        this.write("verbose", message, context);
    }
    write(level, message, context, trace) {
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
            process.stdout.write(`[${logEntry.timestamp}] ${logEntry.level.toUpperCase()} ${logEntry.service} ${logEntry.context}: ${logEntry.message}\n`);
            return;
        }
        process.stdout.write(`${JSON.stringify(logEntry)}\n`);
    }
}
exports.JsonLoggerService = JsonLoggerService;
function shouldLog(level, minLevel) {
    const order = ["error", "warn", "log", "debug", "verbose"];
    return order.indexOf(level) <= order.indexOf(minLevel);
}
