import mongoose, { Schema } from 'mongoose';

const playerStatsSchema = new Schema(
  {
    nickname: { type: String, required: true, unique: true, index: true },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalBattles: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    battleHistory: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const PlayerModel = mongoose.model('PlayerStats', playerStatsSchema);
