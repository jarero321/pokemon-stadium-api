import mongoose, { Schema } from 'mongoose';

const playerStatsSchema = new Schema(
  {
    nickname: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      minlength: 1,
      maxlength: 20,
    },
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
    totalBattles: { type: Number, default: 0, min: 0 },
    winRate: { type: Number, default: 0, min: 0, max: 1 },
    battleHistory: { type: [String], default: [] },
  },
  { timestamps: true },
);

playerStatsSchema.index({ winRate: -1, wins: -1 });

export const PlayerModel = mongoose.model('PlayerStats', playerStatsSchema);
