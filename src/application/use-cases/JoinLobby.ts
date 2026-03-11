import type { ILogger } from '#core/interfaces/index.js';
import type { ILobbyRepository } from '#core/interfaces/index.js';
import type { Lobby } from '#core/entities/index.js';
import { LobbyStatus, PlayerStatus } from '#core/enums/index.js';
import {
  LobbyFullError,
  PlayerAlreadyInLobbyError,
  LobbyNotInStateError,
} from '#core/errors/index.js';

export class JoinLobby {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(nickname: string, socketId: string): Promise<Lobby> {
    this.logger.info('Player attempting to join lobby', {
      nickname,
    });

    let lobby = await this.lobbyRepository.findActive();

    if (!lobby) {
      lobby = await this.lobbyRepository.create({
        status: LobbyStatus.WAITING,
        players: [],
        currentTurnIndex: null,
        battleId: null,
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      this.logger.info('New lobby created', {
        lobbyId: lobby._id,
      });
    }

    if (lobby.status !== LobbyStatus.WAITING) {
      throw new LobbyNotInStateError(LobbyStatus.WAITING, lobby.status);
    }

    if (lobby.players.length >= 2) {
      throw new LobbyFullError();
    }

    const alreadyIn = lobby.players.some((p) => p.nickname === nickname);
    if (alreadyIn) {
      throw new PlayerAlreadyInLobbyError();
    }

    lobby.players.push({
      nickname,
      socketId,
      status: PlayerStatus.JOINED,
      team: [],
      activePokemonIndex: 0,
    });

    lobby.updatedAt = new Date();
    const updated = await this.lobbyRepository.update(lobby);

    this.logger.info('Player joined lobby', {
      nickname,
      playersCount: updated.players.length,
    });

    return updated;
  }
}
