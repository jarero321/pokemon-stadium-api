import type { ITurnLock } from '#core/interfaces/ITurnLock.js';

export class InMemoryTurnLock implements ITurnLock {
  private locks = new Map<string, Promise<void>>();

  async acquire(lobbyId: string): Promise<() => void> {
    while (this.locks.has(lobbyId)) {
      await this.locks.get(lobbyId);
    }

    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(lobbyId, promise);

    return () => {
      this.locks.delete(lobbyId);
      release();
    };
  }
}
