import { env } from '@config/env';
import { PinoLogger } from '@infrastructure/logger/PinoLogger';
import { connectToMongo } from '@infrastructure/database/mongo/connection';
import { MongoLobbyRepository } from '@infrastructure/database/mongo/repositories/MongoLobbyRepository';
import { MongoBattleRepository } from '@infrastructure/database/mongo/repositories/MongoBattleRepository';
import { MongoPlayerRepository } from '@infrastructure/database/mongo/repositories/MongoPlayerRepository';
import { MongoOperationRunner } from '@infrastructure/database/mongo/MongoOperationRunner';
import { PokemonApiService } from '@infrastructure/external/PokemonApiService';
import { CachedPokemonApiService } from '@infrastructure/external/CachedPokemonApiService';
import { EventBus } from '@infrastructure/events/EventBus';
import { InMemoryTurnLock } from '@infrastructure/locks/InMemoryTurnLock';
import { JoinLobby } from '@application/use-cases/JoinLobby';
import { AssignPokemon } from '@application/use-cases/AssignPokemon';
import { PlayerReady } from '@application/use-cases/PlayerReady';
import { ExecuteAttack } from '@application/use-cases/ExecuteAttack';
import { SwitchPokemon } from '@application/use-cases/SwitchPokemon';
import { GetPokemonCatalog } from '@application/use-cases/GetPokemonCatalog';
import { GetLeaderboard } from '@application/use-cases/GetLeaderboard';
import { GetPlayerHistory } from '@application/use-cases/GetPlayerHistory';
import { RegisterPlayer } from '@application/use-cases/RegisterPlayer';
import { UpdateLeaderboard } from '@application/listeners/UpdateLeaderboard';
import type { BattleFinishedEvent } from '@core/events/index';
import { createHttpServer } from '@infrastructure/http/server';
import { createSocketServer } from '@infrastructure/websocket/socketServer';
import { JwtTokenService } from '@infrastructure/auth/JwtTokenService';

async function bootstrap() {
  const logger = new PinoLogger();

  logger.info('Starting Pokemon Stadium API', {
    env: env.NODE_ENV,
    port: env.PORT,
  });

  await connectToMongo(env.MONGODB_URI, logger);

  // Repositories
  const lobbyRepository = new MongoLobbyRepository();
  await lobbyRepository.reset(); // clean stale lobbies from previous runs
  logger.info('Stale lobbies cleaned up');

  const battleRepository = new MongoBattleRepository();
  const playerRepository = new MongoPlayerRepository();

  // External services
  const externalPokemonApi = new PokemonApiService(
    env.POKEMON_API_BASE_URL,
    logger,
  );
  const pokemonApi = new CachedPokemonApiService(externalPokemonApi, logger);

  // Infrastructure
  const tokenService = new JwtTokenService(env.JWT_SECRET);
  const eventBus = new EventBus(logger);
  const turnLock = new InMemoryTurnLock();
  const operationRunner = new MongoOperationRunner(logger);

  // Use cases (WebSocket)
  const lobbyLock = new InMemoryTurnLock();
  const joinLobby = new JoinLobby(lobbyRepository, lobbyLock, logger);
  const assignPokemon = new AssignPokemon(lobbyRepository, pokemonApi, logger);
  const playerReady = new PlayerReady(
    lobbyRepository,
    battleRepository,
    logger,
    operationRunner,
  );
  const executeAttack = new ExecuteAttack(
    lobbyRepository,
    battleRepository,
    turnLock,
    eventBus,
    logger,
    operationRunner,
  );
  const switchPokemon = new SwitchPokemon(
    lobbyRepository,
    turnLock,
    logger,
    operationRunner,
  );

  // Use cases (REST)
  const getPokemonCatalog = new GetPokemonCatalog(pokemonApi, logger);
  const getLeaderboard = new GetLeaderboard(playerRepository, logger);
  const getPlayerHistory = new GetPlayerHistory(
    playerRepository,
    battleRepository,
    logger,
  );
  const registerPlayer = new RegisterPlayer(
    playerRepository,
    tokenService,
    logger,
  );

  // Event listeners
  const updateLeaderboard = new UpdateLeaderboard(
    playerRepository,
    logger,
    operationRunner,
  );

  eventBus.on<BattleFinishedEvent>('BattleFinished', (event) =>
    updateLeaderboard.handle(event),
  );

  // HTTP server
  const fastify = await createHttpServer({
    getPokemonCatalog,
    getLeaderboard,
    getPlayerHistory,
    registerPlayer,
    tokenService,
    logger,
    corsOrigin: env.CORS_ORIGIN,
  });

  await fastify.ready();

  // Socket.IO server
  createSocketServer(fastify.server, {
    joinLobby,
    assignPokemon,
    playerReady,
    executeAttack,
    switchPokemon,
    lobbyRepository,
    battleRepository,
    lobbyLock,
    eventBus,
    tokenService,
    logger,
    corsOrigin: env.CORS_ORIGIN,
  });

  await fastify.listen({ port: env.PORT, host: env.HOST });
  logger.info(`Server listening on http://${env.HOST}:${env.PORT}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    await fastify.close();
    logger.info('Server closed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
