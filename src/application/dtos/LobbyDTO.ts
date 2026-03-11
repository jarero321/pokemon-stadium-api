import type { LobbyStatus } from '#core/enums/index.js';

export interface PokemonStateDTO {
  id: number;
  name: string;
  type: string[];
  hp: number;
  maxHp: number;
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
