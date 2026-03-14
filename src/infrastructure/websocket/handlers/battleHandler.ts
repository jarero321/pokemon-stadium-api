import type { Server, Socket } from 'socket.io';
import type { ILogger } from '@core/interfaces/index';
import type { ExecuteAttack } from '@application/use-cases/ExecuteAttack';
import type { SwitchPokemon } from '@application/use-cases/SwitchPokemon';
import type { PlayerConnectionRegistry } from '../PlayerConnectionRegistry';
import { ClientEvent, ServerEvent } from '../SocketEvents';
import { withErrorBoundary } from '../withErrorBoundary';
import { mapLobbyToDTO } from '../mapLobbyToDTO';
import { attackSchema, switchPokemonSchema } from '../schemas';

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
    withErrorBoundary(socket, handlerLogger, async (rawData: unknown) => {
      const parsed = attackSchema.safeParse(rawData);
      if (!parsed.success) {
        socket.emit(ServerEvent.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: parsed.error.issues[0].message,
        });
        return;
      }

      if (!registry.isSocketRegistered(socket.id)) {
        socket.emit(ServerEvent.ERROR, {
          code: 'NOT_IN_LOBBY',
          message: 'You must join the lobby first',
        });
        return;
      }

      const result = await executeAttack.execute(
        socket.id,
        parsed.data.requestId,
      );

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
    withErrorBoundary(socket, handlerLogger, async (rawData: unknown) => {
      const parsed = switchPokemonSchema.safeParse(rawData);
      if (!parsed.success) {
        socket.emit(ServerEvent.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: parsed.error.issues[0].message,
        });
        return;
      }

      if (!registry.isSocketRegistered(socket.id)) {
        socket.emit(ServerEvent.ERROR, {
          code: 'NOT_IN_LOBBY',
          message: 'You must join the lobby first',
        });
        return;
      }

      const { lobby, switchInfo } = await switchPokemon.execute(
        socket.id,
        parsed.data.targetPokemonIndex,
        parsed.data.requestId,
      );

      io.to(registry.lobbyRoom).emit(ServerEvent.POKEMON_SWITCH, switchInfo);

      io.to(registry.lobbyRoom).emit(
        ServerEvent.LOBBY_STATUS,
        mapLobbyToDTO(lobby),
      );

      handlerLogger.info('Pokemon switched', {
        player: switchInfo.player,
        from: switchInfo.previousPokemon,
        to: switchInfo.newPokemon,
      });
    }),
  );
}
