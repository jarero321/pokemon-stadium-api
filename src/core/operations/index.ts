export { applyDamage, calculateDamage, determineFirstTurn } from './combat';
export type { DamageResult } from './combat';
export {
  addPlayer,
  updatePlayer,
  advanceTurn,
  finishWithWinner,
  startBattle,
  setLobbyStatus,
  assignTurnToPlayer,
} from './lobby';
export {
  assignTeam,
  switchActivePokemon,
  setStatus,
  updatePokemonInTeam,
} from './player';
