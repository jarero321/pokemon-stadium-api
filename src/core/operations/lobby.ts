import type { Lobby } from '@core/entities/index';
import type { Player } from '@core/entities/index';
import { LobbyStatus } from '@core/enums/index';
import type { PlayerStatus } from '@core/enums/index';

export function addPlayer(
  lobby: Lobby,
  nickname: string,
  playerId: string,
  status: PlayerStatus,
): Lobby {
  const newPlayer: Player = {
    nickname,
    playerId,
    status,
    team: [],
    activePokemonIndex: 0,
  };
  return {
    ...lobby,
    players: [...lobby.players, newPlayer],
    updatedAt: new Date(),
  };
}

export function updatePlayer(
  lobby: Lobby,
  playerId: string,
  updated: Player,
): Lobby {
  return {
    ...lobby,
    players: lobby.players.map((p) => (p.playerId === playerId ? updated : p)),
    updatedAt: new Date(),
  };
}

export function advanceTurn(lobby: Lobby): Lobby {
  const nextIndex = lobby.currentTurnIndex === 0 ? 1 : 0;
  return { ...lobby, currentTurnIndex: nextIndex, updatedAt: new Date() };
}

export function finishWithWinner(lobby: Lobby, winner: string): Lobby {
  return {
    ...lobby,
    status: LobbyStatus.FINISHED,
    winner,
    updatedAt: new Date(),
  };
}

export function startBattle(
  lobby: Lobby,
  battleId: string,
  firstTurnIndex: number,
  battleStatus: PlayerStatus,
): Lobby {
  return {
    ...lobby,
    status: LobbyStatus.BATTLING,
    battleId,
    currentTurnIndex: firstTurnIndex,
    players: lobby.players.map((p) => ({ ...p, status: battleStatus })),
    updatedAt: new Date(),
  };
}

export function setLobbyStatus(lobby: Lobby, status: LobbyStatus): Lobby {
  return { ...lobby, status, updatedAt: new Date() };
}

export function assignTurnToPlayer(lobby: Lobby, playerIndex: number): Lobby {
  return { ...lobby, currentTurnIndex: playerIndex, updatedAt: new Date() };
}
