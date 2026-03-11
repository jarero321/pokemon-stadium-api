import type { LobbyStatus } from '../enums/LobbyStatus';
import type { Player } from './Player';

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
