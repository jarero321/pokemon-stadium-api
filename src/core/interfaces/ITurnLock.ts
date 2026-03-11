export interface ITurnLock {
  acquire(): Promise<() => void>;
}
