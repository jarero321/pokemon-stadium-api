import type { ClientSession } from 'mongoose';
import type { IBattleRepository } from '@core/interfaces/index';
import type { TransactionSession } from '@core/interfaces/index';
import type { Battle, BattleTurn, NewBattleTurn } from '@core/entities/index';
import { BattleStatus } from '@core/enums/index';
import { BattleModel } from '../schemas/BattleSchema';

function toSession(session?: TransactionSession): ClientSession | null {
  return (session as ClientSession) ?? null;
}

function toBattle(doc: Record<string, unknown>): Battle {
  const d = doc as {
    _id: { toString(): string };
    players: Battle['players'];
    turns: Battle['turns'];
    winner?: string | null;
    status: string;
    startedAt?: Date;
    finishedAt?: Date | null;
  };
  return {
    _id: d._id.toString(),
    players: d.players,
    turns: d.turns,
    winner: d.winner ?? null,
    status: d.status,
    startedAt: d.startedAt ?? new Date(),
    finishedAt: d.finishedAt ?? null,
  };
}

export class MongoBattleRepository implements IBattleRepository {
  async create(battle: Battle, session?: TransactionSession): Promise<Battle> {
    const [doc] = await BattleModel.create(
      [
        {
          ...battle,
          players: [...battle.players].map((p) => ({
            ...p,
            team: [...p.team],
          })),
          turns: [...battle.turns],
        },
      ],
      { session: toSession(session) },
    );
    return toBattle(doc.toObject());
  }

  async findById(
    id: string,
    session?: TransactionSession,
  ): Promise<Battle | null> {
    const doc = await BattleModel.findById(id)
      .session(toSession(session))
      .lean();
    if (!doc) return null;
    return toBattle(doc as unknown as Record<string, unknown>);
  }

  async addTurn(
    battleId: string,
    turn: NewBattleTurn,
    session?: TransactionSession,
  ): Promise<BattleTurn> {
    const battle = await BattleModel.findById(battleId).session(
      toSession(session),
    );
    if (!battle) throw new Error(`Battle ${battleId} not found`);

    const turnNumber = battle.turns.length + 1;
    const completeTurn: BattleTurn = { ...turn, turnNumber };

    battle.turns.push(completeTurn as never);
    await battle.save({ session: toSession(session) });

    return completeTurn;
  }

  async finish(
    battleId: string,
    winner: string,
    session?: TransactionSession,
  ): Promise<Battle> {
    const doc = await BattleModel.findByIdAndUpdate(
      battleId,
      { winner, status: BattleStatus.FINISHED, finishedAt: new Date() },
      { new: true, lean: true, session: toSession(session) },
    );

    if (!doc) throw new Error(`Battle ${battleId} not found`);
    return toBattle(doc as unknown as Record<string, unknown>);
  }

  async findByPlayer(nickname: string, limit: number = 20): Promise<Battle[]> {
    const docs = await BattleModel.find({ 'players.nickname': nickname })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    return docs.map((doc) =>
      toBattle(doc as unknown as Record<string, unknown>),
    );
  }
}
