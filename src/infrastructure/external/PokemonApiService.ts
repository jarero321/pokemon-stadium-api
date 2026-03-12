import type {
  IPokemonApiService,
  PokemonCatalogItem,
  PokemonDetail,
} from '@core/interfaces/index';
import type { ILogger } from '@core/interfaces/index';

interface PokeApiListResponse {
  results: { name: string; url: string }[];
}

interface PokeApiPokemonResponse {
  id: number;
  name: string;
  types: { type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  sprites: { front_default: string };
}

export class PokemonApiService implements IPokemonApiService {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: ILogger,
  ) {}

  async getList(): Promise<PokemonCatalogItem[]> {
    this.logger.debug('Fetching pokemon catalog from PokeAPI');
    const response = await fetch(`${this.baseUrl}/pokemon?limit=151`);
    const data = (await response.json()) as PokeApiListResponse;

    return data.results.map((pokemon, index) => ({
      id: index + 1,
      name: pokemon.name,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${index + 1}.png`,
    }));
  }

  async getById(id: number): Promise<PokemonDetail> {
    const response = await fetch(`${this.baseUrl}/pokemon/${id}`);

    if (!response.ok) {
      throw new Error(`Pokemon with id ${id} not found`);
    }

    const data = (await response.json()) as PokeApiPokemonResponse;
    return this.mapToPokemonDetail(data);
  }

  async getByIds(ids: number[]): Promise<PokemonDetail[]> {
    this.logger.debug('Fetching pokemon details from PokeAPI', { ids });
    return Promise.all(ids.map((id) => this.getById(id)));
  }

  private mapToPokemonDetail(data: PokeApiPokemonResponse): PokemonDetail {
    const statMap = new Map(data.stats.map((s) => [s.stat.name, s.base_stat]));

    return {
      id: data.id,
      name: data.name,
      type: data.types.map((t) => t.type.name),
      hp: statMap.get('hp') ?? 0,
      attack: statMap.get('attack') ?? 0,
      defense: statMap.get('defense') ?? 0,
      speed: statMap.get('speed') ?? 0,
      sprite: data.sprites.front_default,
    };
  }
}
