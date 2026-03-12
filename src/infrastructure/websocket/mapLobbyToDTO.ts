import type { Lobby } from '@core/entities/index';
import type { LobbyDTO } from '@application/dtos/index';
import { PlayerStatus } from '@core/enums/index';

export function mapLobbyToDTO(lobby: Lobby): LobbyDTO {
  return {
    status: lobby.status,
    players: lobby.players.map((player) => ({
      nickname: player.nickname,
      ready:
        player.status === PlayerStatus.READY ||
        player.status === PlayerStatus.BATTLING,
      team: player.team.map((pokemon) => ({
        id: pokemon.id,
        name: pokemon.name,
        type: pokemon.type,
        hp: pokemon.hp,
        maxHp: pokemon.maxHp,
        attack: pokemon.attack,
        defense: pokemon.defense,
        speed: pokemon.speed,
        sprite: pokemon.sprite,
        defeated: pokemon.defeated,
      })),
      activePokemonIndex: player.activePokemonIndex,
    })),
    currentTurnIndex: lobby.currentTurnIndex,
    winner: lobby.winner,
  };
}
