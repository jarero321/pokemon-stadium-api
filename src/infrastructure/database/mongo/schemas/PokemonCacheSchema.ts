import mongoose, { Schema } from 'mongoose';

const pokemonCacheSchema = new Schema(
  {
    pokedexId: {
      type: Number,
      required: [true, 'Pokedex ID is required'],
      unique: true,
      index: true,
      min: [1, 'Pokedex ID must be at least 1'],
    },
    name: {
      type: String,
      required: [true, 'Pokemon name is required'],
      trim: true,
    },
    type: {
      type: [String],
      required: [true, 'Pokemon must have at least one type'],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'Pokemon must have at least one type',
      },
    },
    hp: {
      type: Number,
      required: [true, 'HP is required'],
      min: [0, 'HP cannot be negative'],
    },
    attack: {
      type: Number,
      required: [true, 'Attack is required'],
      min: [0, 'Attack cannot be negative'],
    },
    defense: {
      type: Number,
      required: [true, 'Defense is required'],
      min: [0, 'Defense cannot be negative'],
    },
    speed: {
      type: Number,
      required: [true, 'Speed is required'],
      min: [0, 'Speed cannot be negative'],
    },
    sprite: {
      type: String,
      required: [true, 'Sprite URL is required'],
    },
  },
  { timestamps: true },
);

pokemonCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

export const PokemonCacheModel = mongoose.model(
  'PokemonCache',
  pokemonCacheSchema,
);
