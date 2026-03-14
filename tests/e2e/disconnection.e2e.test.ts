import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
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
}

interface LobbyDTO {
  status: string;
  players: {
    nickname: string;
    ready: boolean;
    team: { id: number; name: string; hp: number; defeated: boolean }[];
    activePokemonIndex: number;
  }[];
  currentTurnIndex: number | null;
  winner: string | null;
}

interface BattleEndDTO {
  winner: string;
  loser: string;
  reason?: string;
}

describe('Disconnection E2E', () => {
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

  // ── Disconnect During Lobby ─────────────────────────────────

  describe('Disconnect during lobby phase', () => {
    it('should handle player disconnect while waiting for opponent', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');
      const socket = createSocket(server.url, token);

      await waitForEvent(socket, 'connect');
      socket.emit('join_lobby');
      await waitForEvent(socket, 'lobby_status');

      // Disconnect — should not crash the server
      socket.disconnect();

      // Server should still be healthy
      const json = await fetchJson<ApiResponse<{ status: string }>>(
        `${server.url}/api/health`,
      );
      expect(json.data.status).toBe('healthy');
    });

    it('should allow new lobby after both players disconnect from waiting', async () => {
      const p1 = await registerPlayer(server.url, 'Ash');
      const p2 = await registerPlayer(server.url, 'Gary');

      const s1 = createSocket(server.url, p1.token);
      const s2 = createSocket(server.url, p2.token);

      await Promise.all([
        waitForEvent(s1, 'connect'),
        waitForEvent(s2, 'connect'),
      ]);

      s1.emit('join_lobby');
      await waitForEvent(s1, 'lobby_status');

      s2.emit('join_lobby');
      await waitForEvent(s2, 'lobby_status');

      // Both disconnect
      s1.disconnect();
      s2.disconnect();

      await new Promise((r) => setTimeout(r, 300));

      // New players should be able to create a lobby
      const p3 = await registerPlayer(server.url, 'Brock');
      const s3 = createSocket(server.url, p3.token);

      try {
        await waitForEvent(s3, 'connect');
        s3.emit('join_lobby');
        const lobby = await waitForEvent<LobbyDTO>(s3, 'lobby_status');
        expect(lobby.players).toHaveLength(1);
        expect(lobby.players[0].nickname).toBe('Brock');
      } finally {
        s3.disconnect();
      }
    });
  });

  // ── Disconnect During Battle ────────────────────────────────

  describe('Disconnect during battle', () => {
    async function setupBattle(url: string) {
      const p1 = await registerPlayer(url, 'Ash');
      const p2 = await registerPlayer(url, 'Gary');

      const s1 = createSocket(url, p1.token);
      const s2 = createSocket(url, p2.token);

      await Promise.all([
        waitForEvent(s1, 'connect'),
        waitForEvent(s2, 'connect'),
      ]);

      // Join lobby
      s1.emit('join_lobby');
      await waitForEvent(s1, 'lobby_status');

      s2.emit('join_lobby');
      await waitForEvent(s2, 'lobby_status');

      // Assign pokemon
      s1.emit('assign_pokemon');
      await waitForEvent(s1, 'lobby_status');

      s2.emit('assign_pokemon');
      await waitForEvent(s1, 'lobby_status');

      // Ready up → battle starts
      s1.emit('ready');
      await waitForEvent(s1, 'lobby_status');

      const battlePromise = waitForEvent<LobbyDTO>(s1, 'battle_start');
      s2.emit('ready');
      await battlePromise;

      return { s1, s2 };
    }

    it('should declare opponent winner when a player disconnects mid-battle', async () => {
      const { s1, s2 } = await setupBattle(server.url);

      try {
        // Listen for battle_end on s1 before s2 disconnects
        const battleEndPromise = waitForEvent<BattleEndDTO>(s1, 'battle_end');

        // Player 2 (Gary) disconnects
        s2.disconnect();

        const battleEnd = await battleEndPromise;

        expect(battleEnd.winner).toBe('Ash');
        expect(battleEnd.loser).toBe('Gary');
        expect(battleEnd.reason).toBe('opponent_disconnected');
      } finally {
        s1.disconnect();
      }
    });

    it('should set lobby to FINISHED after disconnect forfeit', async () => {
      const { s1, s2 } = await setupBattle(server.url);

      try {
        const lobbyPromise = waitForEvent<LobbyDTO>(s1, 'lobby_status');

        s2.disconnect();

        const lobby = await lobbyPromise;
        expect(lobby.status).toBe('finished');
        expect(lobby.winner).toBe('Ash');
      } finally {
        s1.disconnect();
      }
    });

    it('should keep server stable after battle forfeit', async () => {
      const { s1, s2 } = await setupBattle(server.url);

      s2.disconnect();
      await waitForEvent(s1, 'battle_end');
      s1.disconnect();

      await new Promise((r) => setTimeout(r, 200));

      // Server should still be healthy
      const json = await fetchJson<ApiResponse<{ status: string }>>(
        `${server.url}/api/health`,
      );
      expect(json.data.status).toBe('healthy');
    });
  });

  // ── Reconnection Scenarios ──────────────────────────────────

  describe('Reconnection', () => {
    it('should allow reconnecting with the same token after disconnect', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');
      const socket1 = createSocket(server.url, token);

      await waitForEvent(socket1, 'connect');
      socket1.disconnect();

      // Reconnect with same token
      const socket2 = createSocket(server.url, token);

      try {
        await waitForEvent(socket2, 'connect');
        expect(socket2.connected).toBe(true);
      } finally {
        socket2.disconnect();
      }
    });

    it('should allow player to join a new lobby after reconnecting', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');

      // Connect, join lobby, disconnect
      const socket1 = createSocket(server.url, token);
      await waitForEvent(socket1, 'connect');
      socket1.emit('join_lobby');
      await waitForEvent(socket1, 'lobby_status');
      socket1.disconnect();

      await new Promise((r) => setTimeout(r, 300));

      // Reconnect and join new lobby
      const socket2 = createSocket(server.url, token);

      try {
        await waitForEvent(socket2, 'connect');
        socket2.emit('join_lobby');
        const lobby = await waitForEvent<LobbyDTO>(socket2, 'lobby_status');
        expect(lobby.players[0].nickname).toBe('Ash');
      } finally {
        socket2.disconnect();
      }
    });
  });

  // ── Rapid Connect/Disconnect ────────────────────────────────

  describe('Rapid connect/disconnect', () => {
    it('should handle rapid disconnect and reconnect without crashing', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');

      // Rapidly connect and disconnect 5 times
      for (let i = 0; i < 5; i++) {
        const socket = createSocket(server.url, token);
        await waitForEvent(socket, 'connect');
        socket.disconnect();
      }

      // Server should still work
      const socket = createSocket(server.url, token);

      try {
        await waitForEvent(socket, 'connect');
        expect(socket.connected).toBe(true);
      } finally {
        socket.disconnect();
      }
    });

    it('should handle immediate disconnect before server processes events', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');
      const socket = createSocket(server.url, token);

      // Emit join_lobby and immediately disconnect (don't await connect)
      socket.on('connect', () => {
        socket.emit('join_lobby');
        socket.disconnect();
      });

      // Wait a moment for everything to settle
      await new Promise((r) => setTimeout(r, 500));

      // Server should still be healthy
      const json = await fetchJson<ApiResponse<{ status: string }>>(
        `${server.url}/api/health`,
      );
      expect(json.data.status).toBe('healthy');
    });
  });
});
