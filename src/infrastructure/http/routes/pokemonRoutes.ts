import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import type { GetPokemonCatalog } from '@application/use-cases/GetPokemonCatalog';
import type { GetLeaderboard } from '@application/use-cases/GetLeaderboard';
import type { GetPlayerHistory } from '@application/use-cases/GetPlayerHistory';
import type { RegisterPlayer } from '@application/use-cases/RegisterPlayer';
import type { ITokenService, ILobbyRepository } from '@core/interfaces/index';
import { createAuthHook } from '../middlewares/authHook';
import { ok, fail } from '../ApiResponse';

interface RouteDependencies {
  getPokemonCatalog: GetPokemonCatalog;
  getLeaderboard: GetLeaderboard;
  getPlayerHistory: GetPlayerHistory;
  registerPlayer: RegisterPlayer;
  tokenService: ITokenService;
  lobbyRepository: ILobbyRepository;
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
  const {
    getPokemonCatalog,
    getLeaderboard,
    getPlayerHistory,
    registerPlayer,
    tokenService,
    lobbyRepository,
  } = dependencies;

  const authHook = createAuthHook(tokenService);

  app.post<{ Body: { nickname: string } }>(
    '/api/players/register',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
      schema: {
        tags: ['Players'],
        summary: 'Register or retrieve a player by nickname',
        body: {
          type: 'object',
          required: ['nickname'],
          properties: {
            nickname: {
              type: 'string',
              minLength: 1,
              maxLength: 20,
              description: 'Trainer nickname',
            },
          },
        },
        response: {
          200: apiResponseSchema({
            type: 'object',
            properties: {
              player: {
                type: 'object',
                properties: {
                  nickname: { type: 'string' },
                  wins: { type: 'number' },
                  losses: { type: 'number' },
                  totalBattles: { type: 'number' },
                  winRate: { type: 'number' },
                },
              },
              isNewPlayer: { type: 'boolean' },
              token: { type: 'string' },
            },
          }),
          400: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const nickname = request.body.nickname.trim();

      // Block registration if nickname is in an active lobby
      const activeLobby = await lobbyRepository.findActive();
      if (activeLobby) {
        const isInLobby = activeLobby.players.some(
          (p) => p.nickname === nickname,
        );
        if (isInLobby) {
          reply.status(409);
          return fail(
            'NICKNAME_IN_USE',
            'This nickname is currently in a battle or lobby. Try a different name.',
            request.traceId,
          );
        }
      }

      const result = await registerPlayer.execute(nickname);
      return ok(result, request.traceId);
    },
  );

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

  app.get<{ Params: { nickname: string }; Querystring: { limit?: string } }>(
    '/api/players/:nickname/history',
    {
      onRequest: authHook,
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
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'string',
              description: 'Max battles to return (default 20)',
            },
          },
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
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const limit = request.query.limit
        ? parseInt(request.query.limit, 10)
        : 20;
      const result = await getPlayerHistory.execute(
        request.params.nickname,
        limit,
      );

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
      config: {
        rateLimit: false,
      },
      schema: {
        tags: ['System'],
        summary: 'Health check',
        response: {
          200: apiResponseSchema({
            type: 'object',
            properties: {
              status: { type: 'string' },
              mongo: { type: 'string' },
            },
          }),
          503: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const mongoStatus =
        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      const isHealthy = mongoStatus === 'connected';

      if (!isHealthy) {
        return reply
          .code(503)
          .send(
            fail(
              'SERVICE_DEGRADED',
              `MongoDB is ${mongoStatus}`,
              request.traceId,
            ),
          );
      }

      return ok({ status: 'healthy', mongo: mongoStatus }, request.traceId);
    },
  );
}
