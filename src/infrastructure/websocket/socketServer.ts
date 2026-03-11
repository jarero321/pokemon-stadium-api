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
import { mapLobbyToDTO } from './mapLobbyToDTO';
import type { ILobbyRepository } from '@core/interfaces/index';

interface SocketServerDependencies {
  joinLobby: JoinLobby;
  assignPokemon: AssignPokemon;
  playerReady: PlayerReady;
  executeAttack: ExecuteAttack;
  switchPokemon: SwitchPokemon;
  lobbyRepository: ILobbyRepository;
  logger: ILogger;
}

export function createSocketServer(
  httpServer: HttpServer,
  dependencies: SocketServerDependencies,
): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  const registry = new PlayerConnectionRegistry();
  const { logger, lobbyRepository, ...useCases } = dependencies;

  io.on('connection', (socket) => {
    const traceId = randomUUID();
    const connectionLogger = logger.child({ socketId: socket.id, traceId });
    connectionLogger.info('Client connected');

    registerLobbyHandler(socket, {
      io,
      joinLobby: useCases.joinLobby,
      assignPokemon: useCases.assignPokemon,
      playerReady: useCases.playerReady,
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

        activeLobby.winner =
          activeLobby.players.find(
            (player) => player.nickname !== disconnectedNickname,
          )?.nickname ?? null;

        activeLobby.status = (
          await import('@core/enums/index')
        ).LobbyStatus.FINISHED;
        activeLobby.updatedAt = new Date();
        await lobbyRepository.update(activeLobby);

        io.to(registry.lobbyRoom).emit(ServerEvent.BATTLE_END, {
          winner: activeLobby.winner,
          loser: disconnectedNickname,
          reason: 'opponent_disconnected',
        });

        io.to(registry.lobbyRoom).emit(
          ServerEvent.LOBBY_STATUS,
          mapLobbyToDTO(activeLobby),
        );

        registry.clear();

        connectionLogger.info('Lobby forfeited due to disconnect', {
          winner: activeLobby.winner,
          loser: disconnectedNickname,
        });
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
