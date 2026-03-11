import type { Lobby } from '../entities/Lobby';

export interface ILobbyRepository {
  findActive(): Promise<Lobby | null>;
  create(lobby: Lobby): Promise<Lobby>;
  update(lobby: Lobby): Promise<Lobby>;
  reset(): Promise<void>;
}
