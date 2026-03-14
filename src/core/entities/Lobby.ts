import type { LobbyStatus } from '../enums/LobbyStatus';
import type { Player } from './Player';

export interface Lobby {
  readonly _id?: string;
  readonly status: LobbyStatus;
  readonly players: readonly Player[];
  readonly currentTurnIndex: number | null;
  readonly battleId: string | null;
  readonly winner: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
