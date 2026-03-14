import type { Battle, BattleTurn, NewBattleTurn } from '@core/entities/index';
import type { IBattleRepository } from '@core/interfaces/index';

export class FakeBattleRepository implements IBattleRepository {
  private battles: Battle[] = [];
  private idCounter = 1;

  async create(battle: Battle): Promise<Battle> {
    const created = { ...battle, _id: `battle-${this.idCounter++}` };
    this.battles.push(structuredClone(created));
    return structuredClone(created);
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

    (battle.turns as BattleTurn[]).push(fullTurn);
    return structuredClone(fullTurn);
  }

  async finish(battleId: string, winner: string): Promise<Battle> {
    const battle = this.battles.find((b) => b._id === battleId);
    if (!battle) throw new Error(`Battle ${battleId} not found`);

    const finished = {
      ...battle,
      winner,
      status: 'finished',
      finishedAt: new Date(),
    };
    const index = this.battles.indexOf(battle);
    this.battles[index] = finished;
    return structuredClone(finished);
  }

  async findByPlayer(nickname: string, limit: number = 20): Promise<Battle[]> {
    return this.battles
      .filter((b) => b.players.some((p) => p.nickname === nickname))
      .slice(0, limit);
  }
}
