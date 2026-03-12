import { describe, it, expect, beforeEach } from 'vitest';
import { JoinLobby } from '@application/use-cases/JoinLobby';
import { AssignPokemon } from '@application/use-cases/AssignPokemon';
import { PlayerReady } from '@application/use-cases/PlayerReady';
import { ExecuteAttack } from '@application/use-cases/ExecuteAttack';
import { SwitchPokemon } from '@application/use-cases/SwitchPokemon';
import { LobbyStatus, PlayerStatus } from '@core/enums/index';
import {
  LobbyFullError,
  PlayerAlreadyInLobbyError,
  NotYourTurnError,
  InvalidSwitchError,
} from '@core/errors/index';
import {
  FakeLobbyRepository,
  FakeBattleRepository,
  FakePokemonApiService,
  FakeEventBus,
  FakeTurnLock,
  SilentLogger,
} from './fakes/index';

describe('Battle Flow - Full game lifecycle', () => {
  let lobbyRepo: FakeLobbyRepository;
  let battleRepo: FakeBattleRepository;
  let pokemonApi: FakePokemonApiService;
  let eventBus: FakeEventBus;
  let turnLock: FakeTurnLock;
  let logger: SilentLogger;

  let joinLobby: JoinLobby;
  let assignPokemon: AssignPokemon;
  let playerReady: PlayerReady;
  let executeAttack: ExecuteAttack;
  let switchPokemon: SwitchPokemon;

  beforeEach(() => {
    lobbyRepo = new FakeLobbyRepository();
    battleRepo = new FakeBattleRepository();
    pokemonApi = new FakePokemonApiService();
    eventBus = new FakeEventBus();
    turnLock = new FakeTurnLock();
    logger = new SilentLogger();

    joinLobby = new JoinLobby(lobbyRepo, logger);
    assignPokemon = new AssignPokemon(lobbyRepo, pokemonApi, logger);
    playerReady = new PlayerReady(lobbyRepo, battleRepo, logger);
    executeAttack = new ExecuteAttack(
      lobbyRepo,
      battleRepo,
      turnLock,
      eventBus,
      logger,
    );
    switchPokemon = new SwitchPokemon(lobbyRepo, turnLock, logger);
  });

  // ─── JOIN LOBBY ───────────────────────────────────────────────────

  describe('JoinLobby', () => {
    it('should create a new lobby when none exists', async () => {
      const lobby = await joinLobby.execute('Ash', 'player-1');

      expect(lobby._id).toBeDefined();
      expect(lobby.status).toBe(LobbyStatus.WAITING);
      expect(lobby.players).toHaveLength(1);
      expect(lobby.players[0].nickname).toBe('Ash');
      expect(lobby.players[0].status).toBe(PlayerStatus.JOINED);
    });

    it('should add second player to existing lobby', async () => {
      await joinLobby.execute('Ash', 'player-1');
      const lobby = await joinLobby.execute('Gary', 'player-2');

      expect(lobby.players).toHaveLength(2);
      expect(lobby.players[1].nickname).toBe('Gary');
    });

    it('should reject third player', async () => {
      await joinLobby.execute('Ash', 'player-1');
      await joinLobby.execute('Gary', 'player-2');

      await expect(joinLobby.execute('Brock', 'player-3')).rejects.toThrowError(
        LobbyFullError,
      );
    });

    it('should reject duplicate nickname', async () => {
      await joinLobby.execute('Ash', 'player-1');

      await expect(joinLobby.execute('Ash', 'player-2')).rejects.toThrowError(
        PlayerAlreadyInLobbyError,
      );
    });
  });

  // ─── ASSIGN POKEMON ───────────────────────────────────────────────

  describe('AssignPokemon', () => {
    it('should assign 3 random pokemon to a player', async () => {
      await joinLobby.execute('Ash', 'player-1');
      const lobby = await assignPokemon.execute('player-1');

      const player = lobby.players[0];
      expect(player.team).toHaveLength(3);
      expect(player.status).toBe(PlayerStatus.TEAM_ASSIGNED);
      expect(player.activePokemonIndex).toBe(0);

      for (const pokemon of player.team) {
        expect(pokemon.hp).toBeGreaterThan(0);
        expect(pokemon.maxHp).toBe(pokemon.hp);
        expect(pokemon.defeated).toBe(false);
      }
    });

    it('should not repeat pokemon between players', async () => {
      await joinLobby.execute('Ash', 'player-1');
      await joinLobby.execute('Gary', 'player-2');
      await assignPokemon.execute('player-1');
      const lobby = await assignPokemon.execute('player-2');

      const firstPlayerIds = lobby.players[0].team.map((pokemon) => pokemon.id);
      const secondPlayerIds = lobby.players[1].team.map(
        (pokemon) => pokemon.id,
      );
      const overlapping = firstPlayerIds.filter((id) =>
        secondPlayerIds.includes(id),
      );

      expect(overlapping).toHaveLength(0);
    });
  });

  // ─── PLAYER READY ─────────────────────────────────────────────────

  describe('PlayerReady', () => {
    it('should mark player as ready without starting battle if alone', async () => {
      await joinLobby.execute('Ash', 'player-1');
      await joinLobby.execute('Gary', 'player-2');
      await assignPokemon.execute('player-1');
      await assignPokemon.execute('player-2');

      const result = await playerReady.execute('player-1');

      expect(result.battleStarted).toBe(false);
      const player = result.lobby.players.find(
        (player) => player.nickname === 'Ash',
      );
      expect(player!.status).toBe(PlayerStatus.READY);
    });

    it('should transition through READY state and start battle when both players are ready', async () => {
      await joinLobby.execute('Ash', 'player-1');
      await joinLobby.execute('Gary', 'player-2');
      await assignPokemon.execute('player-1');
      await assignPokemon.execute('player-2');
      await playerReady.execute('player-1');
      const result = await playerReady.execute('player-2');

      expect(result.readyLobby).not.toBeNull();
      expect(result.readyLobby!.status).toBe(LobbyStatus.READY);

      expect(result.battleStarted).toBe(true);
      expect(result.lobby.status).toBe(LobbyStatus.BATTLING);
      expect(result.lobby.battleId).toBeDefined();
      expect(result.lobby.currentTurnIndex).not.toBeNull();

      for (const player of result.lobby.players) {
        expect(player.status).toBe(PlayerStatus.BATTLING);
      }
    });

    it('should assign first turn to pokemon with highest speed', async () => {
      await joinLobby.execute('Ash', 'player-1');
      await joinLobby.execute('Gary', 'player-2');
      await assignPokemon.execute('player-1');
      await assignPokemon.execute('player-2');
      await playerReady.execute('player-1');
      const result = await playerReady.execute('player-2');

      const firstPlayerSpeed = result.lobby.players[0].team[0].speed;
      const secondPlayerSpeed = result.lobby.players[1].team[0].speed;
      const expectedIndex = firstPlayerSpeed >= secondPlayerSpeed ? 0 : 1;

      expect(result.lobby.currentTurnIndex).toBe(expectedIndex);
    });
  });

  // ─── EXECUTE ATTACK ───────────────────────────────────────────────

  describe('ExecuteAttack', () => {
    async function setupBattle() {
      await joinLobby.execute('Ash', 'player-1');
      await joinLobby.execute('Gary', 'player-2');
      await assignPokemon.execute('player-1');
      await assignPokemon.execute('player-2');
      await playerReady.execute('player-1');
      const { lobby } = await playerReady.execute('player-2');
      return lobby;
    }

    function getActivePlayerId(lobby: {
      players: { playerId: string }[];
      currentTurnIndex: number | null;
    }) {
      return lobby.players[lobby.currentTurnIndex!].playerId;
    }

    it('should process an attack and deal damage', async () => {
      const lobby = await setupBattle();
      const attackerId = getActivePlayerId(lobby);

      const result = await executeAttack.execute(attackerId);

      expect(result.turnResult.turnNumber).toBe(1);
      expect(result.turnResult.damage).toBeGreaterThanOrEqual(1);
      expect(result.turnResult.defender.remainingHp).toBeLessThan(
        result.turnResult.defender.maxHp,
      );
      expect(result.battleEnded).toBe(false);
    });

    it('should alternate turns after attack', async () => {
      const lobby = await setupBattle();
      const firstTurnIndex = lobby.currentTurnIndex!;
      const attackerId = lobby.players[firstTurnIndex].playerId;

      const result = await executeAttack.execute(attackerId);

      const expectedNext = firstTurnIndex === 0 ? 1 : 0;
      expect(result.lobby.currentTurnIndex).toBe(expectedNext);
    });

    it('should reject attack from wrong player', async () => {
      const lobby = await setupBattle();
      const defenderIndex = lobby.currentTurnIndex === 0 ? 1 : 0;
      const defenderId = lobby.players[defenderIndex].playerId;

      await expect(executeAttack.execute(defenderId)).rejects.toThrowError(
        NotYourTurnError,
      );
    });

    it('should apply minimum damage of 1', async () => {
      const lobby = await setupBattle();
      const attackerId = getActivePlayerId(lobby);

      const result = await executeAttack.execute(attackerId);
      expect(result.turnResult.damage).toBeGreaterThanOrEqual(1);
    });

    it('should emit pokemonDefeated when HP reaches 0', async () => {
      await setupBattle();

      let defeated = false;
      let pokemonDefeatedDTO = null;

      for (let i = 0; i < 200 && !defeated; i++) {
        const currentLobby = await lobbyRepo.findActive();
        const attackerId = getActivePlayerId(currentLobby!);
        const result = await executeAttack.execute(attackerId);

        if (result.pokemonDefeated) {
          defeated = true;
          pokemonDefeatedDTO = result.pokemonDefeated;
        }

        if (result.battleEnded) break;
      }

      expect(defeated).toBe(true);
      expect(pokemonDefeatedDTO).not.toBeNull();
      expect(pokemonDefeatedDTO!.owner).toBeDefined();
      expect(pokemonDefeatedDTO!.pokemon).toBeDefined();
      expect(pokemonDefeatedDTO!.defeatedBy).toBeDefined();
      expect(pokemonDefeatedDTO!.remainingTeam).toBeDefined();
    });

    it('should emit pokemonSwitch when defeated pokemon has backup', async () => {
      await setupBattle();

      let switchDTO = null;

      for (let i = 0; i < 200; i++) {
        const currentLobby = await lobbyRepo.findActive();
        if (!currentLobby || currentLobby.status === LobbyStatus.FINISHED)
          break;

        const attackerId = getActivePlayerId(currentLobby);
        const result = await executeAttack.execute(attackerId);

        if (result.pokemonSwitch) {
          switchDTO = result.pokemonSwitch;
          break;
        }

        if (result.battleEnded) break;
      }

      expect(switchDTO).not.toBeNull();
      expect(switchDTO!.player).toBeDefined();
      expect(switchDTO!.previousPokemon).toBeDefined();
      expect(switchDTO!.newPokemon).toBeDefined();
      expect(switchDTO!.newPokemonHp).toBeGreaterThan(0);
    });

    it('should end battle when all pokemon are defeated', async () => {
      await setupBattle();

      let battleEnded = false;
      let winner: string | null = null;

      for (let i = 0; i < 200; i++) {
        const currentLobby = await lobbyRepo.findActive();
        if (!currentLobby || currentLobby.status === LobbyStatus.FINISHED)
          break;

        const attackerId = getActivePlayerId(currentLobby);
        const result = await executeAttack.execute(attackerId);

        if (result.battleEnded) {
          battleEnded = true;
          winner = result.winner;
          break;
        }
      }

      expect(battleEnded).toBe(true);
      expect(winner).toBeDefined();
      expect(winner).not.toBeNull();
    });

    it('should emit BattleFinishedEvent when battle ends', async () => {
      await setupBattle();

      for (let i = 0; i < 200; i++) {
        const currentLobby = await lobbyRepo.findActive();
        if (!currentLobby || currentLobby.status === LobbyStatus.FINISHED)
          break;

        const attackerId = getActivePlayerId(currentLobby);
        const result = await executeAttack.execute(attackerId);
        if (result.battleEnded) break;
      }

      expect(eventBus.emitted).toHaveLength(1);
      expect(eventBus.emitted[0].name).toBe('BattleFinished');
    });

    it('should set lobby to FINISHED when battle ends', async () => {
      await setupBattle();

      for (let i = 0; i < 200; i++) {
        const currentLobby = await lobbyRepo.findActive();
        if (!currentLobby || currentLobby.status === LobbyStatus.FINISHED)
          break;

        const attackerId = getActivePlayerId(currentLobby);
        await executeAttack.execute(attackerId);
      }

      const activeLobby = await lobbyRepo.findActive();
      expect(activeLobby).toBeNull();
    });

    it('should never allow HP below 0', async () => {
      await setupBattle();

      for (let i = 0; i < 200; i++) {
        const currentLobby = await lobbyRepo.findActive();
        if (!currentLobby || currentLobby.status === LobbyStatus.FINISHED)
          break;

        const attackerId = getActivePlayerId(currentLobby);
        const result = await executeAttack.execute(attackerId);

        expect(result.turnResult.defender.remainingHp).toBeGreaterThanOrEqual(
          0,
        );
        if (result.battleEnded) break;
      }
    });
  });

  // ─── SWITCH POKEMON ───────────────────────────────────────────────

  describe('SwitchPokemon', () => {
    async function setupBattle() {
      await joinLobby.execute('Ash', 'player-1');
      await joinLobby.execute('Gary', 'player-2');
      await assignPokemon.execute('player-1');
      await assignPokemon.execute('player-2');
      await playerReady.execute('player-1');
      const { lobby } = await playerReady.execute('player-2');
      return lobby;
    }

    it('should allow switching to another alive pokemon', async () => {
      const lobby = await setupBattle();
      const activePlayerId = lobby.players[lobby.currentTurnIndex!].playerId;

      const result = await switchPokemon.execute(activePlayerId, 1);

      const player = result.players.find(
        (player) => player.playerId === activePlayerId,
      );
      expect(player!.activePokemonIndex).toBe(1);
    });

    it('should consume turn when switching', async () => {
      const lobby = await setupBattle();
      const firstTurnIndex = lobby.currentTurnIndex!;
      const activePlayerId = lobby.players[firstTurnIndex].playerId;

      const result = await switchPokemon.execute(activePlayerId, 1);

      const expectedNext = firstTurnIndex === 0 ? 1 : 0;
      expect(result.currentTurnIndex).toBe(expectedNext);
    });

    it('should reject switching to same pokemon', async () => {
      const lobby = await setupBattle();
      const activePlayerId = lobby.players[lobby.currentTurnIndex!].playerId;

      await expect(
        switchPokemon.execute(activePlayerId, 0),
      ).rejects.toThrowError(InvalidSwitchError);
    });

    it('should reject switching when not your turn', async () => {
      const lobby = await setupBattle();
      const defenderIndex = lobby.currentTurnIndex === 0 ? 1 : 0;
      const defenderId = lobby.players[defenderIndex].playerId;

      await expect(switchPokemon.execute(defenderId, 1)).rejects.toThrowError(
        NotYourTurnError,
      );
    });

    it('should reject switching to invalid index', async () => {
      const lobby = await setupBattle();
      const activePlayerId = lobby.players[lobby.currentTurnIndex!].playerId;

      await expect(
        switchPokemon.execute(activePlayerId, 99),
      ).rejects.toThrowError(InvalidSwitchError);
    });
  });

  // ─── FULL GAME INTEGRATION ────────────────────────────────────────

  describe('Full Game Integration', () => {
    it('should complete entire game flow from join to winner', async () => {
      // 1. Both players join
      const lobby1 = await joinLobby.execute('Ash', 'player-1');
      expect(lobby1.players).toHaveLength(1);

      const lobby2 = await joinLobby.execute('Gary', 'player-2');
      expect(lobby2.players).toHaveLength(2);

      // 2. Both players get pokemon
      await assignPokemon.execute('player-1');
      await assignPokemon.execute('player-2');

      // 3. Both players ready → battle starts
      await playerReady.execute('player-1');
      const readyResult = await playerReady.execute('player-2');
      expect(readyResult.battleStarted).toBe(true);

      // 4. Battle until winner
      let winner: string | null = null;
      let totalTurns = 0;
      const defeatedPokemon: string[] = [];
      const switchedPokemon: string[] = [];

      for (let i = 0; i < 200; i++) {
        const currentLobby = await lobbyRepo.findActive();
        if (!currentLobby || currentLobby.status === LobbyStatus.FINISHED)
          break;

        const attackerId =
          currentLobby.players[currentLobby.currentTurnIndex!].playerId;
        const result = await executeAttack.execute(attackerId);
        totalTurns++;

        if (result.pokemonDefeated) {
          defeatedPokemon.push(result.pokemonDefeated.pokemon);
        }

        if (result.pokemonSwitch) {
          switchedPokemon.push(result.pokemonSwitch.newPokemon);
        }

        if (result.battleEnded) {
          winner = result.winner;
          break;
        }
      }

      // 5. Verify final state
      expect(winner).not.toBeNull();
      expect(totalTurns).toBeGreaterThan(0);
      expect(defeatedPokemon.length).toBeGreaterThanOrEqual(3);
      expect(eventBus.emitted[0].name).toBe('BattleFinished');

      // Verify battle was persisted
      const battle = await battleRepo.findById(readyResult.lobby.battleId!);
      expect(battle).not.toBeNull();
      expect(battle!.winner).toBe(winner);
      expect(battle!.status).toBe('finished');
      expect(battle!.turns).toHaveLength(totalTurns);
    });
  });
});
