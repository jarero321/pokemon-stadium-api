import type { Lobby } from '@core/entities/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import { LobbyStatus } from '@core/enums/index';

export class FakeLobbyRepository implements ILobbyRepository {
  private lobbies: Lobby[] = [];
  private idCounter = 1;

  async findActive(): Promise<Lobby | null> {
    return this.lobbies.find((l) => l.status !== LobbyStatus.FINISHED) ?? null;
  }

  async create(lobby: Lobby): Promise<Lobby> {
    lobby._id = `lobby-${this.idCounter++}`;
    this.lobbies.push(lobby);
    return structuredClone(lobby);
  }

  async update(lobby: Lobby): Promise<Lobby> {
    const index = this.lobbies.findIndex((l) => l._id === lobby._id);
    if (index !== -1) {
      this.lobbies[index] = structuredClone(lobby);
    }
    return structuredClone(lobby);
  }

  async reset(): Promise<void> {
    this.lobbies = [];
  }
}
