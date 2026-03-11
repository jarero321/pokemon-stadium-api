import type { ILogger } from '#core/interfaces/index.js';
import type { ITurnLock } from '#core/interfaces/index.js';
import type { ILobbyRepository } from '#core/interfaces/index.js';
import type { Lobby } from '#core/entities/index.js';
import { LobbyStatus } from '#core/enums/index.js';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  NotYourTurnError,
  BattleNotActiveError,
  InvalidSwitchError,
} from '#core/errors/index.js';

export class SwitchPokemon {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly turnLock: ITurnLock,
    private readonly logger: ILogger,
  ) {}

  async execute(socketId: string, pokemonIndex: number): Promise<Lobby> {
    const initialLobby = await this.lobbyRepository.findActive();
    if (!initialLobby) throw new LobbyNotFoundError();

    const release = await this.turnLock.acquire(initialLobby._id!);

    try {
      return await this.processSwitch(socketId, pokemonIndex);
    } finally {
      release();
    }
  }

  private async processSwitch(
    socketId: string,
    pokemonIndex: number,
  ): Promise<Lobby> {
    const lobby = await this.lobbyRepository.findActive();
    if (!lobby) throw new LobbyNotFoundError();

    if (lobby.status !== LobbyStatus.BATTLING) {
      throw new BattleNotActiveError();
    }

    const playerIndex = lobby.players.findIndex((p) => p.socketId === socketId);
    if (playerIndex === -1) throw new PlayerNotInLobbyError();

    if (lobby.currentTurnIndex !== playerIndex) {
      throw new NotYourTurnError();
    }

    const player = lobby.players[playerIndex];

    if (pokemonIndex === player.activePokemonIndex) {
      throw new InvalidSwitchError('Cannot switch to the same active Pokemon');
    }

    if (pokemonIndex < 0 || pokemonIndex >= player.team.length) {
      throw new InvalidSwitchError('Invalid Pokemon index');
    }

    const targetPokemon = player.team[pokemonIndex];
    if (targetPokemon.defeated) {
      throw new InvalidSwitchError(
        `${targetPokemon.name} is defeated and cannot battle`,
      );
    }

    const previousPokemon = player.team[player.activePokemonIndex].name;
    player.activePokemonIndex = pokemonIndex;

    const defenderIndex = playerIndex === 0 ? 1 : 0;
    lobby.currentTurnIndex = defenderIndex;

    lobby.updatedAt = new Date();
    const updated = await this.lobbyRepository.update(lobby);

    this.logger.info('Player switched Pokemon', {
      nickname: player.nickname,
      from: previousPokemon,
      to: targetPokemon.name,
    });

    return updated;
  }
}
