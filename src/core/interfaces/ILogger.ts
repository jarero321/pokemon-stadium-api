export interface ILogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): ILogger;
}
