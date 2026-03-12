import mongoose, { Schema } from 'mongoose';

const playerStatsSchema = new Schema(
  {
    nickname: {
      type: String,
      required: [true, 'Nickname is required'],
      unique: true,
      index: true,
      trim: true,
      minlength: [1, 'Nickname must be at least 1 character'],
      maxlength: [20, 'Nickname cannot exceed 20 characters'],
    },
    wins: {
      type: Number,
      default: 0,
      min: [0, 'Wins cannot be negative'],
    },
    losses: {
      type: Number,
      default: 0,
      min: [0, 'Losses cannot be negative'],
    },
    totalBattles: {
      type: Number,
      default: 0,
      min: [0, 'Total battles cannot be negative'],
    },
    winRate: {
      type: Number,
      default: 0,
      min: [0, 'Win rate cannot be negative'],
      max: [1, 'Win rate cannot exceed 1'],
    },
    battleHistory: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

playerStatsSchema.index({ winRate: -1, wins: -1 });

export const PlayerModel = mongoose.model('PlayerStats', playerStatsSchema);
