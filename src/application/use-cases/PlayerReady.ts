import type { ILogger } from '@core/interfaces/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { IBattleRepository } from '@core/interfaces/index';
import type { IOperationRunner } from '@core/interfaces/index';
import type { Lobby } from '@core/entities/index';
import { BattleStatus, LobbyStatus, PlayerStatus } from '@core/enums/index';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  LobbyNotInStateError,
  InvalidPlayerStatusError,
} from '@core/errors/index';
import { determineFirstTurn } from '@core/operations/combat';
import {
  updatePlayer,
  setLobbyStatus,
  startBattle,
} from '@core/operations/lobby';
import { setStatus } from '@core/operations/player';

export class PlayerReady {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly battleRepository: IBattleRepository,
    private readonly logger: ILogger,
    private readonly runner: IOperationRunner,
  ) {}

  async execute(
    playerId: string,
    requestId: string,
  ): Promise<{
    lobby: Lobby;
    battleStarted: boolean;
    readyLobby: Lobby | null;
  }> {
    return this.runner.run(requestId, async (session) => {
      const lobby = await this.lobbyRepository.findActive(session);
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

      const updatedRequestingPlayer = setStatus(
        requestingPlayer,
        PlayerStatus.READY,
      );
      let updatedLobby = updatePlayer(lobby, playerId, updatedRequestingPlayer);

      this.logger.info('Player marked as ready', {
        nickname: requestingPlayer.nickname,
      });

      const bothPlayersReady =
        updatedLobby.players.length === 2 &&
        updatedLobby.players.every(
          (player) => player.status === PlayerStatus.READY,
        );

      if (bothPlayersReady) {
        const readyLobby = await this.lobbyRepository.update(
          setLobbyStatus(updatedLobby, LobbyStatus.READY),
          session,
        );

        this.logger.info('Both players ready, lobby status set to ready');

        const createdBattle = await this.battleRepository.create(
          {
            players: updatedLobby.players.map((player) => ({
              nickname: player.nickname,
              team: structuredClone(player.team) as typeof player.team,
            })),
            turns: [],
            winner: null,
            status: BattleStatus.IN_PROGRESS,
            startedAt: new Date(),
            finishedAt: null,
          },
          session,
        );

        updatedLobby = startBattle(
          updatedLobby,
          createdBattle._id!,
          determineFirstTurn(updatedLobby.players),
          PlayerStatus.BATTLING,
        );

        this.logger.info('Battle started', {
          battleId: createdBattle._id,
          firstTurn:
            updatedLobby.players[updatedLobby.currentTurnIndex!].nickname,
        });

        const finalLobby = await this.lobbyRepository.update(
          updatedLobby,
          session,
        );

        return {
          lobby: finalLobby,
          battleStarted: true,
          readyLobby,
        };
      }

      const finalLobby = await this.lobbyRepository.update(
        updatedLobby,
        session,
      );

      return { lobby: finalLobby, battleStarted: false, readyLobby: null };
    });
  }
}
