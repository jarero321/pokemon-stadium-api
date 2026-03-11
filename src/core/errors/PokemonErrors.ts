import { BusinessError } from './BusinessError';

export class PokemonAlreadyDefeatedError extends BusinessError {
  constructor(pokemonName: string) {
    super('POKEMON_DEFEATED', `${pokemonName} is already defeated`);
  }
}

export class InsufficientPokemonError extends BusinessError {
  constructor(available: number, required: number) {
    super(
      'INSUFFICIENT_POKEMON',
      `Not enough Pokemon available: ${available} of ${required} required`,
    );
  }
}
