import { BusinessError } from './BusinessError.js';

export class LobbyFullError extends BusinessError {
  constructor() {
    super('LOBBY_FULL', 'The lobby already has 2 players');
  }
}

export class LobbyNotFoundError extends BusinessError {
  constructor() {
    super('LOBBY_NOT_FOUND', 'No active lobby found', 404);
  }
}

export class LobbyNotInStateError extends BusinessError {
  constructor(expected: string, actual: string) {
    super(
      'LOBBY_INVALID_STATE',
      `Lobby must be in '${expected}' state, but is '${actual}'`,
    );
  }
}
