import type { FastifyInstance } from 'fastify';
import type { GetPokemonCatalog } from '@application/use-cases/GetPokemonCatalog';
import type { GetLeaderboard } from '@application/use-cases/GetLeaderboard';
import type { GetPlayerHistory } from '@application/use-cases/GetPlayerHistory';
import { ok, fail } from '../ApiResponse';

interface RouteDependencies {
  getPokemonCatalog: GetPokemonCatalog;
  getLeaderboard: GetLeaderboard;
  getPlayerHistory: GetPlayerHistory;
}

const apiResponseSchema = (dataSchema: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: dataSchema,
    error: { type: 'null' },
    traceId: { type: 'string', nullable: true },
    timestamp: { type: 'string' },
  },
});

const apiErrorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'null' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    traceId: { type: 'string', nullable: true },
    timestamp: { type: 'string' },
  },
};

export async function registerRoutes(
  app: FastifyInstance,
  dependencies: RouteDependencies,
): Promise<void> {
  const { getPokemonCatalog, getLeaderboard, getPlayerHistory } = dependencies;

  app.get(
    '/api/pokemon',
    {
      schema: {
        tags: ['Pokemon'],
        summary: 'Get available Pokemon catalog (Gen 1)',
        response: {
          200: apiResponseSchema({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                sprite: { type: 'string' },
              },
            },
          }),
        },
      },
    },
    async (request) => {
      const catalog = await getPokemonCatalog.execute();
      return ok(catalog, request.traceId);
    },
  );

  app.get<{ Querystring: { limit?: string } }>(
    '/api/leaderboard',
    {
      schema: {
        tags: ['Leaderboard'],
        summary: 'Get top players ranked by win rate',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', description: 'Max results (default 10)' },
          },
        },
        response: {
          200: apiResponseSchema({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nickname: { type: 'string' },
                wins: { type: 'number' },
                losses: { type: 'number' },
                totalBattles: { type: 'number' },
                winRate: { type: 'number' },
              },
            },
          }),
        },
      },
    },
    async (request) => {
      const limit = request.query.limit
        ? parseInt(request.query.limit, 10)
        : 10;
      const leaderboard = await getLeaderboard.execute(limit);
      return ok(leaderboard, request.traceId);
    },
  );

  app.get<{ Params: { nickname: string } }>(
    '/api/players/:nickname/history',
    {
      schema: {
        tags: ['Players'],
        summary: 'Get battle history and stats for a player',
        params: {
          type: 'object',
          properties: {
            nickname: { type: 'string', description: 'Player nickname' },
          },
          required: ['nickname'],
        },
        response: {
          200: apiResponseSchema({
            type: 'object',
            properties: {
              stats: {
                type: 'object',
                properties: {
                  nickname: { type: 'string' },
                  wins: { type: 'number' },
                  losses: { type: 'number' },
                  totalBattles: { type: 'number' },
                  winRate: { type: 'number' },
                },
              },
              battles: { type: 'array', items: { type: 'object' } },
            },
          }),
          404: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await getPlayerHistory.execute(request.params.nickname);

      if (!result) {
        return reply
          .status(404)
          .send(
            fail(
              'PLAYER_NOT_FOUND',
              `Player "${request.params.nickname}" not found`,
              request.traceId,
            ),
          );
      }

      return ok(result, request.traceId);
    },
  );

  app.get(
    '/api/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Health check',
        response: {
          200: apiResponseSchema({
            type: 'object',
            properties: {
              status: { type: 'string' },
            },
          }),
        },
      },
    },
    async (request) => {
      return ok({ status: 'healthy' }, request.traceId);
    },
  );
}
