import type { ILobbyRepository } from '@core/interfaces/index';
import type { Lobby } from '@core/entities/index';
import { LobbyStatus } from '@core/enums/index';
import { LobbyModel } from '../schemas/LobbySchema';

export class MongoLobbyRepository implements ILobbyRepository {
  async findActive(): Promise<Lobby | null> {
    const doc = await LobbyModel.findOne({
      status: { $ne: LobbyStatus.FINISHED },
    }).lean();

    if (!doc) return null;

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

  async create(lobby: Lobby): Promise<Lobby> {
    const doc = await LobbyModel.create(lobby);

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

  async update(lobby: Lobby): Promise<Lobby> {
    const doc = await LobbyModel.findByIdAndUpdate(
      lobby._id,
      {
        status: lobby.status,
        players: lobby.players,
        currentTurnIndex: lobby.currentTurnIndex,
        battleId: lobby.battleId,
        winner: lobby.winner,
      },
      { new: true, lean: true },
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

  async reset(): Promise<void> {
    await LobbyModel.updateMany(
      { status: { $ne: LobbyStatus.FINISHED } },
      { status: LobbyStatus.FINISHED },
    );
  }
}
