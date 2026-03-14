import type { ILogger } from '@core/interfaces/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { Lobby } from '@core/entities/index';
import { LobbyStatus, PlayerStatus } from '@core/enums/index';
import {
  LobbyFullError,
  PlayerAlreadyInLobbyError,
  LobbyNotInStateError,
} from '@core/errors/index';
import { guardNonEmptyString } from '@core/guards';
import { addPlayer } from '@core/operations/lobby';

const MAX_PLAYERS_PER_LOBBY = 2;

export class JoinLobby {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(nickname: string, playerId: string): Promise<Lobby> {
    guardNonEmptyString(nickname, 'nickname');
    guardNonEmptyString(playerId, 'playerId');

    this.logger.info('Player attempting to join lobby', {
      nickname,
    });

    let activeLobby = await this.lobbyRepository.findActive();

    if (!activeLobby) {
      activeLobby = await this.lobbyRepository.create({
        status: LobbyStatus.WAITING,
        players: [],
        currentTurnIndex: null,
        battleId: null,
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      this.logger.info('New lobby created', {
        lobbyId: activeLobby._id,
      });
    }

    if (activeLobby.status !== LobbyStatus.WAITING) {
      throw new LobbyNotInStateError(LobbyStatus.WAITING, activeLobby.status);
    }

    if (activeLobby.players.length >= MAX_PLAYERS_PER_LOBBY) {
      throw new LobbyFullError();
    }

    const playerAlreadyInLobby = activeLobby.players.some(
      (player) => player.nickname === nickname,
    );
    if (playerAlreadyInLobby) {
      throw new PlayerAlreadyInLobbyError();
    }

    const lobbyWithPlayer = addPlayer(
      activeLobby,
      nickname,
      playerId,
      PlayerStatus.JOINED,
    );

    const updatedLobby = await this.lobbyRepository.update(lobbyWithPlayer);

    this.logger.info('Player joined lobby', {
      nickname,
      playersCount: updatedLobby.players.length,
    });

    return updatedLobby;
  }
}
