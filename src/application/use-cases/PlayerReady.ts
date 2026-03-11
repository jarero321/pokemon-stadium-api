import type { ILogger } from '#core/interfaces/index.js';
import type { ILobbyRepository } from '#core/interfaces/index.js';
import type { IBattleRepository } from '#core/interfaces/index.js';
import type { Lobby } from '#core/entities/index.js';
import { LobbyStatus, PlayerStatus } from '#core/enums/index.js';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  LobbyNotInStateError,
  InvalidPlayerStatusError,
} from '#core/errors/index.js';

export class PlayerReady {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly battleRepository: IBattleRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(
    socketId: string,
  ): Promise<{ lobby: Lobby; battleStarted: boolean }> {
    const lobby = await this.lobbyRepository.findActive();
    if (!lobby) throw new LobbyNotFoundError();

    if (lobby.status !== LobbyStatus.WAITING) {
      throw new LobbyNotInStateError(LobbyStatus.WAITING, lobby.status);
    }

    const player = lobby.players.find((p) => p.socketId === socketId);
    if (!player) throw new PlayerNotInLobbyError();

    if (player.status !== PlayerStatus.TEAM_ASSIGNED) {
      throw new InvalidPlayerStatusError(
        PlayerStatus.TEAM_ASSIGNED,
        player.status,
      );
    }

    player.status = PlayerStatus.READY;

    this.logger.info('Player marked as ready', {
      nickname: player.nickname,
    });

    const allReady =
      lobby.players.length === 2 &&
      lobby.players.every((p) => p.status === PlayerStatus.READY);

    if (allReady) {
      const battle = await this.battleRepository.create({
        players: lobby.players.map((p) => ({
          nickname: p.nickname,
          team: structuredClone(p.team),
        })),
        turns: [],
        winner: null,
        status: LobbyStatus.BATTLING,
        startedAt: new Date(),
        finishedAt: null,
      });

      lobby.battleId = battle._id!;
      lobby.status = LobbyStatus.BATTLING;

      lobby.players.forEach((p) => {
        p.status = PlayerStatus.BATTLING;
      });

      const p1Speed = lobby.players[0].team[0].speed;
      const p2Speed = lobby.players[1].team[0].speed;
      lobby.currentTurnIndex = p1Speed >= p2Speed ? 0 : 1;

      this.logger.info('Battle started', {
        battleId: battle._id,
        firstTurn: lobby.players[lobby.currentTurnIndex].nickname,
      });
    }

    lobby.updatedAt = new Date();
    const updated = await this.lobbyRepository.update(lobby);

    return { lobby: updated, battleStarted: allReady };
  }
}
