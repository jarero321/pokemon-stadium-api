import type {
  IPokemonApiService,
  PokemonCatalogItem,
  PokemonDetail,
} from '@core/interfaces/index';
import type { ILogger } from '@core/interfaces/index';
import { PokemonCacheModel } from '@infrastructure/database/mongo/schemas/PokemonCacheSchema';

export class CachedPokemonApiService implements IPokemonApiService {
  constructor(
    private readonly externalApi: IPokemonApiService,
    private readonly logger: ILogger,
  ) {}

  async getList(): Promise<PokemonCatalogItem[]> {
    const cachedCount = await PokemonCacheModel.countDocuments();

    if (cachedCount > 0) {
      this.logger.debug('Returning pokemon catalog from MongoDB cache', {
        cachedCount,
      });
      const cached = await PokemonCacheModel.find()
        .sort({ pokedexId: 1 })
        .lean();
      return cached.map((doc) => ({
        id: doc.pokedexId,
        name: doc.name,
        sprite: doc.sprite,
      }));
    }

    this.logger.info(
      'Pokemon catalog not in cache, fetching from external API...',
    );
    const catalog = await this.externalApi.getList();

    const details = await this.externalApi.getByIds(catalog.map((p) => p.id));
    await this.persistDetails(details);

    this.logger.info('Pokemon catalog persisted to MongoDB', {
      count: details.length,
    });
    return catalog;
  }

  async getById(id: number): Promise<PokemonDetail> {
    const cached = await PokemonCacheModel.findOne({ pokedexId: id }).lean();

    if (cached) {
      return {
        id: cached.pokedexId,
        name: cached.name,
        type: cached.type,
        hp: cached.hp,
        attack: cached.attack,
        defense: cached.defense,
        speed: cached.speed,
        sprite: cached.sprite,
      };
    }

    this.logger.debug('Pokemon not in cache, fetching from API', { id });
    const detail = await this.externalApi.getById(id);
    await this.persistDetails([detail]);
    return detail;
  }

  async getByIds(ids: number[]): Promise<PokemonDetail[]> {
    const cached = await PokemonCacheModel.find({
      pokedexId: { $in: ids },
    }).lean();
    const cachedMap = new Map(cached.map((doc) => [doc.pokedexId, doc]));

    const results: PokemonDetail[] = [];
    const missingIds: number[] = [];

    for (const id of ids) {
      const doc = cachedMap.get(id);
      if (doc) {
        results.push({
          id: doc.pokedexId,
          name: doc.name,
          type: doc.type,
          hp: doc.hp,
          attack: doc.attack,
          defense: doc.defense,
          speed: doc.speed,
          sprite: doc.sprite,
        });
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      this.logger.debug('Fetching missing pokemon from API', { missingIds });
      const fetched = await this.externalApi.getByIds(missingIds);
      await this.persistDetails(fetched);
      results.push(...fetched);
    }

    return ids.map((id) => results.find((r) => r.id === id)!);
  }

  private async persistDetails(details: PokemonDetail[]): Promise<void> {
    const operations = details.map((detail) => ({
      updateOne: {
        filter: { pokedexId: detail.id },
        update: {
          $set: {
            pokedexId: detail.id,
            name: detail.name,
            type: detail.type,
            hp: detail.hp,
            attack: detail.attack,
            defense: detail.defense,
            speed: detail.speed,
            sprite: detail.sprite,
          },
        },
        upsert: true,
      },
    }));

    await PokemonCacheModel.bulkWrite(operations);
  }
}
