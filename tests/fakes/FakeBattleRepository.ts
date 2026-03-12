import type { Battle, BattleTurn, NewBattleTurn } from '@core/entities/index';
import type { IBattleRepository } from '@core/interfaces/index';

export class FakeBattleRepository implements IBattleRepository {
  private battles: Battle[] = [];
  private idCounter = 1;

  async create(battle: Battle): Promise<Battle> {
    battle._id = `battle-${this.idCounter++}`;
    this.battles.push(structuredClone(battle));
    return structuredClone(battle);
  }

  async findById(id: string): Promise<Battle | null> {
    return this.battles.find((b) => b._id === id) ?? null;
  }

  async addTurn(battleId: string, turn: NewBattleTurn): Promise<BattleTurn> {
    const battle = this.battles.find((b) => b._id === battleId);
    if (!battle) throw new Error(`Battle ${battleId} not found`);

    const fullTurn: BattleTurn = {
      ...turn,
      turnNumber: battle.turns.length + 1,
    };

    battle.turns.push(fullTurn);
    return structuredClone(fullTurn);
  }

  async finish(battleId: string, winner: string): Promise<Battle> {
    const battle = this.battles.find((b) => b._id === battleId);
    if (!battle) throw new Error(`Battle ${battleId} not found`);

    battle.winner = winner;
    battle.status = 'finished';
    battle.finishedAt = new Date();
    return structuredClone(battle);
  }

  async findByPlayer(nickname: string, limit: number = 20): Promise<Battle[]> {
    return this.battles
      .filter((b) => b.players.some((p) => p.nickname === nickname))
      .slice(0, limit);
  }
}
