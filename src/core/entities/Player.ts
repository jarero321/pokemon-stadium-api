import type { Pokemon } from './Pokemon';
import type { PlayerStatus } from '../enums/PlayerStatus';

export interface Player {
  nickname: string;
  playerId: string;
  status: PlayerStatus;
  team: Pokemon[];
  activePokemonIndex: number;
}
