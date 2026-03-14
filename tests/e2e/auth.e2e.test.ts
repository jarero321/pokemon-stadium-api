import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  createTestServer,
  clearDatabase,
  registerPlayer,
  createSocket,
  createSocketWithoutAuth,
  waitForEvent,
  fetchJson,
  type TestServer,
} from './test-server';

describe('Auth E2E', () => {
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

  // ── HTTP Registration ───────────────────────────────────────

  describe('POST /api/players/register', () => {
    it('should return a JWT token for a new player', async () => {
      const result = await registerPlayer(server.url, 'Ash');

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // JWT has 3 parts
      expect(result.isNewPlayer).toBe(true);
      expect(result.player.nickname).toBe('Ash');
      expect(result.player.wins).toBe(0);
    });

    it('should return a new token for returning player', async () => {
      await registerPlayer(server.url, 'Ash');
      const second = await registerPlayer(server.url, 'Ash');

      expect(second.isNewPlayer).toBe(false);
      expect(second.token).toBeDefined();
      expect(second.player.nickname).toBe('Ash');
      // Tokens may differ (different iat)
    });

    it('should reject invalid nicknames', async () => {
      const json = await fetchJson<{ success: boolean }>(
        `${server.url}/api/players/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: '' }),
        },
      );

      expect(json.success).toBe(false);
    });
  });

  // ── WebSocket Authentication ────────────────────────────────

  describe('WebSocket Authentication', () => {
    it('should reject connection without token', async () => {
      const socket = createSocketWithoutAuth(server.url);

      try {
        const error = await waitForEvent<Error>(socket, 'connect_error');
        expect(error.message).toContain('AUTHENTICATION_ERROR');
      } finally {
        socket.disconnect();
      }
    });

    it('should reject connection with invalid token', async () => {
      const socket = createSocket(server.url, 'not-a-valid-jwt-token');

      try {
        const error = await waitForEvent<Error>(socket, 'connect_error');
        expect(error.message).toContain('AUTHENTICATION_ERROR');
      } finally {
        socket.disconnect();
      }
    });

    it('should accept connection with valid token', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');
      const socket = createSocket(server.url, token);

      try {
        await waitForEvent(socket, 'connect');
        expect(socket.connected).toBe(true);
      } finally {
        socket.disconnect();
      }
    });

    it('should allow multiple connections with different tokens', async () => {
      const player1 = await registerPlayer(server.url, 'Ash');
      const player2 = await registerPlayer(server.url, 'Gary');

      const socket1 = createSocket(server.url, player1.token);
      const socket2 = createSocket(server.url, player2.token);

      try {
        await Promise.all([
          waitForEvent(socket1, 'connect'),
          waitForEvent(socket2, 'connect'),
        ]);

        expect(socket1.connected).toBe(true);
        expect(socket2.connected).toBe(true);
      } finally {
        socket1.disconnect();
        socket2.disconnect();
      }
    });
  });

  // ── WebSocket uses token nickname ───────────────────────────

  describe('WebSocket uses nickname from token', () => {
    it('should use the token nickname when joining lobby', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');
      const socket = createSocket(server.url, token);

      try {
        await waitForEvent(socket, 'connect');

        // join_lobby no longer requires nickname in payload — it comes from the token
        socket.emit('join_lobby');

        const lobby = await waitForEvent<{ players: { nickname: string }[] }>(
          socket,
          'lobby_status',
        );

        expect(lobby.players).toHaveLength(1);
        expect(lobby.players[0].nickname).toBe('Ash');
      } finally {
        socket.disconnect();
      }
    });
  });

  // ── Protected HTTP Routes ─────────────────────────────────

  describe('Protected Routes', () => {
    it('GET /api/players/:nickname/history should reject without token', async () => {
      await registerPlayer(server.url, 'Ash');

      const res = await fetch(`${server.url}/api/players/Ash/history`);
      expect(res.status).toBe(401);

      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/players/:nickname/history should reject with invalid token', async () => {
      await registerPlayer(server.url, 'Ash');

      const res = await fetch(`${server.url}/api/players/Ash/history`, {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      expect(res.status).toBe(401);
    });

    it('GET /api/players/:nickname/history should work with valid token', async () => {
      const { token } = await registerPlayer(server.url, 'Ash');

      const res = await fetch(`${server.url}/api/players/Ash/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        success: boolean;
        data: { stats: { nickname: string } };
      };
      expect(json.success).toBe(true);
      expect(json.data.stats.nickname).toBe('Ash');
    });

    it('public routes should remain accessible without token', async () => {
      const [health, pokemon, leaderboard] = await Promise.all([
        fetch(`${server.url}/api/health`),
        fetch(`${server.url}/api/pokemon`),
        fetch(`${server.url}/api/leaderboard`),
      ]);

      expect(health.status).toBe(200);
      expect(pokemon.status).toBe(200);
      expect(leaderboard.status).toBe(200);
    });
  });
});
