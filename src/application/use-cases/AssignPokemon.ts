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

const TEAM_SIZE = 3;

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

    const shuffledAvailablePokemon = availablePokemon.sort(
      () => Math.random() - 0.5,
    );
    const randomlySelectedPokemon = shuffledAvailablePokemon.slice(
      0,
      TEAM_SIZE,
    );

    const selectedPokemonDetails = await this.pokemonApi.getByIds(
      randomlySelectedPokemon.map((pokemon) => pokemon.id),
    );

    requestingPlayer.team = selectedPokemonDetails.map(
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

    requestingPlayer.activePokemonIndex = 0;
    requestingPlayer.status = PlayerStatus.TEAM_ASSIGNED;
    lobby.updatedAt = new Date();

    const updatedLobby = await this.lobbyRepository.update(lobby);

    this.logger.info('Pokemon team assigned', {
      nickname: requestingPlayer.nickname,
      team: requestingPlayer.team.map((pokemon) => pokemon.name),
    });

    return updatedLobby;
  }
}
