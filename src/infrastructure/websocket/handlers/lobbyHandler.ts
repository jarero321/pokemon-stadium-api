import type { Server, Socket } from 'socket.io';
import type { ILogger } from '@core/interfaces/index';
import type { JoinLobby } from '@application/use-cases/JoinLobby';
import type { AssignPokemon } from '@application/use-cases/AssignPokemon';
import type { PlayerReady } from '@application/use-cases/PlayerReady';
import type { ITurnLock, ILobbyRepository } from '@core/interfaces/index';
import { LobbyStatus } from '@core/enums/index';
import type { PlayerConnectionRegistry } from '../PlayerConnectionRegistry';
import { ClientEvent, ServerEvent } from '../SocketEvents';
import { withErrorBoundary } from '../withErrorBoundary';
import { mapLobbyToDTO } from '@application/mappers/mapLobbyToDTO';

interface LobbyHandlerDependencies {
  io: Server;
  joinLobby: JoinLobby;
  assignPokemon: AssignPokemon;
  playerReady: PlayerReady;
  lobbyLock: ITurnLock;
  lobbyRepository: ILobbyRepository;
  registry: PlayerConnectionRegistry;
  logger: ILogger;
}

export function registerLobbyHandler(
  socket: Socket,
  dependencies: LobbyHandlerDependencies,
): void {
  const {
    io,
    joinLobby,
    assignPokemon,
    playerReady,
    lobbyLock,
    registry,
    logger,
  } = dependencies;

  const handlerLogger = logger.child({ socketId: socket.id });

  socket.on(
    ClientEvent.JOIN_LOBBY,
    withErrorBoundary(socket, handlerLogger, async () => {
      const nickname = socket.data.nickname as string;

      if (registry.isSocketRegistered(socket.id)) {
        socket.emit(ServerEvent.ERROR, {
          code: 'ALREADY_JOINED',
          message: 'This connection already joined the lobby',
        });
        return;
      }

      // Reject if another socket with the same nickname is already connected
      if (registry.isNicknameConnected(nickname)) {
        socket.emit(ServerEvent.ERROR, {
          code: 'NICKNAME_IN_USE',
          message: 'This nickname is already in an active session',
        });
        return;
      }

      // Clean stale lobbies: if ANY active lobby has players whose sockets
      // are no longer connected, finish it so a fresh one can be created
      const staleLobby = await dependencies.lobbyRepository.findActive();
      if (staleLobby) {
        const hasDisconnectedPlayers = staleLobby.players.some(
          (p) => !registry.isNicknameConnected(p.nickname),
        );
        if (hasDisconnectedPlayers) {
          await dependencies.lobbyRepository.update({
            ...staleLobby,
            status: LobbyStatus.FINISHED,
            updatedAt: new Date(),
          });
          handlerLogger.info('Cleaned stale lobby with disconnected players', {
            lobbyId: staleLobby._id,
            status: staleLobby.status,
            stalePlayers: staleLobby.players.map((p) => p.nickname),
          });
        }
      }

      // Register BEFORE execute to prevent race condition where two
      // sockets with the same nickname both pass the check above
      registry.register(socket, nickname);

      let lobby;
      try {
        lobby = await joinLobby.execute(nickname, socket.id);
      } catch (err) {
        registry.unregister(socket);
        throw err;
      }

      io.to(registry.lobbyRoom).emit(
        ServerEvent.LOBBY_STATUS,
        mapLobbyToDTO(lobby),
      );

      handlerLogger.info('Player joined lobby', { nickname });
    }),
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

      // Lock to prevent concurrent assignments overwriting each other
      const release = await lobbyLock.acquire();
      try {
        const lobby = await assignPokemon.execute(socket.id);

        io.to(registry.lobbyRoom).emit(
          ServerEvent.LOBBY_STATUS,
          mapLobbyToDTO(lobby),
        );

        handlerLogger.info('Pokemon assigned');
      } finally {
        release();
      }
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

      const { lobby, battleStarted, fromCache } = await playerReady.execute(
        socket.id,
        crypto.randomUUID(),
      );

      if (fromCache) return; // Skip re-emitting events for cached results

      // Single lobby_status with the final state (WAITING or BATTLING)
      // The intermediate READY state is transient and not useful to clients
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
