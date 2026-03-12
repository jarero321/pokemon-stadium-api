import pino from 'pino';
import type { ILogger } from '@core/interfaces/index';

export class PinoLogger implements ILogger {
  private readonly logger: pino.Logger;

  constructor(context?: Record<string, unknown>) {
    this.logger = pino({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      ...context,
    });
  }

  private fromPino(pinoInstance: pino.Logger): PinoLogger {
    const instance = Object.create(PinoLogger.prototype) as PinoLogger;
    Object.defineProperty(instance, 'logger', { value: pinoInstance });
    return instance;
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(data ?? {}, message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(data ?? {}, message);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.logger.error({ err: error, ...data }, message);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(data ?? {}, message);
  }

  child(context: Record<string, unknown>): ILogger {
    return this.fromPino(this.logger.child(context));
  }
}
