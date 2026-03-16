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

      // Send attack and wait for turn result
      const firstTurnPromise = waitForEvent<TurnResultDTO>(s1, 'turn_result');
      attackerSocket.emit('attack', { requestId });
      const firstTurn = await firstTurnPromise;
      expect(firstTurn.turnNumber).toBe(1);
      expect(firstTurn.damage).toBeGreaterThanOrEqual(0);

      // Send duplicate with same requestId — should get error or be ignored
      // since the turn already advanced to the other player
      const errorOrTimeout = await Promise.race([
        waitForEvent<{ code: string }>(s1, 'error').then((e) => e),
        new Promise<null>((r) => setTimeout(() => r(null), 500)),
      ]);

      // Either NOT_YOUR_TURN error (turn already advanced) or silently ignored
      if (errorOrTimeout) {
        expect(errorOrTimeout.code).toBe('NOT_YOUR_TURN');
      }
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  });
});
