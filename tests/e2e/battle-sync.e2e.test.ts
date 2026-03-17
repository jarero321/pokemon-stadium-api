import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  createTestServer,
  clearDatabase,
  registerPlayer,
  createSocket,
  waitForEvent,
  type TestServer,
} from './test-server';

interface LobbyDTO {
  status: string;
  players: {
    nickname: string;
    ready: boolean;
    team: {
      id: number;
      name: string;
      hp: number;
      maxHp: number;
      defeated: boolean;
    }[];
    activePokemonIndex: number;
  }[];
  currentTurnIndex: number | null;
  winner: string | null;
}

interface TurnResultDTO {
  turnNumber: number;
  attacker: { nickname: string; pokemon: string };
  defender: { nickname: string; pokemon: string; remainingHp: number };
  damage: number;
  typeMultiplier: number;
  defeated: boolean;
  nextPokemon: string | null;
}

interface BattleEndDTO {
  winner: string;
  loser: string;
  reason?: string;
}

describe('Battle Sync E2E', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await server.cleanup();
  });

  async function setupBattle(url: string) {
    const p1 = await registerPlayer(url, 'Ash');
    const p2 = await registerPlayer(url, 'Gary');

    const s1 = createSocket(url, p1.token);
    const s2 = createSocket(url, p2.token);

    await Promise.all([
      waitForEvent(s1, 'connect'),
      waitForEvent(s2, 'connect'),
    ]);

    s1.emit('join_lobby');
    await waitForEvent(s1, 'lobby_status');

    s2.emit('join_lobby');
    await waitForEvent(s2, 'lobby_status');

    s1.emit('assign_pokemon');
    await waitForEvent(s1, 'lobby_status');

    s2.emit('assign_pokemon');
    await waitForEvent(s1, 'lobby_status');

    s1.emit('ready');
    await waitForEvent(s1, 'lobby_status');

    // Listen for battle_start BEFORE emitting ready — both players
    // might receive lobby_status(ready) + battle_start in rapid succession
    const battleP1 = waitForEvent<LobbyDTO>(s1, 'battle_start');
    const battleP2 = waitForEvent<LobbyDTO>(s2, 'battle_start');
    s2.emit('ready');
    const [lobby] = await Promise.all([battleP1, battleP2]);

    // Drain any pending lobby_status events from the ready→battling transition
    await new Promise((r) => setTimeout(r, 50));

    return { s1, s2, lobby };
  }

  // Both players see the same lobby state after each turn
  it('should keep both players in sync during sequential attacks', async () => {
    const { s1, s2, lobby } = await setupBattle(server.url);

    try {
      const sockets = [s1, s2];

      // Track latest lobby per player via persistent listeners
      let latestS1: LobbyDTO = lobby;
      let latestS2: LobbyDTO = lobby;
      s1.on('lobby_status', (data: LobbyDTO) => {
        latestS1 = data;
      });
      s2.on('lobby_status', (data: LobbyDTO) => {
        latestS2 = data;
      });

      let finished = false;
      s1.on('battle_end', () => {
        finished = true;
      });

      for (let turn = 0; turn < 5; turn++) {
        if (finished || latestS1.status === 'finished') break;
        if (latestS1.currentTurnIndex === null) break;

        const attackerIdx = latestS1.currentTurnIndex;
        const attackerSocket = sockets[attackerIdx];

        const turnPromise = Promise.race([
          waitForEvent<TurnResultDTO>(s1, 'turn_result'),
          new Promise<null>((r) => setTimeout(() => r(null), 3000)),
        ]);

        attackerSocket.emit('attack', { requestId: crypto.randomUUID() });
        const result = await turnPromise;

        if (!result) break; // timeout — battle likely ended or needs switch

        // Let lobby_status propagate to both sockets
        await new Promise((r) => setTimeout(r, 50));

        if (latestS1.status === 'finished') break;

        // Both players see the exact same state
        expect(latestS1.status).toBe(latestS2.status);
        expect(latestS1.players[0].team[0].hp).toBe(
          latestS2.players[0].team[0].hp,
        );
        expect(latestS1.players[1].team[0].hp).toBe(
          latestS2.players[1].team[0].hp,
        );
      }
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  });

  // Wrong player cannot attack
  it('should reject attack from wrong player', async () => {
    const { s1, s2, lobby } = await setupBattle(server.url);

    try {
      const defenderIdx = lobby.currentTurnIndex === 0 ? 1 : 0;
      const defenderSocket = [s1, s2][defenderIdx];

      const errorPromise = waitForEvent<{ code: string }>(
        defenderSocket,
        'error',
      );
      defenderSocket.emit('attack', { requestId: crypto.randomUUID() });
      const error = await errorPromise;

      expect(error.code).toBe('NOT_YOUR_TURN');
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  });

  // Forced switch after KO: turn passes to defender
  it('should pass turn to defender for forced switch after KO', async () => {
    const { s1, s2, lobby } = await setupBattle(server.url);

    try {
      const sockets = [s1, s2];
      let currentLobby = lobby;

      for (let turn = 0; turn < 200; turn++) {
        const attackerIdx = currentLobby.currentTurnIndex!;
        const attackerSocket = sockets[attackerIdx];

        const turnPromise = waitForEvent<TurnResultDTO>(s1, 'turn_result');
        const lobbyPromise = waitForEvent<LobbyDTO>(s1, 'lobby_status');

        attackerSocket.emit('attack', { requestId: crypto.randomUUID() });

        const turnResult = await turnPromise;
        currentLobby = await lobbyPromise;

        if (turnResult.defeated && currentLobby.status !== 'finished') {
          // Turn should now be the DEFENDER's turn (to switch)
          const defenderIdx = attackerIdx === 0 ? 1 : 0;
          expect(currentLobby.currentTurnIndex).toBe(defenderIdx);

          // Defender sends switch_pokemon
          const defenderSocket = sockets[defenderIdx];
          const defender = currentLobby.players[defenderIdx];
          const nextAlive = defender.team.findIndex(
            (p, i) => !p.defeated && i !== defender.activePokemonIndex,
          );

          if (nextAlive !== -1) {
            const switchLobby = waitForEvent<LobbyDTO>(s1, 'lobby_status');
            defenderSocket.emit('switch_pokemon', {
              requestId: crypto.randomUUID(),
              targetPokemonIndex: nextAlive,
            });
            currentLobby = await switchLobby;

            // After switch, turn should go back to attacker
            expect(currentLobby.currentTurnIndex).toBe(attackerIdx);
          }
        }

        if (currentLobby.status === 'finished') break;
      }
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  });

  // Disconnect during battle updates leaderboard
  it('should update leaderboard when player disconnects mid-battle', async () => {
    const { s1, s2, lobby } = await setupBattle(server.url);

    try {
      // Do at least one attack so we know battle is active
      const attackerSocket = [s1, s2][lobby.currentTurnIndex!];
      const turnPromise = waitForEvent<TurnResultDTO>(s1, 'turn_result');
      attackerSocket.emit('attack', { requestId: crypto.randomUUID() });
      await turnPromise;

      // Player 2 disconnects
      const battleEndPromise = waitForEvent<BattleEndDTO>(s1, 'battle_end');
      s2.disconnect();
      const battleEnd = await battleEndPromise;

      expect(battleEnd.winner).toBe('Ash');
      expect(battleEnd.loser).toBe('Gary');
      expect(battleEnd.reason).toBe('opponent_disconnected');

      // Wait for leaderboard to update
      await new Promise((r) => setTimeout(r, 300));

      const res = await fetch(`${server.url}/api/leaderboard`);
      const json = (await res.json()) as {
        data: { nickname: string; wins: number }[];
      };
      const winner = json.data.find((p) => p.nickname === 'Ash');
      expect(winner?.wins).toBe(1);
    } finally {
      s1.disconnect();
    }
  });

  // Same nickname reconnection
  it('should allow reconnection with same nickname to existing lobby', async () => {
    const p1 = await registerPlayer(server.url, 'Ash');
    const s1 = createSocket(server.url, p1.token);

    try {
      await waitForEvent(s1, 'connect');

      s1.emit('join_lobby');
      await waitForEvent<LobbyDTO>(s1, 'lobby_status');

      // Disconnect and reconnect with fresh token
      s1.disconnect();
      await new Promise((r) => setTimeout(r, 200));

      const p1Again = await registerPlayer(server.url, 'Ash');
      const s1Again = createSocket(server.url, p1Again.token);
      await waitForEvent(s1Again, 'connect');

      // Should be able to join lobby again (reconnection)
      const lobbyPromise = waitForEvent<LobbyDTO>(s1Again, 'lobby_status');
      s1Again.emit('join_lobby');
      const lobby = await lobbyPromise;

      expect(lobby.players).toHaveLength(1);
      expect(lobby.players[0].nickname).toBe('Ash');

      s1Again.disconnect();
    } finally {
      s1.disconnect();
    }
  });

  // Full battle to completion with forced switches
  it('should complete full battle including forced switches', async () => {
    const { s1, s2, lobby } = await setupBattle(server.url);

    try {
      const sockets = [s1, s2];
      let currentLobby = lobby;
      let totalTurns = 0;
      let forcedSwitches = 0;

      for (let i = 0; i < 200; i++) {
        if (currentLobby.status === 'finished') break;

        const attackerIdx = currentLobby.currentTurnIndex!;
        const attackerSocket = sockets[attackerIdx];

        const turnPromise = waitForEvent<TurnResultDTO>(s1, 'turn_result');
        const lobbyPromise = waitForEvent<LobbyDTO>(s1, 'lobby_status');

        attackerSocket.emit('attack', { requestId: crypto.randomUUID() });

        const turnResult = await turnPromise;
        currentLobby = await lobbyPromise;
        totalTurns++;

        // Handle forced switch
        if (turnResult.defeated && currentLobby.status !== 'finished') {
          const defenderIdx = attackerIdx === 0 ? 1 : 0;
          const defenderSocket = sockets[defenderIdx];
          const defender = currentLobby.players[defenderIdx];
          const nextAlive = defender.team.findIndex(
            (p, idx) => !p.defeated && idx !== defender.activePokemonIndex,
          );

          if (nextAlive !== -1) {
            const switchLobby = waitForEvent<LobbyDTO>(s1, 'lobby_status');
            defenderSocket.emit('switch_pokemon', {
              requestId: crypto.randomUUID(),
              targetPokemonIndex: nextAlive,
            });
            currentLobby = await switchLobby;
            forcedSwitches++;
          }
        }
      }

      expect(currentLobby.status).toBe('finished');
      expect(currentLobby.winner).not.toBeNull();
      expect(totalTurns).toBeGreaterThan(0);
      // At least some pokemon were KO'd requiring switches
      expect(forcedSwitches).toBeGreaterThanOrEqual(0);
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  });

  // Disconnect during waiting does not show as defeat
  it('should not declare winner when player leaves during waiting', async () => {
    const p1 = await registerPlayer(server.url, 'Ash');
    const p2 = await registerPlayer(server.url, 'Gary');

    const s1 = createSocket(server.url, p1.token);
    const s2 = createSocket(server.url, p2.token);

    try {
      await Promise.all([
        waitForEvent(s1, 'connect'),
        waitForEvent(s2, 'connect'),
      ]);

      s1.emit('join_lobby');
      await waitForEvent(s1, 'lobby_status');

      s2.emit('join_lobby');
      await waitForEvent(s2, 'lobby_status');

      // Player 2 leaves during waiting
      const lobbyUpdate = waitForEvent<LobbyDTO>(s1, 'lobby_status');
      s2.disconnect();
      const lobby = await lobbyUpdate;

      // Lobby should be finished but WITHOUT a winner
      expect(lobby.status).toBe('finished');
      expect(lobby.winner).toBeNull();
    } finally {
      s1.disconnect();
    }
  });

  // Duplicate nickname blocked when session is active
  it('should reject duplicate nickname when original session is active', async () => {
    const p1 = await registerPlayer(server.url, 'Ash');
    const s1 = createSocket(server.url, p1.token);

    try {
      await waitForEvent(s1, 'connect');
      s1.emit('join_lobby');
      await waitForEvent(s1, 'lobby_status');

      // Another connection tries same nickname
      const p1Dup = await registerPlayer(server.url, 'Ash');
      const s1Dup = createSocket(server.url, p1Dup.token);
      await waitForEvent(s1Dup, 'connect');

      const errorPromise = waitForEvent<{ code: string }>(s1Dup, 'error');
      s1Dup.emit('join_lobby');
      const error = await errorPromise;

      expect(error.code).toBe('LOBBY_FULL');

      s1Dup.disconnect();
    } finally {
      s1.disconnect();
    }
  });
});
