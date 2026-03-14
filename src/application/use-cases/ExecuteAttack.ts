import type { ILogger } from '@core/interfaces/index';
import type { ITurnLock } from '@core/interfaces/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { IBattleRepository } from '@core/interfaces/index';
import type { IEventBus } from '@core/interfaces/index';
import type {
  IOperationRunner,
  TransactionSession,
} from '@core/interfaces/index';
import type { Lobby, NewBattleTurn } from '@core/entities/index';
import type {
  TurnResultDTO,
  PokemonDefeatedDTO,
  PokemonSwitchDTO,
} from '@application/dtos/index';
import { LobbyStatus } from '@core/enums/index';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  NotYourTurnError,
  BattleNotActiveError,
} from '@core/errors/index';
import { getTypeMultiplier } from '@core/typeEffectiveness';
import { createBattleFinishedEvent } from '@core/events/index';
import { guardNonEmptyString } from '@core/guards';
import { applyDamage } from '@core/operations/combat';
import {
  updatePlayer,
  advanceTurn,
  finishWithWinner,
} from '@core/operations/lobby';
import {
  switchActivePokemon,
  updatePokemonInTeam,
} from '@core/operations/player';

interface AttackResult {
  lobby: Lobby;
  turnResult: TurnResultDTO;
  pokemonDefeated: PokemonDefeatedDTO | null;
  pokemonSwitch: PokemonSwitchDTO | null;
  battleEnded: boolean;
  winner: string | null;
}

