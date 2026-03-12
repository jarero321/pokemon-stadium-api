import mongoose, { Schema } from 'mongoose';
import { LobbyStatus } from '@core/enums/index';
import { PlayerStatus } from '@core/enums/index';

const pokemonSchema = new Schema(
  {
    id: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    type: {
      type: [String],
      required: true,
      validate: (v: string[]) => v.length > 0,
    },
    hp: { type: Number, required: true, min: 0 },
    maxHp: { type: Number, required: true, min: 1 },
    attack: { type: Number, required: true, min: 0 },
    defense: { type: Number, required: true, min: 0 },
    speed: { type: Number, required: true, min: 0 },
    sprite: { type: String, required: true },
    defeated: { type: Boolean, default: false },
  },
  { _id: false },
);

const playerSchema = new Schema(
  {
    nickname: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 20,
    },
    playerId: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PlayerStatus),
      required: true,
    },
    team: {
      type: [pokemonSchema],
      default: [],
      validate: (v: unknown[]) => v.length <= 3,
    },
    activePokemonIndex: { type: Number, default: 0, min: 0, max: 2 },
  },
  { _id: false },
);

const lobbySchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(LobbyStatus),
      required: true,
      default: LobbyStatus.WAITING,
      index: true,
    },
    players: {
      type: [playerSchema],
      default: [],
      validate: (v: unknown[]) => v.length <= 2,
    },
    currentTurnIndex: { type: Number, default: null, min: 0, max: 1 },
    battleId: { type: String, default: null },
    winner: { type: String, default: null },
  },
  { timestamps: true },
);

export const LobbyModel = mongoose.model('Lobby', lobbySchema);
