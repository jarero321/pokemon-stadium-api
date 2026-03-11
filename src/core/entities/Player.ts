import type { Pokemon } from './Pokemon.js';

export interface Player {
  nickname: string;
  socketId: string;
  team: Pokemon[];
  activePokemonIndex: number;
  ready: boolean;
}
