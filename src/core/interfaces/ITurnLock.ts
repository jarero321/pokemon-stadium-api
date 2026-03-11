export interface ITurnLock {
  acquire(lobbyId: string): Promise<() => void>;
}
