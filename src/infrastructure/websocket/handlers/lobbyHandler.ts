import type { Server, Socket } from 'socket.io';
import type { ILogger } from '@core/interfaces/index';
import type { JoinLobby } from '@application/use-cases/JoinLobby';
import type { AssignPokemon } from '@application/use-cases/AssignPokemon';
import type { PlayerReady } from '@application/use-cases/PlayerReady';
import type { PlayerConnectionRegistry } from '../PlayerConnectionRegistry';
import { ClientEvent, ServerEvent } from '../SocketEvents';
import { withErrorBoundary } from '../withErrorBoundary';
import { mapLobbyToDTO } from '../mapLobbyToDTO';

interface LobbyHandlerDependencies {
  io: Server;
  joinLobby: JoinLobby;
  assignPokemon: AssignPokemon;
  playerReady: PlayerReady;
  registry: PlayerConnectionRegistry;
  logger: ILogger;
}

export function registerLobbyHandler(
  socket: Socket,
  dependencies: LobbyHandlerDependencies,
): void {
  const { io, joinLobby, assignPokemon, playerReady, registry, logger } =
    dependencies;

  const handlerLogger = logger.child({ socketId: socket.id });

  socket.on(
    ClientEvent.JOIN_LOBBY,
    withErrorBoundary(
      socket,
      handlerLogger,
      async (data: { nickname: string }) => {
        if (registry.isSocketRegistered(socket.id)) {
          socket.emit(ServerEvent.ERROR, {
            code: 'ALREADY_JOINED',
            message: 'This connection already joined the lobby',
          });
          return;
        }

        const lobby = await joinLobby.execute(data.nickname, socket.id);

        registry.register(socket, data.nickname);
        io.to(registry.lobbyRoom).emit(
          ServerEvent.LOBBY_STATUS,
          mapLobbyToDTO(lobby),
        );

        handlerLogger.info('Player joined lobby', {
          nickname: data.nickname,
        });
      },
    ),
  );

  socket.on(
    ClientEvent.ASSIGN_POKEMON,
    withErrorBoundary(socket, handlerLogger, async () => {
      if (!registry.isSocketRegistered(socket.id)) {
        socket.emit(ServerEvent.ERROR, {
          code: 'NOT_IN_LOBBY',
          message: 'You must join the lobby first',
        });
        return;
      }

      const lobby = await assignPokemon.execute(socket.id);

      io.to(registry.lobbyRoom).emit(
        ServerEvent.LOBBY_STATUS,
        mapLobbyToDTO(lobby),
      );

      handlerLogger.info('Pokemon assigned');
    }),
  );

  socket.on(
    ClientEvent.READY,
    withErrorBoundary(socket, handlerLogger, async () => {
      if (!registry.isSocketRegistered(socket.id)) {
        socket.emit(ServerEvent.ERROR, {
          code: 'NOT_IN_LOBBY',
          message: 'You must join the lobby first',
        });
        return;
      }

      const { lobby, battleStarted } = await playerReady.execute(socket.id);

      io.to(registry.lobbyRoom).emit(
        ServerEvent.LOBBY_STATUS,
        mapLobbyToDTO(lobby),
      );

      if (battleStarted) {
        io.to(registry.lobbyRoom).emit(
          ServerEvent.BATTLE_START,
          mapLobbyToDTO(lobby),
        );

        handlerLogger.info('Battle started');
      }
    }),
  );
}
