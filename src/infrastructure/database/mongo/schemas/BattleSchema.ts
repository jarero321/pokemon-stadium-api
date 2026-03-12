import mongoose, { Schema } from 'mongoose';
import { BattleStatus } from '@core/enums/index';
import { pokemonSchema } from './subdocuments/pokemonSchema';

const battleTurnSchema = new Schema(
  {
    turnNumber: {
      type: Number,
      required: [true, 'Turn number is required'],
      min: [1, 'Turn number must be at least 1'],
    },
    attacker: {
      nickname: {
        type: String,
        required: [true, 'Attacker nickname is required'],
      },
      pokemon: {
        type: String,
        required: [true, 'Attacker pokemon name is required'],
      },
      attack: {
        type: Number,
        required: [true, 'Attacker attack stat is required'],
        min: [0, 'Attack stat cannot be negative'],
      },
    },
    defender: {
      nickname: {
        type: String,
        required: [true, 'Defender nickname is required'],
      },
      pokemon: {
        type: String,
        required: [true, 'Defender pokemon name is required'],
      },
      defense: {
        type: Number,
        required: [true, 'Defender defense stat is required'],
        min: [0, 'Defense stat cannot be negative'],
      },
      remainingHp: {
        type: Number,
        required: [true, 'Remaining HP is required'],
        min: [0, 'Remaining HP cannot be negative'],
      },
      maxHp: {
        type: Number,
        required: [true, 'Max HP is required'],
        min: [1, 'Max HP must be at least 1'],
      },
    },
    damage: {
      type: Number,
      required: [true, 'Damage is required'],
      min: [0, 'Damage cannot be negative'],
    },
    typeMultiplier: {
      type: Number,
      required: [true, 'Type multiplier is required'],
      min: [0, 'Type multiplier cannot be negative'],
    },
    defeated: {
      type: Boolean,
      required: [true, 'Defeated flag is required'],
    },
    nextPokemon: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const battlePlayerSchema = new Schema(
  {
    nickname: {
      type: String,
      required: [true, 'Player nickname is required'],
      trim: true,
    },
    team: {
      type: [pokemonSchema],
      default: [],
    },
  },
  { _id: false },
);

const battleSchema = new Schema({
  players: {
    type: [battlePlayerSchema],
    required: [true, 'Battle must have players'],
  },
  turns: {
    type: [battleTurnSchema],
    default: [],
  },
  winner: { type: String, default: null },
  status: {
    type: String,
    required: [true, 'Battle status is required'],
    default: BattleStatus.IN_PROGRESS,
    enum: {
      values: Object.values(BattleStatus),
      message: '{VALUE} is not a valid battle status',
    },
    index: true,
  },
  startedAt: { type: Date, default: Date.now, index: true },
  finishedAt: { type: Date, default: null },
});

battleSchema.index({ 'players.nickname': 1, startedAt: -1 });

export const BattleModel = mongoose.model('Battle', battleSchema);
