import type { ClientSession } from 'mongoose';
import type { IPlayerRepository } from '@core/interfaces/index';
import type { TransactionSession } from '@core/interfaces/index';
import type { PlayerStats } from '@core/entities/index';
import { PlayerModel } from '../schemas/PlayerSchema';

function toSession(session?: TransactionSession): ClientSession | null {
  return (session as ClientSession) ?? null;
}

function toPlayerStats(doc: {
  _id: { toString(): string };
  nickname: string;
  wins: number;
  losses: number;
  totalBattles: number;
  winRate: number;
  battleHistory: string[];
}): PlayerStats {
  return {
    _id: doc._id.toString(),
    nickname: doc.nickname,
    wins: doc.wins,
    losses: doc.losses,
    totalBattles: doc.totalBattles,
    winRate: doc.winRate,
    battleHistory: doc.battleHistory,
  };
}

export class MongoPlayerRepository implements IPlayerRepository {
  async findByNickname(nickname: string): Promise<PlayerStats | null> {
    const doc = await PlayerModel.findOne({ nickname }).lean();
    if (!doc) return null;
    return toPlayerStats(doc);
  }

  async upsert(player: PlayerStats): Promise<PlayerStats> {
    const doc = await PlayerModel.findOneAndUpdate(
      { nickname: player.nickname },
      player,
      { upsert: true, returnDocument: 'after', lean: true },
    );

    if (!doc) throw new Error(`Failed to upsert player ${player.nickname}`);
    return toPlayerStats(doc);
  }

  async addWin(
    nickname: string,
    battleId: string,
    session?: TransactionSession,
  ): Promise<void> {
    const doc = await PlayerModel.findOneAndUpdate(
      { nickname },
      {
        $inc: { wins: 1, totalBattles: 1 },
        $push: { battleHistory: battleId },
      },
      { upsert: true, returnDocument: 'after', session: toSession(session) },
    );

    doc.winRate = doc.totalBattles > 0 ? doc.wins / doc.totalBattles : 0;
    await doc.save({ session: toSession(session) });
  }

  async addLoss(
    nickname: string,
    battleId: string,
    session?: TransactionSession,
  ): Promise<void> {
    const doc = await PlayerModel.findOneAndUpdate(
      { nickname },
      {
        $inc: { losses: 1, totalBattles: 1 },
        $push: { battleHistory: battleId },
      },
      { upsert: true, returnDocument: 'after', session: toSession(session) },
    );

    doc.winRate = doc.totalBattles > 0 ? doc.wins / doc.totalBattles : 0;
    await doc.save({ session: toSession(session) });
  }

  async getLeaderboard(limit: number = 10): Promise<PlayerStats[]> {
    const docs = await PlayerModel.find()
      .sort({ winRate: -1, wins: -1 })
      .limit(limit)
      .lean();

    return docs.map(toPlayerStats);
  }
}
