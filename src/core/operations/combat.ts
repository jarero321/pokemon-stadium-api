import type { Pokemon } from '@core/entities/index';
import type { Player } from '@core/entities/index';
import { PokemonAlreadyDefeatedError } from '@core/errors/index';
import { getTypeMultiplier } from '@core/typeEffectiveness';

const MINIMUM_DAMAGE = 1;

export interface DamageResult {
  readonly damage: number;
  readonly typeMultiplier: number;
}

/**
 * Calculate damage using the formula:
 *   baseDamage = max(1, attack - defense)
 *   finalDamage = floor(baseDamage * typeMultiplier)
 *
 * If type is IMMUNE (0x), damage is 0.
 * Otherwise, minimum damage is 1.
 */
export function calculateDamage(
  attacker: Pokemon,
  defender: Pokemon,
): DamageResult {
  const typeMultiplier = getTypeMultiplier(attacker.type, defender.type);

  if (typeMultiplier === 0) {
    return { damage: 0, typeMultiplier };
  }

  const baseDamage = Math.max(
    MINIMUM_DAMAGE,
    attacker.attack - defender.defense,
  );
  const damage = Math.max(
    MINIMUM_DAMAGE,
    Math.floor(baseDamage * typeMultiplier),
  );

  return { damage, typeMultiplier };
}

/**
 * Apply damage to a Pokemon, returning a new Pokemon with updated HP.
 * Throws if the Pokemon is already defeated.
 * Damage of 0 (immune) returns the Pokemon unchanged.
 */
export function applyDamage(pokemon: Pokemon, damage: number): Pokemon {
  if (pokemon.defeated) throw new PokemonAlreadyDefeatedError(pokemon.name);
  if (damage === 0) return pokemon;
  const hp = Math.max(0, pokemon.hp - damage);
  return { ...pokemon, hp, defeated: hp === 0 };
}

/**
 * Determine which player attacks first based on active Pokemon speed.
 * Higher speed goes first. Ties favor player at index 0.
 */
export function determineFirstTurn(players: readonly Player[]): number {
  const speed0 = players[0].team[0].speed;
  const speed1 = players[1].team[0].speed;
  return speed0 >= speed1 ? 0 : 1;
}
