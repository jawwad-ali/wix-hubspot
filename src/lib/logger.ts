type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    "accessToken",
    "refreshToken",
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "password",
    "authorization",
    "cookie",
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitize(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? sanitize(meta) : {}),
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") console.debug(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
};
