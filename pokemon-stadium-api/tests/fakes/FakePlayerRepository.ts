import type { PlayerStats } from '@core/entities/index';
import type { IPlayerRepository } from '@core/interfaces/index';

export class FakePlayerRepository implements IPlayerRepository {
  private players: Map<string, PlayerStats> = new Map();

  async findByNickname(nickname: string): Promise<PlayerStats | null> {
    return this.players.get(nickname) ?? null;
  }

  async upsert(player: PlayerStats): Promise<PlayerStats> {
    const stored = {
      ...player,
      _id: player._id ?? `player-${this.players.size + 1}`,
    };
    this.players.set(player.nickname, stored);
    return structuredClone(stored);
  }

  async addWin(nickname: string, battleId: string): Promise<void> {
    const player = this.players.get(nickname);
    if (!player) return;
    player.wins++;
    player.totalBattles++;
    player.winRate = player.wins / player.totalBattles;
    player.battleHistory.push(battleId);
  }

  async addLoss(nickname: string, battleId: string): Promise<void> {
    const player = this.players.get(nickname);
    if (!player) return;
    player.losses++;
    player.totalBattles++;
    player.winRate = player.wins / player.totalBattles;
    player.battleHistory.push(battleId);
  }

  async getLeaderboard(limit: number = 10): Promise<PlayerStats[]> {
    return [...this.players.values()]
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
      .slice(0, limit);
  }
}
