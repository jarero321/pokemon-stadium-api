import type { ITurnLock } from '@core/interfaces/ITurnLock';

export class InMemoryTurnLock implements ITurnLock {
  private pending: Promise<void> | null = null;

  async acquire(): Promise<() => void> {
    while (this.pending) {
      await this.pending;
    }

    let release!: () => void;
    this.pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    return () => {
      this.pending = null;
      release();
    };
  }
}
