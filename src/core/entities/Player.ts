import type { Pokemon } from './Pokemon.js';
import type { PlayerStatus } from '../enums/PlayerStatus.js';

export interface Player {
  nickname: string;
  socketId: string;
  status: PlayerStatus;
  team: Pokemon[];
  activePokemonIndex: number;
}
