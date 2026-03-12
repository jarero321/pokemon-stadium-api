import type { DomainEvent } from './DomainEvent';

export interface BattleFinishedEvent extends DomainEvent {
  readonly name: 'BattleFinished';
  readonly battleId: string;
  readonly winner: string;
  readonly loser: string;
}

export function createBattleFinishedEvent(
  battleId: string,
  winner: string,
  loser: string,
  correlationId: string,
): BattleFinishedEvent {
  return {
    name: 'BattleFinished',
    battleId,
    winner,
    loser,
    correlationId,
    occurredAt: new Date(),
  };
}
