import type { Lobby } from '../entities/Lobby.js';

export interface ILobbyRepository {
  findActive(): Promise<Lobby | null>;
  create(lobby: Lobby): Promise<Lobby>;
  update(lobby: Lobby): Promise<Lobby>;
  reset(): Promise<void>;
}
