import type { Server, Socket } from 'socket.io';
import type { ILogger } from '@core/interfaces/index';
import type { ExecuteAttack } from '@application/use-cases/ExecuteAttack';
import type { SwitchPokemon } from '@application/use-cases/SwitchPokemon';
import type { PlayerConnectionRegistry } from '../PlayerConnectionRegistry';
import { ClientEvent, ServerEvent } from '../SocketEvents';
import { withErrorBoundary } from '../withErrorBoundary';
import { mapLobbyToDTO } from '@application/mappers/mapLobbyToDTO';
import { attackSchema, switchPokemonSchema } from '../schemas';

const FORCED_SWITCH_TIMEOUT_MS = 30_000;

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
  let forcedSwitchTimer: ReturnType<typeof setTimeout> | null = null;

  const clearForcedSwitchTimer = () => {
    if (forcedSwitchTimer) {
      clearTimeout(forcedSwitchTimer);
      forcedSwitchTimer = null;
    }
  };

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

      // Emit lobby_status BEFORE battle_end — registry.clear() removes
      // sockets from the room, so events after clear won't reach clients
      io.to(registry.lobbyRoom).emit(
        ServerEvent.LOBBY_STATUS,
        mapLobbyToDTO(result.lobby),
      );

      if (result.battleEnded) {
        clearForcedSwitchTimer();
        io.to(registry.lobbyRoom).emit(ServerEvent.BATTLE_END, {
          winner: result.winner,
          loser: result.lobby.players.find(
            (player) => player.nickname !== result.winner,
          )?.nickname,
          battleId: result.lobby.battleId,
        });

        registry.clear();
        handlerLogger.info('Battle ended', { winner: result.winner });
      } else if (
        result.pokemonDefeated &&
        result.pokemonDefeated.remainingTeam > 0
      ) {
        // Defender must switch — start timeout for auto-switch
        clearForcedSwitchTimer();
        const defenderIndex = result.lobby.currentTurnIndex;
        const defender =
          defenderIndex !== null ? result.lobby.players[defenderIndex] : null;

        if (defender) {
          const nextAlive = defender.team.findIndex(
            (p, i) => !p.defeated && i !== defender.activePokemonIndex,
          );

          if (nextAlive !== -1) {
            forcedSwitchTimer = setTimeout(async () => {
              try {
                handlerLogger.info('Auto-switching after timeout', {
                  nickname: defender.nickname,
                  targetIndex: nextAlive,
                });

                const { lobby: switchedLobby, switchInfo } =
                  await switchPokemon.execute(
                    defender.playerId,
                    nextAlive,
                    crypto.randomUUID(),
                  );

                io.to(registry.lobbyRoom).emit(
                  ServerEvent.POKEMON_SWITCH,
                  switchInfo,
                );
                io.to(registry.lobbyRoom).emit(
                  ServerEvent.LOBBY_STATUS,
                  mapLobbyToDTO(switchedLobby),
                );
              } catch (err) {
                handlerLogger.error(
                  'Auto-switch failed',
                  err instanceof Error ? err : new Error(String(err)),
                );
              }
            }, FORCED_SWITCH_TIMEOUT_MS);
          }
        }
      }
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

      // Player switched manually — cancel auto-switch timer
      clearForcedSwitchTimer();

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
