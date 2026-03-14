export interface PlayerStats {
  readonly _id?: string;
  readonly nickname: string;
  readonly wins: number;
  readonly losses: number;
  readonly totalBattles: number;
  readonly winRate: number;
  readonly battleHistory: readonly string[];
}
