import mongoose, { Schema } from 'mongoose';

const battleTurnSchema = new Schema(
  {
    turnNumber: { type: Number, required: true },
    attacker: {
      nickname: { type: String, required: true },
      pokemon: { type: String, required: true },
      attack: { type: Number, required: true },
    },
    defender: {
      nickname: { type: String, required: true },
      pokemon: { type: String, required: true },
      defense: { type: Number, required: true },
      remainingHp: { type: Number, required: true },
      maxHp: { type: Number, required: true },
    },
    damage: { type: Number, required: true },
    typeMultiplier: { type: Number, required: true },
    defeated: { type: Boolean, required: true },
    nextPokemon: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const battlePokemonSchema = new Schema(
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

const battlePlayerSchema = new Schema(
  {
    nickname: { type: String, required: true },
    team: { type: [battlePokemonSchema], default: [] },
  },
  { _id: false },
);

const battleSchema = new Schema({
  players: { type: [battlePlayerSchema], required: true },
  turns: { type: [battleTurnSchema], default: [] },
  winner: { type: String, default: null },
  status: { type: String, required: true, default: 'in_progress' },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date, default: null },
});

export const BattleModel = mongoose.model('Battle', battleSchema);
