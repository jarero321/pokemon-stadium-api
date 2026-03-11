import type { PlayerStats } from '../entities/PlayerStats.js';

export interface IPlayerRepository {
  findByNickname(nickname: string): Promise<PlayerStats | null>;
  upsert(player: PlayerStats): Promise<PlayerStats>;
  addWin(nickname: string, battleId: string): Promise<void>;
  addLoss(nickname: string, battleId: string): Promise<void>;
  getLeaderboard(limit?: number): Promise<PlayerStats[]>;
}
