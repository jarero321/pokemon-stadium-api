import type { LobbyStatus } from '../enums/LobbyStatus.js';
import type { Player } from './Player.js';

export interface Lobby {
  _id?: string;
  status: LobbyStatus;
  players: Player[];
  currentTurnIndex: number | null;
  battleId: string | null;
  winner: string | null;
  createdAt: Date;
  updatedAt: Date;
}
