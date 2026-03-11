import type { Battle, BattleTurn, NewBattleTurn } from '../entities/Battle.js';

export interface IBattleRepository {
  create(battle: Battle): Promise<Battle>;
  findById(id: string): Promise<Battle | null>;
  addTurn(battleId: string, turn: NewBattleTurn): Promise<BattleTurn>;
  finish(battleId: string, winner: string): Promise<Battle>;
  findByPlayer(nickname: string): Promise<Battle[]>;
}
