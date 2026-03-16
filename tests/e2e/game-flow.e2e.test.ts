import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { Socket as ClientSocket } from 'socket.io-client';
import {
  createTestServer,
  clearDatabase,
  registerPlayer,
  createSocket,
  waitForEvent,
  fetchJson,
  type TestServer,
} from './test-server';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

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
  attacker: { nickname: string };
  defender: { nickname: string; remainingHp: number; maxHp: number };
  damage: number;
  defeated: boolean;
}

interface BattleEndDTO {
  winner: string;
  loser: string;
  battleId?: string;
}

describe('Game Flow E2E', () => {
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

  describe('REST Endpoints', () => {
    it('GET /api/health should return healthy', async () => {
      const json = await fetchJson<
        ApiResponse<{ status: string; mongo: string }>
      >(`${server.url}/api/health`);

      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.mongo).toBe('connected');
    });

    it('GET /api/pokemon should return catalog', async () => {
      const json = await fetchJson<ApiResponse<{ id: number; name: string }[]>>(
        `${server.url}/api/pokemon`,
      );

      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0]).toHaveProperty('name');
      expect(json.data[0]).toHaveProperty('id');
    });

    it('GET /api/leaderboard should return empty initially', async () => {
      const json = await fetchJson<ApiResponse<unknown[]>>(
        `${server.url}/api/leaderboard`,
      );

      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });
  });

  describe('Full Game Lifecycle', () => {
    it('should complete entire flow from registration to battle winner', async () => {
      // 1. Register both players
      const p1 = await registerPlayer(server.url, 'Ash');
      const p2 = await registerPlayer(server.url, 'Gary');

      // 2. Connect both via WebSocket
      const socket1 = createSocket(server.url, p1.token);
      const socket2 = createSocket(server.url, p2.token);

      try {
        await Promise.all([
          waitForEvent(socket1, 'connect'),
          waitForEvent(socket2, 'connect'),
        ]);

        // 3. Player 1 joins lobby
        const lobbyPromise1 = waitForEvent<LobbyDTO>(socket1, 'lobby_status');
        socket1.emit('join_lobby');
        const lobby1 = await lobbyPromise1;
        expect(lobby1.players).toHaveLength(1);
        expect(lobby1.status).toBe('waiting');

        // 4. Player 2 joins lobby
        const lobbyPromise2a = waitForEvent<LobbyDTO>(socket1, 'lobby_status');
        const lobbyPromise2b = waitForEvent<LobbyDTO>(socket2, 'lobby_status');
        socket2.emit('join_lobby');

        const [lobby2a, lobby2b] = await Promise.all([
          lobbyPromise2a,
          lobbyPromise2b,
        ]);
        expect(lobby2a.players).toHaveLength(2);
        expect(lobby2b.players).toHaveLength(2);

        // 5. Both assign pokemon
        const assignPromise1 = waitForEvent<LobbyDTO>(socket1, 'lobby_status');
        socket1.emit('assign_pokemon');
        const afterAssign1 = await assignPromise1;
        const player1Data = afterAssign1.players.find(
          (p) => p.nickname === 'Ash',
        )!;
        expect(player1Data.team).toHaveLength(3);

        const assignPromise2 = waitForEvent<LobbyDTO>(socket1, 'lobby_status');
        socket2.emit('assign_pokemon');
        const afterAssign2 = await assignPromise2;
        const player2Data = afterAssign2.players.find(
          (p) => p.nickname === 'Gary',
        )!;
        expect(player2Data.team).toHaveLength(3);

        // Verify no overlapping pokemon
        const p1Ids = player1Data.team.map((p) => p.id);
        const p2Ids = player2Data.team.map((p) => p.id);
        const overlap = p1Ids.filter((id) => p2Ids.includes(id));
        expect(overlap).toHaveLength(0);

        // 6. Both ready → battle starts
        const readyPromise1 = waitForEvent<LobbyDTO>(socket1, 'lobby_status');
        socket1.emit('ready');
        await readyPromise1;

        const battleStartP1 = waitForEvent<LobbyDTO>(socket1, 'battle_start');
        const battleStartP2 = waitForEvent<LobbyDTO>(socket2, 'battle_start');
        socket2.emit('ready');
        const [battleLobby] = await Promise.all([battleStartP1, battleStartP2]);

        expect(battleLobby.status).toBe('battling');
        expect(battleLobby.currentTurnIndex).not.toBeNull();

        // Drain any pending lobby_status from ready→battling transition
        await new Promise((r) => setTimeout(r, 50));

        // 7. Battle until someone wins — use lobby_status to track state
        const sockets = [socket1, socket2];
        const nicknames = ['Ash', 'Gary'];
        let battleEnd: BattleEndDTO | null = null;

        // Track latest lobby state via persistent listener
        let latestLobby = battleLobby;
        socket1.on('lobby_status', (data: LobbyDTO) => {
          latestLobby = data;
        });

        // Listen for battle_end globally
        const battleEndGlobal = new Promise<BattleEndDTO>((resolve) => {
          socket1.once('battle_end', resolve);
        });

        for (let i = 0; i < 200; i++) {
          // Wait for latestLobby to reflect current state
          await new Promise((r) => setTimeout(r, 30));

          if (latestLobby.status === 'finished') break;
          if (latestLobby.currentTurnIndex === null) break;

          const attackerIdx = latestLobby.currentTurnIndex;
          const attackerSocket = sockets[attackerIdx];

          const turnPromise = waitForEvent<TurnResultDTO>(
            socket1,
            'turn_result',
          );

          attackerSocket.emit('attack', {
            requestId: crypto.randomUUID(),
          });

          const turnResult = await turnPromise;
          expect(turnResult.damage).toBeGreaterThanOrEqual(0);

          if (turnResult.defeated) {
            // Wait to see if battle ends or needs forced switch
            const endOrTimeout = await Promise.race([
              battleEndGlobal.then((d) => ({ type: 'end' as const, data: d })),
              new Promise<{ type: 'timeout' }>((r) =>
                setTimeout(() => r({ type: 'timeout' }), 300),
              ),
            ]);

            if (endOrTimeout.type === 'end') {
              battleEnd = endOrTimeout.data;
              break;
            }

            // Forced switch needed — find alive pokemon for defender
            const defenderIdx = latestLobby.currentTurnIndex!;
            const defender = latestLobby.players[defenderIdx];
            const nextAlive = defender?.team.findIndex(
              (p, idx) => !p.defeated && idx !== defender.activePokemonIndex,
            );

            if (nextAlive !== undefined && nextAlive !== -1) {
              sockets[defenderIdx].emit('switch_pokemon', {
                requestId: crypto.randomUUID(),
                targetPokemonIndex: nextAlive,
              });
              // Wait for lobby to update after switch
              await new Promise((r) => setTimeout(r, 100));
            }
          } else {
            // Wait for lobby_status to update turn
            await new Promise((r) => setTimeout(r, 30));
          }
        }

        // 8. Verify battle ended with a winner
        if (!battleEnd) {
          battleEnd = await battleEndGlobal;
        }
        expect(nicknames).toContain(battleEnd.winner);
        expect(nicknames).toContain(battleEnd.loser);
        expect(battleEnd.winner).not.toBe(battleEnd.loser);

        // 9. Verify leaderboard updated
        // Small delay to let event listeners process
        await new Promise((r) => setTimeout(r, 200));

        const leaderboardJson = await fetchJson<
          ApiResponse<{ nickname: string; wins: number }[]>
        >(`${server.url}/api/leaderboard`);
        expect(leaderboardJson.data.length).toBeGreaterThan(0);

        const winnerStats = leaderboardJson.data.find(
          (p) => p.nickname === battleEnd!.winner,
        );
        expect(winnerStats!.wins).toBe(1);

        // 10. Verify player history (requires auth)
        const winnerToken = battleEnd!.winner === 'Ash' ? p1.token : p2.token;
        const historyJson = await fetchJson<
          ApiResponse<{ stats: { wins: number }; battles: unknown[] }>
        >(`${server.url}/api/players/${battleEnd!.winner}/history`, {
          headers: { Authorization: `Bearer ${winnerToken}` },
        });
        expect(historyJson.data.stats.wins).toBe(1);
        expect(historyJson.data.battles.length).toBe(1);
      } finally {
        socket1.disconnect();
        socket2.disconnect();
      }
    });

    it('should reject join_lobby from already joined socket', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');
      const socket = createSocket(server.url, token);

      try {
        await waitForEvent(socket, 'connect');

        socket.emit('join_lobby');
        await waitForEvent(socket, 'lobby_status');

        // Try joining again
        const errorPromise = waitForEvent<{ code: string }>(socket, 'error');
        socket.emit('join_lobby');
        const error = await errorPromise;

        expect(error.code).toBe('ALREADY_JOINED');
      } finally {
        socket.disconnect();
      }
    });

    it('should reject third player from joining full lobby', async () => {
      const p1 = await registerPlayer(server.url, 'Ash');
      const p2 = await registerPlayer(server.url, 'Gary');
      const p3 = await registerPlayer(server.url, 'Brock');

      const s1 = createSocket(server.url, p1.token);
      const s2 = createSocket(server.url, p2.token);
      const s3 = createSocket(server.url, p3.token);

      try {
        await Promise.all([
          waitForEvent(s1, 'connect'),
          waitForEvent(s2, 'connect'),
          waitForEvent(s3, 'connect'),
        ]);

        s1.emit('join_lobby');
        await waitForEvent(s1, 'lobby_status');

        s2.emit('join_lobby');
        await waitForEvent(s2, 'lobby_status');

        // Third player should get an error
        const errorPromise = waitForEvent<{ code: string; message: string }>(
          s3,
          'error',
        );
        s3.emit('join_lobby');
        const error = await errorPromise;

        expect(error.code).toBe('LOBBY_FULL');
      } finally {
        s1.disconnect();
        s2.disconnect();
        s3.disconnect();
      }
    });
  });

  describe('Pokemon Switch', () => {
    async function setupBattleState(
      url: string,
    ): Promise<{ sockets: ClientSocket[]; lobby: LobbyDTO }> {
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

      const battlePromise = waitForEvent<LobbyDTO>(s1, 'battle_start');
      s2.emit('ready');
      const lobby = await battlePromise;

      return { sockets: [s1, s2], lobby };
    }

    it('should allow switching pokemon during your turn', async () => {
      const { sockets, lobby } = await setupBattleState(server.url);
      const [s1, s2] = sockets;

      try {
        const attackerIndex = lobby.currentTurnIndex!;
        const attackerSocket = sockets[attackerIndex];

        const switchPromise = waitForEvent<{
          player: string;
          previousPokemon: string;
          newPokemon: string;
        }>(s1, 'pokemon_switch');

        attackerSocket.emit('switch_pokemon', {
          requestId: crypto.randomUUID(),
          targetPokemonIndex: 1,
        });
        const switchResult = await switchPromise;

        expect(switchResult.player).toBeDefined();
        expect(switchResult.previousPokemon).toBeDefined();
        expect(switchResult.newPokemon).toBeDefined();
        expect(switchResult.previousPokemon).not.toBe(switchResult.newPokemon);
      } finally {
        s1.disconnect();
        s2.disconnect();
      }
    });
  });
});
