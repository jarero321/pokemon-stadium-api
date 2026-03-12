import { BusinessError } from './BusinessError';

export class NotYourTurnError extends BusinessError {
  constructor() {
    super('NOT_YOUR_TURN', 'It is not your turn to attack');
  }
}

export class BattleNotActiveError extends BusinessError {
  constructor() {
    super('BATTLE_NOT_ACTIVE', 'There is no active battle');
  }
}

export class BattleNotFoundError extends BusinessError {
  constructor(battleId: string) {
    super('BATTLE_NOT_FOUND', `Battle '${battleId}' not found`, 404);
  }
}

export class InvalidSwitchError extends BusinessError {
  constructor(reason: string) {
    super('INVALID_SWITCH', reason);
  }
}