export class ExecuteAttack {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly battleRepository: IBattleRepository,
    private readonly turnLock: ITurnLock,
    private readonly eventBus: IEventBus,
    private readonly logger: ILogger,
    private readonly runner: IOperationRunner,
  ) {}

  async execute(playerId: string, requestId: string): Promise<AttackResult> {
    guardNonEmptyString(playerId, 'playerId');
    const release = await this.turnLock.acquire();

    try {
      return await this.runner.run(requestId, async (session) => {
        const lobby = await this.lobbyRepository.findActive(session);
        if (!lobby) throw new LobbyNotFoundError();

        return this.processAttack(playerId, lobby, session);
      });
    } finally {
      release();
    }
  }

  private async processAttack(
    playerId: string,
    lobby: Lobby,
    session: TransactionSession,
  ): Promise<AttackResult> {
    if (lobby.status !== LobbyStatus.BATTLING) {
      throw new BattleNotActiveError();
    }

    const attackerIndex = lobby.players.findIndex(
      (player) => player.playerId === playerId,
    );
    if (attackerIndex === -1) throw new PlayerNotInLobbyError();

    if (lobby.currentTurnIndex !== attackerIndex) {
      throw new NotYourTurnError();
    }

    const defenderIndex = attackerIndex === 0 ? 1 : 0;
    const attackingPlayer = lobby.players[attackerIndex];
    const defendingPlayer = lobby.players[defenderIndex];

    const attackingPokemon =
      attackingPlayer.team[attackingPlayer.activePokemonIndex];
    const defendingPokemon =
      defendingPlayer.team[defendingPlayer.activePokemonIndex];

    const typeMultiplier = getTypeMultiplier(
      attackingPokemon.type,
      defendingPokemon.type,
    );

    const rawDamage = Math.floor(
      (attackingPokemon.attack - defendingPokemon.defense) * typeMultiplier,
    );

    const damagedPokemon = applyDamage(defendingPokemon, rawDamage);
    const isDefeated = damagedPokemon.defeated;

    // Update the defending player with the damaged pokemon
    let updatedDefender = updatePokemonInTeam(
      defendingPlayer,
      defendingPlayer.activePokemonIndex,
      damagedPokemon,
    );

    let nextPokemonName: string | null = null;
    let battleEnded = false;
    let winner: string | null = null;
    let pokemonDefeatedNotification: PokemonDefeatedDTO | null = null;
    let pokemonSwitchNotification: PokemonSwitchDTO | null = null;

    if (isDefeated) {
      const remainingAlivePokemon = updatedDefender.team.filter(
        (pokemon) => !pokemon.defeated,
      ).length;

      pokemonDefeatedNotification = {
        owner: updatedDefender.nickname,
        pokemon: damagedPokemon.name,
        defeatedBy: attackingPokemon.name,
        remainingTeam: remainingAlivePokemon,
      };

      const nextAliveIndex = updatedDefender.team.findIndex(
        (pokemon) => !pokemon.defeated,
      );

      if (nextAliveIndex === -1) {
        battleEnded = true;
        winner = attackingPlayer.nickname;

        let updatedLobby = updatePlayer(
          lobby,
          defendingPlayer.playerId,
          updatedDefender,
        );
        updatedLobby = finishWithWinner(updatedLobby, winner);

        await this.battleRepository.finish(lobby.battleId!, winner, session);

        await this.eventBus.emit(
          createBattleFinishedEvent(
            lobby.battleId!,
            winner,
            defendingPlayer.nickname,
            crypto.randomUUID(),
          ),
        );

        this.logger.info('Battle finished', {
          winner,
          battleId: lobby.battleId,
        });

        const turnRecord = this.buildTurnRecord(
          attackingPlayer,
          attackingPokemon,
          updatedDefender,
          damagedPokemon,
          rawDamage,
          typeMultiplier,
          isDefeated,
          nextPokemonName,
        );

        const persistedTurn = await this.battleRepository.addTurn(
          lobby.battleId!,
          turnRecord,
          session,
        );

        const finalLobby = await this.lobbyRepository.update(
          updatedLobby,
          session,
        );

        return {
          lobby: finalLobby,
          turnResult: persistedTurn,
          pokemonDefeated: pokemonDefeatedNotification,
          pokemonSwitch: pokemonSwitchNotification,
          battleEnded,
          winner,
        };
      } else {
        updatedDefender = switchActivePokemon(updatedDefender, nextAliveIndex);
        const nextAlivePokemon = updatedDefender.team[nextAliveIndex];
        nextPokemonName = nextAlivePokemon.name;

        pokemonSwitchNotification = {
          player: updatedDefender.nickname,
          previousPokemon: damagedPokemon.name,
          newPokemon: nextAlivePokemon.name,
          newPokemonHp: nextAlivePokemon.hp,
          newPokemonMaxHp: nextAlivePokemon.maxHp,
        };

        this.logger.info('Pokemon auto-switched after defeat', {
          defender: updatedDefender.nickname,
          defeated: damagedPokemon.name,
          next: nextPokemonName,
        });
      }
    }

    const turnRecord = this.buildTurnRecord(
      attackingPlayer,
      attackingPokemon,
      updatedDefender,
      damagedPokemon,
      rawDamage,
      typeMultiplier,
      isDefeated,
      nextPokemonName,
    );

    const persistedTurn = await this.battleRepository.addTurn(
      lobby.battleId!,
      turnRecord,
      session,
    );

    let updatedLobby = updatePlayer(
      lobby,
      defendingPlayer.playerId,
      updatedDefender,
    );
    updatedLobby = advanceTurn(updatedLobby);

    const finalLobby = await this.lobbyRepository.update(updatedLobby, session);

    this.logger.debug('Turn executed', {
      attacker: attackingPokemon.name,
      defender: damagedPokemon.name,
      damage: turnRecord.damage,
      typeMultiplier,
      remainingHp: damagedPokemon.hp,
    });

    return {
      lobby: finalLobby,
      turnResult: persistedTurn,
      pokemonDefeated: pokemonDefeatedNotification,
      pokemonSwitch: pokemonSwitchNotification,
      battleEnded,
      winner,
    };
  }

  private buildTurnRecord(
    attackingPlayer: Lobby['players'][number],
    attackingPokemon: Lobby['players'][number]['team'][number],
    defendingPlayer: Lobby['players'][number],
    damagedPokemon: Lobby['players'][number]['team'][number],
    rawDamage: number,
    typeMultiplier: number,
    isDefeated: boolean,
    nextPokemonName: string | null,
  ): NewBattleTurn {
    const effectiveDamage = Math.max(1, rawDamage);
    return {
      attacker: {
        nickname: attackingPlayer.nickname,
        pokemon: attackingPokemon.name,
        attack: attackingPokemon.attack,
      },
      defender: {
        nickname: defendingPlayer.nickname,
        pokemon: damagedPokemon.name,
        defense: damagedPokemon.defense,
        remainingHp: damagedPokemon.hp,
        maxHp: damagedPokemon.maxHp,
      },
      damage: effectiveDamage,
      typeMultiplier,
      defeated: isDefeated,
      nextPokemon: nextPokemonName,
      timestamp: new Date(),
    };
  }
}
