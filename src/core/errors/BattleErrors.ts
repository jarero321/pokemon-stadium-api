import { BusinessError } from './BusinessError.js';

export class NotYourTurnError extends BusinessError {
  constructor() {
    super('NOT_YOUR_TURN', 'It is not your turn to attack');
  }
}

export class PokemonAlreadyDefeatedError extends BusinessError {
  constructor(pokemonName: string) {
    super('POKEMON_DEFEATED', `${pokemonName} is already defeated`);
  }
}

export class BattleNotActiveError extends BusinessError {
  constructor() {
    super('BATTLE_NOT_ACTIVE', 'There is no active battle');
  }
}

export class PlayerNotInLobbyError extends BusinessError {
  constructor() {
    super('PLAYER_NOT_IN_LOBBY', 'Player is not in the lobby');
  }
}

export class TeamNotAssignedError extends BusinessError {
  constructor() {
    super(
      'TEAM_NOT_ASSIGNED',
      'Player must have a team assigned before being ready',
    );
  }
}

export class InvalidSwitchError extends BusinessError {
  constructor(reason: string) {
    super('INVALID_SWITCH', reason);
  }
}

export class InvalidPlayerStatusError extends BusinessError {
  constructor(expected: string, actual: string) {
    super(
      'INVALID_PLAYER_STATUS',
      `Player must be in '${expected}' status, but is '${actual}'`,
    );
  }
}
