import type { Server, Socket } from 'socket.io';
import type { ILogger } from '@core/interfaces/index';
import type { ExecuteAttack } from '@application/use-cases/ExecuteAttack';
import type { SwitchPokemon } from '@application/use-cases/SwitchPokemon';
import type { PlayerConnectionRegistry } from '../PlayerConnectionRegistry';
import { ClientEvent, ServerEvent } from '../SocketEvents';
import { withErrorBoundary } from '../withErrorBoundary';
import { mapLobbyToDTO } from '../mapLobbyToDTO';

interface BattleHandlerDependencies {
  io: Server;
  executeAttack: ExecuteAttack;
  switchPokemon: SwitchPokemon;
  registry: PlayerConnectionRegistry;
  logger: ILogger;
}

export function registerBattleHandler(
  socket: Socket,
  dependencies: BattleHandlerDependencies,
): void {
  const { io, executeAttack, switchPokemon, registry, logger } = dependencies;

  const handlerLogger = logger.child({ socketId: socket.id });

  socket.on(
    ClientEvent.ATTACK,
    withErrorBoundary(socket, handlerLogger, async () => {
      if (!registry.isSocketRegistered(socket.id)) {
        socket.emit(ServerEvent.ERROR, {
          code: 'NOT_IN_LOBBY',
          message: 'You must join the lobby first',
        });
        return;
      }

      const result = await executeAttack.execute(socket.id);

      io.to(registry.lobbyRoom).emit(
        ServerEvent.TURN_RESULT,
        result.turnResult,
      );

      if (result.pokemonDefeated) {
        io.to(registry.lobbyRoom).emit(
          ServerEvent.POKEMON_DEFEATED,
          result.pokemonDefeated,
        );
      }

      if (result.pokemonSwitch) {
        io.to(registry.lobbyRoom).emit(
          ServerEvent.POKEMON_SWITCH,
          result.pokemonSwitch,
        );
      }

      if (result.battleEnded) {
        io.to(registry.lobbyRoom).emit(ServerEvent.BATTLE_END, {
          winner: result.winner,
          loser: result.lobby.players.find(
            (player) => player.nickname !== result.winner,
          )?.nickname,
          battleId: result.lobby.battleId,
        });

        handlerLogger.info('Battle ended', { winner: result.winner });
      }

      io.to(registry.lobbyRoom).emit(
        ServerEvent.LOBBY_STATUS,
        mapLobbyToDTO(result.lobby),
      );
    }),
  );

  socket.on(
    ClientEvent.SWITCH_POKEMON,
    withErrorBoundary(
      socket,
      handlerLogger,
      async (data: { targetPokemonIndex: number }) => {
        if (!registry.isSocketRegistered(socket.id)) {
          socket.emit(ServerEvent.ERROR, {
            code: 'NOT_IN_LOBBY',
            message: 'You must join the lobby first',
          });
          return;
        }

        const lobby = await switchPokemon.execute(
          socket.id,
          data.targetPokemonIndex,
        );

        io.to(registry.lobbyRoom).emit(
          ServerEvent.LOBBY_STATUS,
          mapLobbyToDTO(lobby),
        );

        handlerLogger.info('Pokemon switched');
      },
    ),
  );
}
