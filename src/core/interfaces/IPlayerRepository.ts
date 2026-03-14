import type { PlayerStats } from '../entities/PlayerStats';
import type { TransactionSession } from './IOperationRunner';

export interface IPlayerRepository {
  findByNickname(nickname: string): Promise<PlayerStats | null>;
  upsert(player: PlayerStats): Promise<PlayerStats>;
  addWin(
    nickname: string,
    battleId: string,
    session?: TransactionSession,
  ): Promise<void>;
  addLoss(
    nickname: string,
    battleId: string,
    session?: TransactionSession,
  ): Promise<void>;
  getLeaderboard(limit?: number): Promise<PlayerStats[]>;
}
