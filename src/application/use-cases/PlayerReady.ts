import type { ILogger } from '@core/interfaces/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { IBattleRepository } from '@core/interfaces/index';
import type { Lobby } from '@core/entities/index';
import { BattleStatus, LobbyStatus, PlayerStatus } from '@core/enums/index';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  LobbyNotInStateError,
  InvalidPlayerStatusError,
} from '@core/errors/index';

export class PlayerReady {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly battleRepository: IBattleRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(playerId: string): Promise<{
    lobby: Lobby;
    battleStarted: boolean;
    readyLobby: Lobby | null;
  }> {
    const lobby = await this.lobbyRepository.findActive();
    if (!lobby) throw new LobbyNotFoundError();

    if (lobby.status !== LobbyStatus.WAITING) {
      throw new LobbyNotInStateError(LobbyStatus.WAITING, lobby.status);
    }

    const requestingPlayer = lobby.players.find(
      (player) => player.playerId === playerId,
    );
    if (!requestingPlayer) throw new PlayerNotInLobbyError();

    if (requestingPlayer.status !== PlayerStatus.TEAM_ASSIGNED) {
      throw new InvalidPlayerStatusError(
        PlayerStatus.TEAM_ASSIGNED,
        requestingPlayer.status,
      );
    }

    requestingPlayer.status = PlayerStatus.READY;

    this.logger.info('Player marked as ready', {
      nickname: requestingPlayer.nickname,
    });

    const bothPlayersReady =
      lobby.players.length === 2 &&
      lobby.players.every((player) => player.status === PlayerStatus.READY);

    if (bothPlayersReady) {
      lobby.status = LobbyStatus.READY;
      lobby.updatedAt = new Date();
      const readyLobby = await this.lobbyRepository.update(lobby);

      this.logger.info('Both players ready, lobby status set to ready');

      const createdBattle = await this.battleRepository.create({
        players: lobby.players.map((player) => ({
          nickname: player.nickname,
          team: structuredClone(player.team),
        })),
        turns: [],
        winner: null,
        status: BattleStatus.IN_PROGRESS,
        startedAt: new Date(),
        finishedAt: null,
      });

      lobby.battleId = createdBattle._id!;
      lobby.status = LobbyStatus.BATTLING;

      lobby.players.forEach((player) => {
        player.status = PlayerStatus.BATTLING;
      });

      const firstActivePokemonSpeed = lobby.players[0].team[0].speed;
      const secondActivePokemonSpeed = lobby.players[1].team[0].speed;
      lobby.currentTurnIndex =
        firstActivePokemonSpeed >= secondActivePokemonSpeed ? 0 : 1;

      this.logger.info('Battle started', {
        battleId: createdBattle._id,
        firstTurn: lobby.players[lobby.currentTurnIndex].nickname,
      });

      lobby.updatedAt = new Date();
      const updatedLobby = await this.lobbyRepository.update(lobby);

      return {
        lobby: updatedLobby,
        battleStarted: true,
        readyLobby: readyLobby,
      };
    }

    lobby.updatedAt = new Date();
    const updatedLobby = await this.lobbyRepository.update(lobby);

    return { lobby: updatedLobby, battleStarted: false, readyLobby: null };
  }
}
