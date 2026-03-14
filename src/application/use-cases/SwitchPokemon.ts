import type { ILogger } from '@core/interfaces/index';
import type { ITurnLock } from '@core/interfaces/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { IOperationRunner } from '@core/interfaces/index';
import type { Lobby } from '@core/entities/index';
import type { PokemonSwitchDTO } from '@application/dtos/BattleDTO';
import { LobbyStatus } from '@core/enums/index';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  NotYourTurnError,
  BattleNotActiveError,
  InvalidSwitchError,
} from '@core/errors/index';
import { guardNonEmptyString, guardNonNegativeInteger } from '@core/guards';
import { updatePlayer, advanceTurn } from '@core/operations/lobby';
import { switchActivePokemon } from '@core/operations/player';

export class SwitchPokemon {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly turnLock: ITurnLock,
    private readonly logger: ILogger,
    private readonly runner: IOperationRunner,
  ) {}

  async execute(
    playerId: string,
    targetPokemonIndex: number,
    requestId: string,
  ): Promise<{ lobby: Lobby; switchInfo: PokemonSwitchDTO }> {
    guardNonEmptyString(playerId, 'playerId');
    guardNonNegativeInteger(targetPokemonIndex, 'targetPokemonIndex');
    const release = await this.turnLock.acquire();

    try {
      return await this.runner.run(requestId, async (session) => {
        const lobby = await this.lobbyRepository.findActive(session);
        if (!lobby) throw new LobbyNotFoundError();

        return this.processSwitch(playerId, targetPokemonIndex, lobby, session);
      });
    } finally {
      release();
    }
  }

  private async processSwitch(
    playerId: string,
    targetPokemonIndex: number,
    lobby: Lobby,
    session: unknown,
  ): Promise<{ lobby: Lobby; switchInfo: PokemonSwitchDTO }> {
    if (lobby.status !== LobbyStatus.BATTLING) {
      throw new BattleNotActiveError();
    }

    const requestingPlayerIndex = lobby.players.findIndex(
      (player) => player.playerId === playerId,
    );
    if (requestingPlayerIndex === -1) throw new PlayerNotInLobbyError();

    if (lobby.currentTurnIndex !== requestingPlayerIndex) {
      throw new NotYourTurnError();
    }

    const requestingPlayer = lobby.players[requestingPlayerIndex];

    if (targetPokemonIndex === requestingPlayer.activePokemonIndex) {
      throw new InvalidSwitchError('Cannot switch to the same active Pokemon');
    }

    if (
      targetPokemonIndex < 0 ||
      targetPokemonIndex >= requestingPlayer.team.length
    ) {
      throw new InvalidSwitchError('Invalid Pokemon index');
    }

    const targetPokemon = requestingPlayer.team[targetPokemonIndex];
    if (targetPokemon.defeated) {
      throw new InvalidSwitchError(
        `${targetPokemon.name} is defeated and cannot battle`,
      );
    }

    const previousPokemonName =
      requestingPlayer.team[requestingPlayer.activePokemonIndex].name;

    const updatedRequestingPlayer = switchActivePokemon(
      requestingPlayer,
      targetPokemonIndex,
    );

    let updatedLobby = updatePlayer(lobby, playerId, updatedRequestingPlayer);
    updatedLobby = advanceTurn(updatedLobby);

    const finalLobby = await this.lobbyRepository.update(updatedLobby, session);

    this.logger.info('Player switched Pokemon', {
      nickname: requestingPlayer.nickname,
      from: previousPokemonName,
      to: targetPokemon.name,
    });

    const switchInfo: PokemonSwitchDTO = {
      player: requestingPlayer.nickname,
      previousPokemon: previousPokemonName,
      newPokemon: targetPokemon.name,
      newPokemonHp: targetPokemon.hp,
      newPokemonMaxHp: targetPokemon.maxHp,
    };

    return { lobby: finalLobby, switchInfo };
  }
}
