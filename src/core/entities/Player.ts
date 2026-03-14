import type { Pokemon } from './Pokemon';
import type { PlayerStatus } from '../enums/PlayerStatus';

export interface Player {
  readonly nickname: string;
  readonly playerId: string;
  readonly status: PlayerStatus;
  readonly team: readonly Pokemon[];
  readonly activePokemonIndex: number;
}
