import mongoose, { Schema } from 'mongoose';
import { LobbyStatus } from '@core/enums/index';
import { PlayerStatus } from '@core/enums/index';
import { pokemonSchema } from './subdocuments/pokemonSchema';

const playerSchema = new Schema(
  {
    nickname: {
      type: String,
      required: [true, 'Player nickname is required'],
      trim: true,
      minlength: [1, 'Nickname must be at least 1 character'],
      maxlength: [20, 'Nickname cannot exceed 20 characters'],
    },
    playerId: {
      type: String,
      required: [true, 'Player ID is required'],
    },
    status: {
      type: String,
      required: [true, 'Player status is required'],
      enum: {
        values: Object.values(PlayerStatus),
        message: '{VALUE} is not a valid player status',
      },
    },
    team: {
      type: [pokemonSchema],
      default: [],
      validate: {
        validator: (v: unknown[]) => v.length <= 3,
        message: 'A player cannot have more than 3 Pokémon in their team',
      },
    },
    activePokemonIndex: {
      type: Number,
      default: 0,
      min: [0, 'Active Pokémon index cannot be negative'],
      max: [2, 'Active Pokémon index cannot exceed 2'],
    },
  },
  { _id: false },
);

const lobbySchema = new Schema(
  {
    status: {
      type: String,
      required: [true, 'Lobby status is required'],
      default: LobbyStatus.WAITING,
      enum: {
        values: Object.values(LobbyStatus),
        message: '{VALUE} is not a valid lobby status',
      },
      index: true,
    },
    players: {
      type: [playerSchema],
      default: [],
      validate: {
        validator: (v: unknown[]) => v.length <= 2,
        message: 'A lobby cannot have more than 2 players',
      },
    },
    currentTurnIndex: {
      type: Number,
      default: null,
      min: [0, 'Turn index cannot be negative'],
      max: [1, 'Turn index cannot exceed 1'],
    },
    battleId: { type: String, default: null },
    winner: { type: String, default: null },
  },
  { timestamps: true },
);

export const LobbyModel = mongoose.model('Lobby', lobbySchema);
