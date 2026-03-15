import { PokemonType } from './enums/PokemonType';

type EffectivenessMap = Record<string, Record<string, number>>;

const SUPER_EFFECTIVE = 1.5;
const NOT_EFFECTIVE = 0.5;
const IMMUNE = 0;

const effectivenessTable: EffectivenessMap = {
  [PokemonType.WATER]: {
    [PokemonType.FIRE]: SUPER_EFFECTIVE,
    [PokemonType.GROUND]: SUPER_EFFECTIVE,
    [PokemonType.ROCK]: SUPER_EFFECTIVE,
    [PokemonType.GRASS]: NOT_EFFECTIVE,
    [PokemonType.WATER]: NOT_EFFECTIVE,
    [PokemonType.DRAGON]: NOT_EFFECTIVE,
  },
  [PokemonType.FIRE]: {
    [PokemonType.GRASS]: SUPER_EFFECTIVE,
    [PokemonType.STEEL]: SUPER_EFFECTIVE,
    [PokemonType.FIRE]: NOT_EFFECTIVE,
    [PokemonType.WATER]: NOT_EFFECTIVE,
    [PokemonType.ROCK]: NOT_EFFECTIVE,
    [PokemonType.DRAGON]: NOT_EFFECTIVE,
  },
  [PokemonType.GRASS]: {
    [PokemonType.WATER]: SUPER_EFFECTIVE,
    [PokemonType.GROUND]: SUPER_EFFECTIVE,
    [PokemonType.ROCK]: SUPER_EFFECTIVE,
    [PokemonType.FIRE]: NOT_EFFECTIVE,
    [PokemonType.GRASS]: NOT_EFFECTIVE,
    [PokemonType.POISON]: NOT_EFFECTIVE,
    [PokemonType.FLYING]: NOT_EFFECTIVE,
    [PokemonType.STEEL]: NOT_EFFECTIVE,
    [PokemonType.DRAGON]: NOT_EFFECTIVE,
  },
  [PokemonType.ELECTRIC]: {
    [PokemonType.WATER]: SUPER_EFFECTIVE,
    [PokemonType.FLYING]: SUPER_EFFECTIVE,
    [PokemonType.ELECTRIC]: NOT_EFFECTIVE,
    [PokemonType.GRASS]: NOT_EFFECTIVE,
    [PokemonType.DRAGON]: NOT_EFFECTIVE,
    [PokemonType.GROUND]: IMMUNE,
  },
  [PokemonType.FIGHTING]: {
    [PokemonType.NORMAL]: SUPER_EFFECTIVE,
    [PokemonType.ROCK]: SUPER_EFFECTIVE,
    [PokemonType.STEEL]: SUPER_EFFECTIVE,
    [PokemonType.POISON]: NOT_EFFECTIVE,
    [PokemonType.FLYING]: NOT_EFFECTIVE,
    [PokemonType.PSYCHIC]: NOT_EFFECTIVE,
    [PokemonType.FAIRY]: NOT_EFFECTIVE,
    [PokemonType.GHOST]: IMMUNE,
  },
  [PokemonType.PSYCHIC]: {
    [PokemonType.FIGHTING]: SUPER_EFFECTIVE,
    [PokemonType.POISON]: SUPER_EFFECTIVE,
    [PokemonType.PSYCHIC]: NOT_EFFECTIVE,
    [PokemonType.STEEL]: NOT_EFFECTIVE,
  },
  [PokemonType.GROUND]: {
    [PokemonType.ELECTRIC]: SUPER_EFFECTIVE,
    [PokemonType.FIRE]: SUPER_EFFECTIVE,
    [PokemonType.ROCK]: SUPER_EFFECTIVE,
    [PokemonType.POISON]: SUPER_EFFECTIVE,
    [PokemonType.STEEL]: SUPER_EFFECTIVE,
    [PokemonType.GRASS]: NOT_EFFECTIVE,
    [PokemonType.FLYING]: IMMUNE,
  },
  [PokemonType.DRAGON]: {
    [PokemonType.DRAGON]: SUPER_EFFECTIVE,
    [PokemonType.STEEL]: NOT_EFFECTIVE,
    [PokemonType.FAIRY]: IMMUNE,
  },
  [PokemonType.GHOST]: {
    [PokemonType.PSYCHIC]: SUPER_EFFECTIVE,
    [PokemonType.GHOST]: SUPER_EFFECTIVE,
    [PokemonType.NORMAL]: IMMUNE,
  },
  [PokemonType.POISON]: {
    [PokemonType.GRASS]: SUPER_EFFECTIVE,
    [PokemonType.FAIRY]: SUPER_EFFECTIVE,
    [PokemonType.POISON]: NOT_EFFECTIVE,
    [PokemonType.GROUND]: NOT_EFFECTIVE,
    [PokemonType.ROCK]: NOT_EFFECTIVE,
    [PokemonType.GHOST]: NOT_EFFECTIVE,
    [PokemonType.STEEL]: IMMUNE,
  },
  [PokemonType.FLYING]: {
    [PokemonType.GRASS]: SUPER_EFFECTIVE,
    [PokemonType.FIGHTING]: SUPER_EFFECTIVE,
    [PokemonType.ROCK]: NOT_EFFECTIVE,
    [PokemonType.ELECTRIC]: NOT_EFFECTIVE,
    [PokemonType.STEEL]: NOT_EFFECTIVE,
  },
  [PokemonType.ROCK]: {
    [PokemonType.FIRE]: SUPER_EFFECTIVE,
    [PokemonType.FLYING]: SUPER_EFFECTIVE,
    [PokemonType.FIGHTING]: NOT_EFFECTIVE,
    [PokemonType.GROUND]: NOT_EFFECTIVE,
    [PokemonType.STEEL]: NOT_EFFECTIVE,
  },
  [PokemonType.STEEL]: {
    [PokemonType.FAIRY]: SUPER_EFFECTIVE,
    [PokemonType.ROCK]: SUPER_EFFECTIVE,
    [PokemonType.FIRE]: NOT_EFFECTIVE,
    [PokemonType.WATER]: NOT_EFFECTIVE,
    [PokemonType.ELECTRIC]: NOT_EFFECTIVE,
    [PokemonType.STEEL]: NOT_EFFECTIVE,
  },
  [PokemonType.FAIRY]: {
    [PokemonType.FIGHTING]: SUPER_EFFECTIVE,
    [PokemonType.DRAGON]: SUPER_EFFECTIVE,
    [PokemonType.FIRE]: NOT_EFFECTIVE,
    [PokemonType.POISON]: NOT_EFFECTIVE,
    [PokemonType.STEEL]: NOT_EFFECTIVE,
  },
  [PokemonType.NORMAL]: {
    [PokemonType.ROCK]: NOT_EFFECTIVE,
    [PokemonType.STEEL]: NOT_EFFECTIVE,
    [PokemonType.GHOST]: IMMUNE,
  },
};

export function getTypeMultiplier(
  attackerTypes: readonly string[],
  defenderTypes: readonly string[],
): number {
  // Use the attacker's primary type for the attack.
  // Apply against ALL defender types (dual-type defense stacks).
  // Example: Grass vs Rock/Ground = Grass→Rock (0.5) × Grass→Ground (1.5) = 0.75
  const atkType = attackerTypes[0];
  if (!atkType) return 1;

  let multiplier = 1;

  for (const defType of defenderTypes) {
    const effectiveness = effectivenessTable[atkType]?.[defType];
    if (effectiveness !== undefined) {
      multiplier *= effectiveness;
    }
  }

  return multiplier;
}
