import type { Lobby } from '../entities/Lobby';
import type { TransactionSession } from './IOperationRunner';

export interface ILobbyRepository {
  findActive(session?: TransactionSession): Promise<Lobby | null>;
  create(lobby: Lobby, session?: TransactionSession): Promise<Lobby>;
  update(lobby: Lobby, session?: TransactionSession): Promise<Lobby>;
  reset(session?: TransactionSession): Promise<void>;
}
