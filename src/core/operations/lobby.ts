import type { Lobby } from '@core/entities/index';
import type { Player } from '@core/entities/index';
import type { LobbyStatus } from '@core/enums/index';

export function addPlayer(
  lobby: Lobby,
  nickname: string,
  playerId: string,
  status: import('@core/enums/PlayerStatus').PlayerStatus,
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
    status: 'finished' as LobbyStatus,
    winner,
    updatedAt: new Date(),
  };
}

export function startBattle(
  lobby: Lobby,
  battleId: string,
  firstTurnIndex: number,
  battleStatus: import('@core/enums/PlayerStatus').PlayerStatus,
): Lobby {
  return {
    ...lobby,
    status: 'battling' as LobbyStatus,
    battleId,
    currentTurnIndex: firstTurnIndex,
    players: lobby.players.map((p) => ({ ...p, status: battleStatus })),
    updatedAt: new Date(),
  };
}

export function setLobbyStatus(lobby: Lobby, status: LobbyStatus): Lobby {
  return { ...lobby, status, updatedAt: new Date() };
}
