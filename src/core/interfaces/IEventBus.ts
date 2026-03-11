import type { DomainEvent } from '../events/DomainEvent';

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
) => Promise<void>;

export interface IEventBus {
  emit(event: DomainEvent): Promise<void>;
  on<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void;
}
