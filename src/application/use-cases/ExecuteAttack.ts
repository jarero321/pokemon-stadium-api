import type { ILogger } from '#core/interfaces/index.js';
import type { ITurnLock } from '#core/interfaces/index.js';
import type { ILobbyRepository } from '#core/interfaces/index.js';
import type { IBattleRepository } from '#core/interfaces/index.js';
import type { IEventBus } from '#core/interfaces/index.js';
import type { Lobby, BattleTurn } from '#core/entities/index.js';
import type { TurnResultDTO } from '#application/dtos/index.js';
import { LobbyStatus } from '#core/enums/index.js';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  NotYourTurnError,
  BattleNotActiveError,
} from '#core/errors/index.js';
import { getTypeMultiplier } from '#core/typeEffectiveness.js';
import { createBattleFinishedEvent } from '#core/events/index.js';

interface AttackResult {
  lobby: Lobby;
  turnResult: TurnResultDTO;
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

  async execute(socketId: string): Promise<AttackResult> {
    const initialLobby = await this.lobbyRepository.findActive();
    if (!initialLobby) throw new LobbyNotFoundError();

    const release = await this.turnLock.acquire(initialLobby._id!);

    try {
      return await this.processAttack(socketId);
    } finally {
      release();
    }
  }

  private async processAttack(socketId: string): Promise<AttackResult> {
    const lobby = await this.lobbyRepository.findActive();
    if (!lobby) throw new LobbyNotFoundError();

    if (lobby.status !== LobbyStatus.BATTLING) {
      throw new BattleNotActiveError();
    }

    const attackerIndex = lobby.players.findIndex(
      (p) => p.socketId === socketId,
    );
    if (attackerIndex === -1) throw new PlayerNotInLobbyError();

    if (lobby.currentTurnIndex !== attackerIndex) {
      throw new NotYourTurnError();
    }

    const defenderIndex = attackerIndex === 0 ? 1 : 0;
    const attacker = lobby.players[attackerIndex];
    const defender = lobby.players[defenderIndex];

    const atkPokemon = attacker.team[attacker.activePokemonIndex];
    const defPokemon = defender.team[defender.activePokemonIndex];

    const typeMultiplier = getTypeMultiplier(atkPokemon.type, defPokemon.type);

    const rawDamage = Math.floor(
      (atkPokemon.attack - defPokemon.defense) * typeMultiplier,
    );
    const damage = Math.max(1, rawDamage);

    defPokemon.hp = Math.max(0, defPokemon.hp - damage);
    const defeated = defPokemon.hp === 0;

    if (defeated) {
      defPokemon.defeated = true;
    }

    let nextPokemon: string | null = null;
    let battleEnded = false;
    let winner: string | null = null;

    if (defeated) {
      const nextIndex = defender.team.findIndex((p) => !p.defeated);

      if (nextIndex === -1) {
        battleEnded = true;
        winner = attacker.nickname;
        lobby.status = LobbyStatus.FINISHED;
        lobby.winner = winner;

        await this.battleRepository.finish(lobby.battleId!, winner);

        await this.eventBus.emit(
          createBattleFinishedEvent(
            lobby.battleId!,
            winner,
            defender.nickname,
            crypto.randomUUID(),
          ),
        );

        this.logger.info('Battle finished', {
          winner,
          battleId: lobby.battleId,
        });
      } else {
        defender.activePokemonIndex = nextIndex;
        nextPokemon = defender.team[nextIndex].name;

        this.logger.info('Pokemon switched', {
          defender: defender.nickname,
          defeated: defPokemon.name,
          next: nextPokemon,
        });
      }
    }

    const turn: BattleTurn = {
      turnNumber:
        (await this.battleRepository.findById(lobby.battleId!))!.turns.length +
        1,
      attacker: {
        nickname: attacker.nickname,
        pokemon: atkPokemon.name,
        attack: atkPokemon.attack,
      },
      defender: {
        nickname: defender.nickname,
        pokemon: defPokemon.name,
        defense: defPokemon.defense,
        remainingHp: defPokemon.hp,
        maxHp: defPokemon.maxHp,
      },
      damage,
      typeMultiplier,
      defeated,
      nextPokemon,
      timestamp: new Date(),
    };

    await this.battleRepository.addTurn(lobby.battleId!, turn);

    if (!battleEnded) {
      lobby.currentTurnIndex = defenderIndex;
    }

    lobby.updatedAt = new Date();
    const updated = await this.lobbyRepository.update(lobby);

    this.logger.debug('Turn executed', {
      attacker: atkPokemon.name,
      defender: defPokemon.name,
      damage,
      typeMultiplier,
      remainingHp: defPokemon.hp,
    });

    return {
      lobby: updated,
      turnResult: turn,
      battleEnded,
      winner,
    };
  }
}
