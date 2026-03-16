import { randomUUID } from 'node:crypto';
import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { ILogger } from '@core/interfaces/index';
import type { JoinLobby } from '@application/use-cases/JoinLobby';
import type { AssignPokemon } from '@application/use-cases/AssignPokemon';
import type { PlayerReady } from '@application/use-cases/PlayerReady';
import type { ExecuteAttack } from '@application/use-cases/ExecuteAttack';
import type { SwitchPokemon } from '@application/use-cases/SwitchPokemon';
import { PlayerConnectionRegistry } from './PlayerConnectionRegistry';
import { registerLobbyHandler } from './handlers/lobbyHandler';
import { registerBattleHandler } from './handlers/battleHandler';
import { ServerEvent } from './SocketEvents';
import { mapLobbyToDTO } from '@application/mappers/mapLobbyToDTO';
import { LobbyStatus } from '@core/enums/index';
import type {
  ILobbyRepository,
  ITokenService,
  IEventBus,
  ITurnLock,
} from '@core/interfaces/index';
import { createBattleFinishedEvent } from '@core/events/index';

interface SocketServerDependencies {
  joinLobby: JoinLobby;
  assignPokemon: AssignPokemon;
  playerReady: PlayerReady;
  executeAttack: ExecuteAttack;
  switchPokemon: SwitchPokemon;
  lobbyRepository: ILobbyRepository;
  lobbyLock: ITurnLock;
  eventBus: IEventBus;
  tokenService: ITokenService;
  logger: ILogger;
  corsOrigin: string;
}

export function createSocketServer(
  httpServer: HttpServer,
  dependencies: SocketServerDependencies,
): SocketServer {
  const { corsOrigin } = dependencies;
  const io = new SocketServer(httpServer, {
    cors: {
      origin:
        corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  const registry = new PlayerConnectionRegistry();
  const {
    logger,
    lobbyRepository,
    lobbyLock,
    eventBus,
    tokenService,
    ...useCases
  } = dependencies;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error('AUTHENTICATION_ERROR'));
    }

    try {
      const payload = tokenService.verify(token);
      socket.data.nickname = payload.nickname;
      next();
    } catch {
      next(new Error('AUTHENTICATION_ERROR'));
    }
  });

  io.on('connection', (socket) => {
    const traceId = randomUUID();
    const connectionLogger = logger.child({ socketId: socket.id, traceId });
    connectionLogger.info('Client connected');

    registerLobbyHandler(socket, {
      io,
      joinLobby: useCases.joinLobby,
      assignPokemon: useCases.assignPokemon,
      playerReady: useCases.playerReady,
      lobbyLock,
      registry,
      logger: connectionLogger,
    });

    registerBattleHandler(socket, {
      io,
      executeAttack: useCases.executeAttack,
      switchPokemon: useCases.switchPokemon,
      registry,
      logger: connectionLogger,
    });

    socket.on('disconnect', async (reason) => {
      const disconnectedNickname = registry.unregister(socket);

      if (!disconnectedNickname) {
        connectionLogger.debug('Unregistered socket disconnected', {
          reason,
        });
        return;
      }

      connectionLogger.info('Player disconnected', {
        nickname: disconnectedNickname,
        reason,
      });

      try {
        const activeLobby = await lobbyRepository.findActive();
        if (!activeLobby) return;

        const isInLobby = activeLobby.players.some(
          (p) => p.nickname === disconnectedNickname,
        );
        if (!isInLobby) return;

        if (
          activeLobby.status === LobbyStatus.WAITING ||
          activeLobby.status === LobbyStatus.READY
        ) {
          // Pre-battle: just finish the lobby, no winner
          const finishedLobby = {
            ...activeLobby,
            status: LobbyStatus.FINISHED,
            updatedAt: new Date(),
          };
          await lobbyRepository.update(finishedLobby);

          io.to(registry.lobbyRoom).emit(
            ServerEvent.LOBBY_STATUS,
            mapLobbyToDTO(finishedLobby),
          );

          registry.clear();

          connectionLogger.info(
            'Lobby closed — player disconnected during waiting/ready',
            { disconnected: disconnectedNickname },
          );
        } else {
          // During battle: forfeit, declare winner
          const winner =
            activeLobby.players.find(
              (player) => player.nickname !== disconnectedNickname,
            )?.nickname ?? null;

          const finishedLobby = {
            ...activeLobby,
            winner,
            status: LobbyStatus.FINISHED,
            updatedAt: new Date(),
          };
          await lobbyRepository.update(finishedLobby);

          io.to(registry.lobbyRoom).emit(ServerEvent.BATTLE_END, {
            winner,
            loser: disconnectedNickname,
            reason: 'opponent_disconnected',
          });

          // Update leaderboard stats for forfeit
          if (winner && activeLobby.battleId) {
            await eventBus.emit(
              createBattleFinishedEvent(
                activeLobby.battleId,
                winner,
                disconnectedNickname,
                randomUUID(),
              ),
            );
          }

          io.to(registry.lobbyRoom).emit(
            ServerEvent.LOBBY_STATUS,
            mapLobbyToDTO(finishedLobby),
          );

          registry.clear();

          connectionLogger.info('Lobby forfeited due to disconnect', {
            winner,
            loser: disconnectedNickname,
          });
        }
      } catch (error) {
        connectionLogger.error(
          'Error handling disconnect cleanup',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });
  });

  logger.info('Socket.IO server initialized');

  return io;
}
