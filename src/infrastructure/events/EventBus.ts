import { EventEmitter } from 'node:events';
import type { IEventBus, EventHandler } from '#core/interfaces/IEventBus.js';
import type { DomainEvent } from '#core/events/DomainEvent.js';
import type { ILogger } from '#core/interfaces/ILogger.js';

export class EventBus implements IEventBus {
  private readonly emitter = new EventEmitter();

  constructor(private readonly logger: ILogger) {}

  async emit(event: DomainEvent): Promise<void> {
    this.logger.info(`Event emitted: ${event.name}`, {
      correlationId: event.correlationId,
    });
    this.emitter.emit(event.name, event);
  }

  on<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    this.emitter.on(eventName, (event: T) => {
      handler(event).catch((error) => {
        this.logger.error(
          `Error handling event: ${eventName}`,
          error instanceof Error ? error : new Error(String(error)),
          { correlationId: event.correlationId },
        );
      });
    });
  }
}
