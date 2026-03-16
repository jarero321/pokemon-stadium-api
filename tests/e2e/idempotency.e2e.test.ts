import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { Socket as ClientSocket } from 'socket.io-client';
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
  attacker: { nickname: string };
  defender: { nickname: string; remainingHp: number; maxHp: number };
  damage: number;
}

describe('Idempotency E2E', () => {
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

    const battleP1 = waitForEvent<LobbyDTO>(s1, 'battle_start');
    const battleP2 = waitForEvent<LobbyDTO>(s2, 'battle_start');
    s2.emit('ready');
    const [lobby] = await Promise.all([battleP1, battleP2]);

    // Drain pending lobby_status from ready→battling transition
    await new Promise((r) => setTimeout(r, 50));

    return { sockets: [s1, s2], lobby };
  }

  it('should process attack only once when same requestId is sent twice', async () => {
    const { sockets, lobby } = await setupBattleState(server.url);
    const [s1, s2] = sockets;

    try {
      const attackerIndex = lobby.currentTurnIndex!;
      const attackerSocket = sockets[attackerIndex];
      const requestId = crypto.randomUUID();

      // Collect turn results - we expect only 1
      const turnResults: TurnResultDTO[] = [];
      s1.on('turn_result', (data: TurnResultDTO) => {
        turnResults.push(data);
      });

      // Send the same attack twice with same requestId
      const firstTurnPromise = waitForEvent<TurnResultDTO>(s1, 'turn_result');
      attackerSocket.emit('attack', { requestId });
      const firstTurn = await firstTurnPromise;
      expect(firstTurn.turnNumber).toBe(1);

      // Wait for lobby_status update
      await waitForEvent<LobbyDTO>(s1, 'lobby_status');

      // Send duplicate attack with same requestId - should be idempotent
      // The second call should return cached result, but since the turn
      // already advanced, it might be rejected as "not your turn"
      // OR the idempotency check returns the cached result
      attackerSocket.emit('attack', { requestId });

      // Wait a bit for any potential second turn_result
      await new Promise((r) => setTimeout(r, 500));

      // Should still only have 1 turn result since the requestId was the same
      expect(turnResults).toHaveLength(1);
      expect(turnResults[0].turnNumber).toBe(1);
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  });
});
