import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, type TestServer } from './test-server';

describe('Rate Limiting E2E', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.cleanup();
  });

  it('should enforce stricter rate limit on register endpoint (30/min)', async () => {
    const results: number[] = [];

    for (let i = 0; i < 33; i++) {
      const res = await fetch(`${server.url}/api/players/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: `player-${i}` }),
      });
      results.push(res.status);
    }

    const successes = results.filter((s) => s === 200);
    const rateLimited = results.filter((s) => s === 429);

    expect(successes.length).toBe(30);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should NOT rate limit health endpoint', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(`${server.url}/api/health`).then((r) => r.status),
      ),
    );

    expect(results.every((s) => s === 200)).toBe(true);
  });

  it('should enforce global rate limit (100/min) on public endpoints', async () => {
    const results: number[] = [];

    for (let i = 0; i < 105; i++) {
      const res = await fetch(`${server.url}/api/leaderboard`);
      results.push(res.status);
    }

    const rateLimited = results.filter((s) => s === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should include rate limit headers in response', async () => {
    const res = await fetch(`${server.url}/api/pokemon`);

    expect(res.headers.get('x-ratelimit-limit')).toBeDefined();
    expect(res.headers.get('x-ratelimit-remaining')).toBeDefined();
  });
});
