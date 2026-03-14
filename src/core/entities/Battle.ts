import type { Pokemon } from './Pokemon';

export interface BattleTurn {
  readonly turnNumber: number;
  readonly attacker: {
    readonly nickname: string;
    readonly pokemon: string;
    readonly attack: number;
  };
  readonly defender: {
    readonly nickname: string;
    readonly pokemon: string;
    readonly defense: number;
    readonly remainingHp: number;
    readonly maxHp: number;
  };
  readonly damage: number;
  readonly typeMultiplier: number;
  readonly defeated: boolean;
  readonly nextPokemon: string | null;
  readonly timestamp: Date;
}

export type NewBattleTurn = Omit<BattleTurn, 'turnNumber'>;

export interface BattlePlayer {
  readonly nickname: string;
  readonly team: readonly Pokemon[];
}

export interface Battle {
  readonly _id?: string;
  readonly players: readonly BattlePlayer[];
  readonly turns: readonly BattleTurn[];
  readonly winner: string | null;
  readonly status: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
}
