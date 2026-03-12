export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
  readonly correlationId: string;
}
