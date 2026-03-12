import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { ILogger } from '@core/interfaces/index';
import type { GetPokemonCatalog } from '@application/use-cases/GetPokemonCatalog';
import type { GetLeaderboard } from '@application/use-cases/GetLeaderboard';
import type { GetPlayerHistory } from '@application/use-cases/GetPlayerHistory';
import { registerRoutes } from './routes/pokemonRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { traceIdHook } from './middlewares/traceId';

interface HttpServerDependencies {
  getPokemonCatalog: GetPokemonCatalog;
  getLeaderboard: GetLeaderboard;
  getPlayerHistory: GetPlayerHistory;
  logger: ILogger;
}

export async function createHttpServer(dependencies: HttpServerDependencies) {
  const { logger, ...useCases } = dependencies;

  const app = Fastify({ logger: false });

  await app.register(fastifyCors, { origin: '*' });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Pokemon Stadium Lite API',
        description:
          'REST API for Pokemon catalog, leaderboard, and player history. Real-time battle flow is handled via WebSocket (Socket.IO).',
        version: '1.0.0',
      },
      tags: [
        { name: 'Pokemon', description: 'Pokemon catalog from PokeAPI' },
        { name: 'Leaderboard', description: 'Player rankings by win rate' },
        { name: 'Players', description: 'Player stats and battle history' },
        { name: 'System', description: 'Health checks and diagnostics' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  app.setErrorHandler(errorHandler);

  app.addHook('onRequest', traceIdHook);

  app.addHook('onRequest', (request, _reply, done) => {
    const requestLogger = logger.child({
      traceId: request.traceId,
      method: request.method,
      url: request.url,
    });
    requestLogger.info('Incoming request');
    done();
  });

  app.addHook('onResponse', (request, reply, done) => {
    logger.info('Request completed', {
      traceId: request.traceId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    });
    done();
  });

  await registerRoutes(app, useCases);

  return app;
}
