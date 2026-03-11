import type { ILogger } from '@core/interfaces/index';
import type { ITurnLock } from '@core/interfaces/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { IBattleRepository } from '@core/interfaces/index';
import type { IEventBus } from '@core/interfaces/index';
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

const MINIMUM_DAMAGE = 1;

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
  ) {}

  async execute(playerId: string): Promise<AttackResult> {
    const release = await this.turnLock.acquire();

    try {
      const lobby = await this.lobbyRepository.findActive();
      if (!lobby) throw new LobbyNotFoundError();

      return await this.processAttack(playerId, lobby);
    } finally {
      release();
    }
  }

  private async processAttack(
    playerId: string,
    lobby: Lobby,
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
    const effectiveDamage = Math.max(MINIMUM_DAMAGE, rawDamage);

    defendingPokemon.hp = Math.max(0, defendingPokemon.hp - effectiveDamage);
    const isDefeated = defendingPokemon.hp === 0;

    if (isDefeated) {
      defendingPokemon.defeated = true;
    }

    let nextPokemonName: string | null = null;
    let battleEnded = false;
    let winner: string | null = null;
    let pokemonDefeatedNotification: PokemonDefeatedDTO | null = null;
    let pokemonSwitchNotification: PokemonSwitchDTO | null = null;

    if (isDefeated) {
      const remainingAlivePokemon = defendingPlayer.team.filter(
        (pokemon) => !pokemon.defeated,
      ).length;

      pokemonDefeatedNotification = {
        owner: defendingPlayer.nickname,
        pokemon: defendingPokemon.name,
        defeatedBy: attackingPokemon.name,
        remainingTeam: remainingAlivePokemon,
      };

      const nextAliveIndex = defendingPlayer.team.findIndex(
        (pokemon) => !pokemon.defeated,
      );

      if (nextAliveIndex === -1) {
        battleEnded = true;
        winner = attackingPlayer.nickname;
        lobby.status = LobbyStatus.FINISHED;
        lobby.winner = winner;

        await this.battleRepository.finish(lobby.battleId!, winner);

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
      } else {
        defendingPlayer.activePokemonIndex = nextAliveIndex;
        const nextAlivePokemon = defendingPlayer.team[nextAliveIndex];
        nextPokemonName = nextAlivePokemon.name;

        pokemonSwitchNotification = {
          player: defendingPlayer.nickname,
          previousPokemon: defendingPokemon.name,
          newPokemon: nextAlivePokemon.name,
          newPokemonHp: nextAlivePokemon.hp,
          newPokemonMaxHp: nextAlivePokemon.maxHp,
        };

        this.logger.info('Pokemon auto-switched after defeat', {
          defender: defendingPlayer.nickname,
          defeated: defendingPokemon.name,
          next: nextPokemonName,
        });
      }
    }

    const turnRecord: NewBattleTurn = {
      attacker: {
        nickname: attackingPlayer.nickname,
        pokemon: attackingPokemon.name,
        attack: attackingPokemon.attack,
      },
      defender: {
        nickname: defendingPlayer.nickname,
        pokemon: defendingPokemon.name,
        defense: defendingPokemon.defense,
        remainingHp: defendingPokemon.hp,
        maxHp: defendingPokemon.maxHp,
      },
      damage: effectiveDamage,
      typeMultiplier,
      defeated: isDefeated,
      nextPokemon: nextPokemonName,
      timestamp: new Date(),
    };

    const persistedTurn = await this.battleRepository.addTurn(
      lobby.battleId!,
      turnRecord,
    );

    if (!battleEnded) {
      lobby.currentTurnIndex = defenderIndex;
    }

    lobby.updatedAt = new Date();
    const updatedLobby = await this.lobbyRepository.update(lobby);

    this.logger.debug('Turn executed', {
      attacker: attackingPokemon.name,
      defender: defendingPokemon.name,
      damage: effectiveDamage,
      typeMultiplier,
      remainingHp: defendingPokemon.hp,
    });

    return {
      lobby: updatedLobby,
      turnResult: persistedTurn,
      pokemonDefeated: pokemonDefeatedNotification,
      pokemonSwitch: pokemonSwitchNotification,
      battleEnded,
      winner,
    };
  }
}
