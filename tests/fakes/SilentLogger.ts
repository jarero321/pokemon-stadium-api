import type { ILogger } from '@core/interfaces/index';

export class SilentLogger implements ILogger {
  info(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
  child(): ILogger {
    return this;
  }
}
