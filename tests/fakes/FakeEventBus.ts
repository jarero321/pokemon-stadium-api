import type { DomainEvent } from '@core/events/index';
import type { IEventBus, EventHandler } from '@core/interfaces/index';

export class FakeEventBus implements IEventBus {
  readonly emitted: DomainEvent[] = [];
  private handlers = new Map<string, EventHandler[]>();

  async emit(event: DomainEvent): Promise<void> {
    this.emitted.push(event);
    const handlers = this.handlers.get(event.name) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
  }

  on<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    const existing = this.handlers.get(eventName) ?? [];
    existing.push(handler as EventHandler);
    this.handlers.set(eventName, existing);
  }
}
