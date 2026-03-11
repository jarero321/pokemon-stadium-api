import type { ILogger } from '#core/interfaces/index.js';
import type {
  IPokemonApiService,
  PokemonCatalogItem,
} from '#core/interfaces/index.js';

export class GetPokemonCatalog {
  constructor(
    private readonly pokemonApi: IPokemonApiService,
    private readonly logger: ILogger,
  ) {}

  async execute(): Promise<PokemonCatalogItem[]> {
    this.logger.info('Fetching pokemon catalog');
    const catalog = await this.pokemonApi.getList();
    this.logger.info('Pokemon catalog fetched', {
      count: catalog.length,
    });
    return catalog;
  }
}
