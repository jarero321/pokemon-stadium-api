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
