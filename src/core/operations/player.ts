import type { Player } from '@core/entities/index';
import type { Pokemon } from '@core/entities/index';
import type { PlayerStatus } from '@core/enums/PlayerStatus';

export function assignTeam(player: Player, team: Pokemon[]): Player {
  return { ...player, team, activePokemonIndex: 0 };
}

export function switchActivePokemon(
  player: Player,
  targetIndex: number,
): Player {
  return { ...player, activePokemonIndex: targetIndex };
}

export function setStatus(player: Player, status: PlayerStatus): Player {
  return { ...player, status };
}

export function updatePokemonInTeam(
  player: Player,
  pokemonIndex: number,
  updatedPokemon: Pokemon,
): Player {
  const newTeam = player.team.map((p, i) =>
    i === pokemonIndex ? updatedPokemon : p,
  );
  return { ...player, team: newTeam };
}
