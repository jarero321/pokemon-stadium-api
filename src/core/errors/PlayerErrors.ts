import { BusinessError } from './BusinessError.js';

export class PlayerNotInLobbyError extends BusinessError {
  constructor() {
    super('PLAYER_NOT_IN_LOBBY', 'Player is not in the lobby');
  }
}

export class PlayerAlreadyInLobbyError extends BusinessError {
  constructor() {
    super('PLAYER_ALREADY_IN_LOBBY', 'Player is already in the lobby');
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

export class PlayerNotFoundError extends BusinessError {
  constructor(nickname: string) {
    super('PLAYER_NOT_FOUND', `Player '${nickname}' not found`, 404);
  }
}
