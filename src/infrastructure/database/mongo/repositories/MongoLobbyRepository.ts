import type { ClientSession } from 'mongoose';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { TransactionSession } from '@core/interfaces/index';
import type { Lobby } from '@core/entities/index';
import { LobbyStatus } from '@core/enums/index';
import { LobbyModel } from '../schemas/LobbySchema';

function toSession(session?: TransactionSession): ClientSession | null {
  return (session as ClientSession) ?? null;
}

export class MongoLobbyRepository implements ILobbyRepository {
  async findActive(session?: TransactionSession): Promise<Lobby | null> {
    const doc = await LobbyModel.findOne({
      status: { $ne: LobbyStatus.FINISHED },
    })
      .session(toSession(session))
      .lean();

    if (!doc) return null;

    return {
      _id: doc._id.toString(),
      status: doc.status as Lobby['status'],
      players: doc.players as unknown as Lobby['players'],
      currentTurnIndex: doc.currentTurnIndex ?? null,
      battleId: doc.battleId ?? null,
      winner: doc.winner ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(lobby: Lobby, session?: TransactionSession): Promise<Lobby> {
    const [doc] = await LobbyModel.create(
      [{ ...lobby, players: [...lobby.players] }],
      { session: toSession(session) },
    );

    return {
      _id: doc._id.toString(),
      status: doc.status as Lobby['status'],
      players: doc.players as unknown as Lobby['players'],
      currentTurnIndex: doc.currentTurnIndex ?? null,
      battleId: doc.battleId ?? null,
      winner: doc.winner ?? null,
      createdAt: doc.createdAt!,
      updatedAt: doc.updatedAt!,
    };
  }

  async update(lobby: Lobby, session?: TransactionSession): Promise<Lobby> {
    const doc = await LobbyModel.findByIdAndUpdate(
      lobby._id,
      {
        status: lobby.status,
        players: [...lobby.players],
        currentTurnIndex: lobby.currentTurnIndex,
        battleId: lobby.battleId,
        winner: lobby.winner,
      },
      { returnDocument: 'after', lean: true, session: toSession(session) },
    );

    if (!doc) throw new Error(`Lobby ${lobby._id} not found`);

    return {
      _id: doc._id.toString(),
      status: doc.status as Lobby['status'],
      players: doc.players as Lobby['players'],
      currentTurnIndex: doc.currentTurnIndex ?? null,
      battleId: doc.battleId ?? null,
      winner: doc.winner ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async reset(session?: TransactionSession): Promise<void> {
    await LobbyModel.updateMany(
      { status: { $ne: LobbyStatus.FINISHED } },
      { status: LobbyStatus.FINISHED },
    ).session(toSession(session));
  }
}
