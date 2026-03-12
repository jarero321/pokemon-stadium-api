import type {
  IPokemonApiService,
  PokemonCatalogItem,
  PokemonDetail,
} from '@core/interfaces/index';
import type { ILogger } from '@core/interfaces/index';

interface ChallengeListResponse {
  success: boolean;
  total: number;
  data: { id: number; name: string; sprite: string }[];
}

interface ChallengeDetailResponse {
  success: boolean;
  data: {
    id: number;
    name: string;
    type: string[];
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    sprite: string;
  };
}

export class PokemonApiService implements IPokemonApiService {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: ILogger,
  ) {}

  async getList(): Promise<PokemonCatalogItem[]> {
    this.logger.debug('Fetching pokemon catalog from challenge API');
    const response = await fetch(`${this.baseUrl}/list`);

    if (!response.ok) {
      throw new Error(`Failed to fetch pokemon list: ${response.status}`);
    }

    const { data } = (await response.json()) as ChallengeListResponse;

    return data.map((pokemon) => ({
      id: pokemon.id,
      name: pokemon.name,
      sprite: pokemon.sprite,
    }));
  }

  async getById(id: number): Promise<PokemonDetail> {
    const response = await fetch(`${this.baseUrl}/list/${id}`);

    if (!response.ok) {
      throw new Error(`Pokemon with id ${id} not found`);
    }

    const { data } = (await response.json()) as ChallengeDetailResponse;

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      hp: data.hp,
      attack: data.attack,
      defense: data.defense,
      speed: data.speed,
      sprite: data.sprite,
    };
  }

  async getByIds(ids: number[]): Promise<PokemonDetail[]> {
    this.logger.debug('Fetching pokemon details from challenge API', { ids });
    return Promise.all(ids.map((id) => this.getById(id)));
  }
}
