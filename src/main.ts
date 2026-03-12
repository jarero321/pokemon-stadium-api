import { env } from '@config/env';
import { PinoLogger } from '@infrastructure/logger/PinoLogger';
import { connectToMongo } from '@infrastructure/database/mongo/connection';
import { MongoLobbyRepository } from '@infrastructure/database/mongo/repositories/MongoLobbyRepository';
import { MongoBattleRepository } from '@infrastructure/database/mongo/repositories/MongoBattleRepository';
import { MongoPlayerRepository } from '@infrastructure/database/mongo/repositories/MongoPlayerRepository';
import { PokemonApiService } from '@infrastructure/external/PokemonApiService';
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
import { ResetLobby } from '@application/listeners/ResetLobby';
import { UpdateLeaderboard } from '@application/listeners/UpdateLeaderboard';
import type { BattleFinishedEvent } from '@core/events/index';
import { createHttpServer } from '@infrastructure/http/server';
import { createSocketServer } from '@infrastructure/websocket/socketServer';

async function bootstrap() {
  const logger = new PinoLogger();

  logger.info('Starting Pokemon Stadium API', {
    env: env.NODE_ENV,
    port: env.PORT,
  });

  // ── Database ──────────────────────────────────────────────
  await connectToMongo(env.MONGODB_URI, logger);

  // ── Repositories ──────────────────────────────────────────
  const lobbyRepository = new MongoLobbyRepository();
  const battleRepository = new MongoBattleRepository();
  const playerRepository = new MongoPlayerRepository();

  // ── External Services ─────────────────────────────────────
  const pokemonApi = new PokemonApiService(env.POKEMON_API_BASE_URL, logger);

  // ── Infrastructure ────────────────────────────────────────
  const eventBus = new EventBus(logger);
  const turnLock = new InMemoryTurnLock();

  // ── Use Cases (WebSocket) ─────────────────────────────────
  const joinLobby = new JoinLobby(lobbyRepository, logger);
  const assignPokemon = new AssignPokemon(lobbyRepository, pokemonApi, logger);
  const playerReady = new PlayerReady(
    lobbyRepository,
    battleRepository,
    logger,
  );
  const executeAttack = new ExecuteAttack(
    lobbyRepository,
    battleRepository,
    turnLock,
    eventBus,
    logger,
  );
  const switchPokemon = new SwitchPokemon(lobbyRepository, turnLock, logger);

  // ── Use Cases (REST) ──────────────────────────────────────
  const getPokemonCatalog = new GetPokemonCatalog(pokemonApi, logger);
  const getLeaderboard = new GetLeaderboard(playerRepository, logger);
  const getPlayerHistory = new GetPlayerHistory(
    playerRepository,
    battleRepository,
    logger,
  );

  // ── Event Listeners ───────────────────────────────────────
  const resetLobby = new ResetLobby(lobbyRepository, logger);
  const updateLeaderboard = new UpdateLeaderboard(playerRepository, logger);

  eventBus.on<BattleFinishedEvent>('BattleFinished', (event) =>
    resetLobby.handle(event),
  );
  eventBus.on<BattleFinishedEvent>('BattleFinished', (event) =>
    updateLeaderboard.handle(event),
  );

  // ── HTTP Server (Fastify) ─────────────────────────────────
  const fastify = await createHttpServer({
    getPokemonCatalog,
    getLeaderboard,
    getPlayerHistory,
    logger,
  });

  await fastify.ready();

  // ── Socket.IO (attached to Fastify's HTTP server) ─────────
  createSocketServer(fastify.server, {
    joinLobby,
    assignPokemon,
    playerReady,
    executeAttack,
    switchPokemon,
    lobbyRepository,
    logger,
  });

  // ── Start ─────────────────────────────────────────────────
  await fastify.listen({ port: env.PORT, host: env.HOST });
  logger.info(`Server listening on http://${env.HOST}:${env.PORT}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
