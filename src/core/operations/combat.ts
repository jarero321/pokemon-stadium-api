import type { Pokemon } from '@core/entities/index';
import { PokemonAlreadyDefeatedError } from '@core/errors/index';

const MINIMUM_DAMAGE = 1;

export function applyDamage(pokemon: Pokemon, rawDamage: number): Pokemon {
  if (pokemon.defeated) throw new PokemonAlreadyDefeatedError(pokemon.name);
  const damage = Math.max(MINIMUM_DAMAGE, rawDamage);
  const hp = Math.max(0, pokemon.hp - damage);
  return { ...pokemon, hp, defeated: hp === 0 };
}
