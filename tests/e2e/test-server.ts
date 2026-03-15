import mongoose from 'mongoose';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { connectToMongo } from '@infrastructure/database/mongo/connection';
import { MongoLobbyRepository } from '@infrastructure/database/mongo/repositories/MongoLobbyRepository';
import { MongoBattleRepository } from '@infrastructure/database/mongo/repositories/MongoBattleRepository';
import { MongoPlayerRepository } from '@infrastructure/database/mongo/repositories/MongoPlayerRepository';
import { MongoOperationRunner } from '@infrastructure/database/mongo/MongoOperationRunner';
import { EventBus } from '@infrastructure/events/EventBus';
import { InMemoryTurnLock } from '@infrastructure/locks/InMemoryTurnLock';
import { JwtTokenService } from '@infrastructure/auth/JwtTokenService';
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
import { createHttpServer } from '@infrastructure/http/server';
import { createSocketServer } from '@infrastructure/websocket/socketServer';
import { FakePokemonApiService, SilentLogger } from '../fakes/index';
import type { BattleFinishedEvent } from '@core/events/index';

const TEST_MONGO_URI =
  'mongodb://localhost:27018/pokemon-stadium-e2e?replicaSet=rs0';
const TEST_JWT_SECRET = 'e2e-test-secret-key-at-least-32-characters-long';

export interface TestServer {
  url: string;
  cleanup: () => Promise<void>;
}

export async function createTestServer(): Promise<TestServer> {
  const logger = new SilentLogger();

  await connectToMongo(TEST_MONGO_URI, logger);

  const lobbyRepository = new MongoLobbyRepository();
  const battleRepository = new MongoBattleRepository();
  const playerRepository = new MongoPlayerRepository();

  const pokemonApi = new FakePokemonApiService();
  const tokenService = new JwtTokenService(TEST_JWT_SECRET);
  const eventBus = new EventBus(logger);
  const turnLock = new InMemoryTurnLock();
  const operationRunner = new MongoOperationRunner(logger);

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

  const updateLeaderboard = new UpdateLeaderboard(
    playerRepository,
    logger,
    operationRunner,
  );
  eventBus.on<BattleFinishedEvent>('BattleFinished', (event) =>
    updateLeaderboard.handle(event),
  );

  const fastify = await createHttpServer({
    getPokemonCatalog,
    getLeaderboard,
    getPlayerHistory,
    registerPlayer,
    tokenService,
    logger,
    corsOrigin: '*',
  });

  await fastify.ready();

  createSocketServer(fastify.server, {
    joinLobby,
    assignPokemon,
    playerReady,
    executeAttack,
    switchPokemon,
    lobbyRepository,
    eventBus,
    tokenService,
    logger,
    corsOrigin: '*',
  });

  await fastify.listen({ port: 0, host: '127.0.0.1' });
  const address = fastify.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    cleanup: async () => {
      await fastify.close();
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

interface RegisterResult {
  token: string;
  player: {
    nickname: string;
    wins: number;
    losses: number;
    totalBattles: number;
    winRate: number;
  };
  isNewPlayer: boolean;
}

export async function registerPlayer(
  baseUrl: string,
  nickname: string,
): Promise<RegisterResult> {
  const res = await fetch(`${baseUrl}/api/players/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  const json = (await res.json()) as {
    success: boolean;
    data: RegisterResult;
    error?: { message: string };
  };
  if (!json.success) {
    throw new Error(`Registration failed: ${json.error?.message}`);
  }
  return json.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchJson<T = any>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  return (await res.json()) as T;
}

export function createSocket(baseUrl: string, token: string): ClientSocket {
  return ioClient(baseUrl, {
    transports: ['websocket'],
    auth: { token },
    forceNew: true,
  });
}

export function createSocketWithoutAuth(baseUrl: string): ClientSocket {
  return ioClient(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
  });
}

export function waitForEvent<T = unknown>(
  socket: ClientSocket,
  event: string,
  timeout = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`Timeout waiting for event "${event}" after ${timeout}ms`),
      );
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export function collectEvents<T = unknown>(
  socket: ClientSocket,
  event: string,
  count: number,
  timeout = 10000,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const events: T[] = [];
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timeout: received ${events.length}/${count} "${event}" events after ${timeout}ms`,
        ),
      );
    }, timeout);

    const handler = (data: T) => {
      events.push(data);
      if (events.length >= count) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(events);
      }
    };

    socket.on(event, handler);
  });
}
