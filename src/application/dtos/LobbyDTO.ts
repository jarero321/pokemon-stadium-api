import type { LobbyStatus } from '@core/enums/index';

export interface PokemonStateDTO {
  id: number;
  name: string;
  type: readonly string[];
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  sprite: string;
  defeated: boolean;
}

export interface PlayerDTO {
  nickname: string;
  ready: boolean;
  team: PokemonStateDTO[];
  activePokemonIndex: number;
}

export interface LobbyDTO {
  status: LobbyStatus;
  players: PlayerDTO[];
  currentTurnIndex: number | null;
  winner: string | null;
}
