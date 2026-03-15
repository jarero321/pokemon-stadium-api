import { describe, it, expect } from 'vitest';
import {
  calculateDamage,
  applyDamage,
  determineFirstTurn,
} from '@core/operations/combat';
import {
  addPlayer,
  advanceTurn,
  finishWithWinner,
  assignTurnToPlayer,
} from '@core/operations/lobby';
import {
  assignTeam,
  switchActivePokemon,
  setStatus,
} from '@core/operations/player';
import { getTypeMultiplier } from '@core/typeEffectiveness';
import type { Pokemon } from '@core/entities/index';
import type { Lobby, Player } from '@core/entities/index';
import { LobbyStatus, PlayerStatus } from '@core/enums/index';

const makePokemon = (overrides: Partial<Pokemon> = {}): Pokemon => ({
  id: 1,
  name: 'Bulbasaur',
  type: ['Grass', 'Poison'],
  hp: 45,
  maxHp: 45,
  attack: 49,
  defense: 49,
  speed: 45,
  sprite: 'bulbasaur.gif',
  defeated: false,
  ...overrides,
});

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  nickname: 'Ash',
  playerId: 'p1',
  status: PlayerStatus.BATTLING,
  team: [makePokemon()],
  activePokemonIndex: 0,
  ...overrides,
});

const makeLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
  _id: 'lobby-1',
  status: LobbyStatus.WAITING,
  players: [],
  currentTurnIndex: null,
  battleId: null,
  winner: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Core Operations', () => {
  describe('calculateDamage', () => {
    it('should apply base formula: attack - defense, min 1', () => {
      const attacker = makePokemon({ attack: 80, type: ['Normal'] });
      const defender = makePokemon({ defense: 30, type: ['Normal'] });

      const result = calculateDamage(attacker, defender);
      expect(result.damage).toBe(50); // 80 - 30 = 50
      expect(result.typeMultiplier).toBe(1);
    });

    it('should enforce minimum damage of 1 when defense > attack', () => {
      const attacker = makePokemon({
        attack: 10,
        defense: 50,
        type: ['Normal'],
      });
      const defender = makePokemon({
        attack: 50,
        defense: 100,
        type: ['Normal'],
      });

      const result = calculateDamage(attacker, defender);
      expect(result.damage).toBeGreaterThanOrEqual(1);
    });

    it('should return 0 damage for immune type matchups', () => {
      const attacker = makePokemon({ type: ['Normal'] });
      const defender = makePokemon({ type: ['Ghost'] });

      const result = calculateDamage(attacker, defender);
      expect(result.damage).toBe(0);
      expect(result.typeMultiplier).toBe(0);
    });

    it('should apply super effective multiplier', () => {
      const attacker = makePokemon({ attack: 80, type: ['Water'] });
      const defender = makePokemon({ defense: 50, type: ['Fire'] });

      const result = calculateDamage(attacker, defender);
      // (80 - 50) * 1.5 = 45
      expect(result.damage).toBe(45);
      expect(result.typeMultiplier).toBe(1.5);
    });

    it('should apply not-very-effective multiplier', () => {
      const attacker = makePokemon({ attack: 80, type: ['Fire'] });
      const defender = makePokemon({ defense: 50, type: ['Water'] });

      const result = calculateDamage(attacker, defender);
      // (80 - 50) * 0.5 = 15
      expect(result.damage).toBe(15);
      expect(result.typeMultiplier).toBe(0.5);
    });
  });

  describe('applyDamage', () => {
    it('should reduce HP by damage amount', () => {
      const pokemon = makePokemon({ hp: 45 });
      const result = applyDamage(pokemon, 10);
      expect(result.hp).toBe(35);
      expect(result.defeated).toBe(false);
    });

    it('should set defeated when HP reaches 0', () => {
      const pokemon = makePokemon({ hp: 5 });
      const result = applyDamage(pokemon, 10);
      expect(result.hp).toBe(0);
      expect(result.defeated).toBe(true);
    });

    it('should never go below 0', () => {
      const pokemon = makePokemon({ hp: 3 });
      const result = applyDamage(pokemon, 100);
      expect(result.hp).toBe(0);
    });

    it('should return unchanged pokemon for 0 damage (immune)', () => {
      const pokemon = makePokemon({ hp: 45 });
      const result = applyDamage(pokemon, 0);
      expect(result.hp).toBe(45);
      expect(result).toBe(pokemon); // same reference
    });

    it('should throw for already defeated pokemon', () => {
      const pokemon = makePokemon({ hp: 0, defeated: true });
      expect(() => applyDamage(pokemon, 10)).toThrow('already defeated');
    });

    it('should not mutate original pokemon', () => {
      const pokemon = makePokemon({ hp: 45 });
      applyDamage(pokemon, 10);
      expect(pokemon.hp).toBe(45); // unchanged
    });
  });

  describe('determineFirstTurn', () => {
    it('should give first turn to faster pokemon', () => {
      const players = [
        makePlayer({ team: [makePokemon({ speed: 50 })] }),
        makePlayer({ team: [makePokemon({ speed: 80 })] }),
      ];
      expect(determineFirstTurn(players)).toBe(1);
    });

    it('should favor player 0 on speed tie', () => {
      const players = [
        makePlayer({ team: [makePokemon({ speed: 60 })] }),
        makePlayer({ team: [makePokemon({ speed: 60 })] }),
      ];
      expect(determineFirstTurn(players)).toBe(0);
    });
  });

  describe('getTypeMultiplier', () => {
    it('should handle dual-type defender', () => {
      // Water vs Fire/Ground = 1.5 * 1.5 = 2.25
      const multiplier = getTypeMultiplier(['Water'], ['Fire', 'Ground']);
      expect(multiplier).toBe(2.25);
    });

    it('should use only primary attacker type', () => {
      // Grass/Poison vs Rock/Ground
      // Uses only Grass: Grass->Rock = 1.5, Grass->Ground = 1.5 → 2.25
      const multiplier = getTypeMultiplier(
        ['Grass', 'Poison'],
        ['Rock', 'Ground'],
      );
      expect(multiplier).toBe(2.25);
    });

    it('should return 1 for neutral matchup', () => {
      const multiplier = getTypeMultiplier(['Normal'], ['Normal']);
      expect(multiplier).toBe(1);
    });

    it('should return 0 for immune matchup', () => {
      const multiplier = getTypeMultiplier(['Electric'], ['Ground']);
      expect(multiplier).toBe(0);
    });
  });

  describe('Lobby operations', () => {
    it('addPlayer should add player without mutating', () => {
      const lobby = makeLobby();
      const result = addPlayer(lobby, 'Ash', 'p1', PlayerStatus.JOINED);
      expect(result.players).toHaveLength(1);
      expect(lobby.players).toHaveLength(0);
    });

    it('advanceTurn should alternate', () => {
      const lobby = makeLobby({ currentTurnIndex: 0 });
      expect(advanceTurn(lobby).currentTurnIndex).toBe(1);
      expect(advanceTurn(advanceTurn(lobby)).currentTurnIndex).toBe(0);
    });

    it('assignTurnToPlayer should set specific index', () => {
      const lobby = makeLobby({ currentTurnIndex: 0 });
      expect(assignTurnToPlayer(lobby, 1).currentTurnIndex).toBe(1);
    });

    it('finishWithWinner should set FINISHED status', () => {
      const lobby = makeLobby({ status: LobbyStatus.BATTLING });
      const result = finishWithWinner(lobby, 'Ash');
      expect(result.status).toBe(LobbyStatus.FINISHED);
      expect(result.winner).toBe('Ash');
    });
  });

  describe('Player operations', () => {
    it('assignTeam should set team and reset index', () => {
      const player = makePlayer({ team: [], activePokemonIndex: 2 });
      const team = [makePokemon({ name: 'Pikachu' })];
      const result = assignTeam(player, team);
      expect(result.team).toHaveLength(1);
      expect(result.activePokemonIndex).toBe(0);
    });

    it('switchActivePokemon should update index', () => {
      const player = makePlayer({ activePokemonIndex: 0 });
      const result = switchActivePokemon(player, 2);
      expect(result.activePokemonIndex).toBe(2);
    });

    it('setStatus should not mutate original', () => {
      const player = makePlayer({ status: PlayerStatus.JOINED });
      const result = setStatus(player, PlayerStatus.READY);
      expect(result.status).toBe(PlayerStatus.READY);
      expect(player.status).toBe(PlayerStatus.JOINED);
    });
  });
});
