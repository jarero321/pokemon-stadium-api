import type { ILogger } from '@core/interfaces/index';
import type { ILobbyRepository } from '@core/interfaces/index';
import type { IPokemonApiService } from '@core/interfaces/index';
import type { Lobby } from '@core/entities/index';
import type { Pokemon } from '@core/entities/index';
import { PlayerStatus } from '@core/enums/index';
import {
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  InvalidPlayerStatusError,
} from '@core/errors/index';
import { updatePlayer } from '@core/operations/lobby';
import { assignTeam, setStatus } from '@core/operations/player';

const TEAM_SIZE = 3;

function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class AssignPokemon {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly pokemonApi: IPokemonApiService,
    private readonly logger: ILogger,
  ) {}

  async execute(playerId: string): Promise<Lobby> {
    const lobby = await this.lobbyRepository.findActive();
    if (!lobby) throw new LobbyNotFoundError();

    const requestingPlayer = lobby.players.find(
      (player) => player.playerId === playerId,
    );
    if (!requestingPlayer) throw new PlayerNotInLobbyError();

    if (requestingPlayer.status !== PlayerStatus.JOINED) {
      throw new InvalidPlayerStatusError(
        PlayerStatus.JOINED,
        requestingPlayer.status,
      );
    }

    const fullCatalog = await this.pokemonApi.getList();

    const alreadyAssignedIds = lobby.players.flatMap((player) =>
      player.team.map((pokemon) => pokemon.id),
    );
    const availablePokemon = fullCatalog.filter(
      (pokemon) => !alreadyAssignedIds.includes(pokemon.id),
    );

    const shuffledAvailablePokemon = fisherYatesShuffle(availablePokemon);
    const randomlySelectedPokemon = shuffledAvailablePokemon.slice(
      0,
      TEAM_SIZE,
    );

    const selectedPokemonDetails = await this.pokemonApi.getByIds(
      randomlySelectedPokemon.map((pokemon) => pokemon.id),
    );

    const team: Pokemon[] = selectedPokemonDetails.map(
      (pokemonDetail): Pokemon => ({
        id: pokemonDetail.id,
        name: pokemonDetail.name,
        type: pokemonDetail.type,
        hp: pokemonDetail.hp,
        maxHp: pokemonDetail.hp,
        attack: pokemonDetail.attack,
        defense: pokemonDetail.defense,
        speed: pokemonDetail.speed,
        sprite: pokemonDetail.sprite,
        defeated: false,
      }),
    );

    let updatedPlayer = assignTeam(requestingPlayer, team);
    updatedPlayer = setStatus(updatedPlayer, PlayerStatus.TEAM_ASSIGNED);

    const updatedLobby = updatePlayer(lobby, playerId, updatedPlayer);
    const persistedLobby = await this.lobbyRepository.update(updatedLobby);

    this.logger.info('Pokemon team assigned', {
      nickname: requestingPlayer.nickname,
      team: team.map((pokemon) => pokemon.name),
    });

    return persistedLobby;
  }
}
