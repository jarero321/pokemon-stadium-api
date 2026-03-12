import mongoose, { Schema } from 'mongoose';

const battleTurnSchema = new Schema(
  {
    turnNumber: { type: Number, required: true, min: 1 },
    attacker: {
      nickname: { type: String, required: true },
      pokemon: { type: String, required: true },
      attack: { type: Number, required: true, min: 0 },
    },
    defender: {
      nickname: { type: String, required: true },
      pokemon: { type: String, required: true },
      defense: { type: Number, required: true, min: 0 },
      remainingHp: { type: Number, required: true, min: 0 },
      maxHp: { type: Number, required: true, min: 1 },
    },
    damage: { type: Number, required: true, min: 0 },
    typeMultiplier: { type: Number, required: true, min: 0 },
    defeated: { type: Boolean, required: true },
    nextPokemon: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const battlePokemonSchema = new Schema(
  {
    id: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    type: { type: [String], required: true },
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

const battlePlayerSchema = new Schema(
  {
    nickname: { type: String, required: true, trim: true },
    team: { type: [battlePokemonSchema], default: [] },
  },
  { _id: false },
);

const battleSchema = new Schema({
  players: { type: [battlePlayerSchema], required: true },
  turns: { type: [battleTurnSchema], default: [] },
  winner: { type: String, default: null },
  status: {
    type: String,
    required: true,
    default: 'in_progress',
    enum: ['in_progress', 'finished'],
    index: true,
  },
  startedAt: { type: Date, default: Date.now, index: true },
  finishedAt: { type: Date, default: null },
});

battleSchema.index({ 'players.nickname': 1, startedAt: -1 });

export const BattleModel = mongoose.model('Battle', battleSchema);
