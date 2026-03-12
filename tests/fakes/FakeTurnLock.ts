import type { ITurnLock } from '@core/interfaces/index';

export class FakeTurnLock implements ITurnLock {
  async acquire(): Promise<() => void> {
    return () => {};
  }
}
