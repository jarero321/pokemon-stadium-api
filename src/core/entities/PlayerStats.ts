export interface PlayerStats {
  _id?: string;
  nickname: string;
  wins: number;
  losses: number;
  totalBattles: number;
  winRate: number;
  battleHistory: string[];
}
