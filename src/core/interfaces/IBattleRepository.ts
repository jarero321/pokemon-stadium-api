import type { Battle, BattleTurn, NewBattleTurn } from '../entities/Battle';
import type { TransactionSession } from './IOperationRunner';

export interface IBattleRepository {
  create(battle: Battle, session?: TransactionSession): Promise<Battle>;
  findById(id: string, session?: TransactionSession): Promise<Battle | null>;
  addTurn(
    battleId: string,
    turn: NewBattleTurn,
    session?: TransactionSession,
  ): Promise<BattleTurn>;
  finish(
    battleId: string,
    winner: string,
    session?: TransactionSession,
  ): Promise<Battle>;
  findByPlayer(nickname: string, limit?: number): Promise<Battle[]>;
}
