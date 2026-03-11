import mongoose, { Schema } from 'mongoose';
import { LobbyStatus } from '@core/enums/index';
import { PlayerStatus } from '@core/enums/index';

const pokemonSchema = new Schema(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    type: { type: [String], required: true },
    hp: { type: Number, required: true },
    maxHp: { type: Number, required: true },
    attack: { type: Number, required: true },
    defense: { type: Number, required: true },
    speed: { type: Number, required: true },
    sprite: { type: String, required: true },
    defeated: { type: Boolean, default: false },
  },
  { _id: false },
);

const playerSchema = new Schema(
  {
    nickname: { type: String, required: true },
    playerId: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PlayerStatus),
      required: true,
    },
    team: { type: [pokemonSchema], default: [] },
    activePokemonIndex: { type: Number, default: 0 },
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
    },
    players: { type: [playerSchema], default: [] },
    currentTurnIndex: { type: Number, default: null },
    battleId: { type: String, default: null },
    winner: { type: String, default: null },
  },
  { timestamps: true },
);

export const LobbyModel = mongoose.model('Lobby', lobbySchema);
