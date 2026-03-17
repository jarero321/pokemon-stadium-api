import type { ILogger } from '@core/interfaces/index';
import type { ITurnLock } from '@core/interfaces/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { Lobby } from '@core/entities/index';
import { LobbyStatus, PlayerStatus } from '@core/enums/index';
import { LobbyFullError, LobbyNotInStateError } from '@core/errors/index';
import { guardNonEmptyString } from '@core/guards';
import { addPlayer, updatePlayer } from '@core/operations/lobby';

const MAX_PLAYERS_PER_LOBBY = 2;

export class JoinLobby {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly lobbyLock: ITurnLock,
    private readonly logger: ILogger,
  ) {}

  async execute(nickname: string, playerId: string): Promise<Lobby> {
    guardNonEmptyString(nickname, 'nickname');
    guardNonEmptyString(playerId, 'playerId');

    const release = await this.lobbyLock.acquire();
    try {
      return await this.joinOrCreate(nickname, playerId);
    } finally {
      release();
    }
  }

  private async joinOrCreate(
    nickname: string,
    playerId: string,
  ): Promise<Lobby> {
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

    // Check if nickname is already in the lobby
    const existingPlayer = activeLobby.players.find(
      (player) => player.nickname === nickname,
    );

    if (existingPlayer) {
      // Same playerId = same socket reconnecting (allowed)
      if (existingPlayer.playerId === playerId) {
        this.logger.info('Player already in lobby, returning current state', {
          nickname,
        });
        return activeLobby;
      }

      // Different playerId = different person with same nickname (reject)
      throw new LobbyFullError();
    }

    if (activeLobby.players.length >= MAX_PLAYERS_PER_LOBBY) {
      throw new LobbyFullError();
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
