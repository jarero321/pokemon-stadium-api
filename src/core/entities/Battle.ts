import type { Pokemon } from './Pokemon';

export interface BattleTurn {
  turnNumber: number;
  attacker: {
    nickname: string;
    pokemon: string;
    attack: number;
  };
  defender: {
    nickname: string;
    pokemon: string;
    defense: number;
    remainingHp: number;
    maxHp: number;
  };
  damage: number;
  typeMultiplier: number;
  defeated: boolean;
  nextPokemon: string | null;
  timestamp: Date;
}

export type NewBattleTurn = Omit<BattleTurn, 'turnNumber'>;

export interface BattlePlayer {
  nickname: string;
  team: Pokemon[];
}

export interface Battle {
  _id?: string;
  players: BattlePlayer[];
  turns: BattleTurn[];
  winner: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
}
