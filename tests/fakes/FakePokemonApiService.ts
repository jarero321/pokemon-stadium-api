import type {
  IPokemonApiService,
  PokemonCatalogItem,
  PokemonDetail,
} from '@core/interfaces/index';

const CATALOG: PokemonDetail[] = [
  {
    id: 1,
    name: 'Bulbasaur',
    type: ['Grass', 'Poison'],
    hp: 45,
    attack: 49,
    defense: 49,
    speed: 45,
    sprite: 'https://example.com/1.gif',
  },
  {
    id: 4,
    name: 'Charmander',
    type: ['Fire'],
    hp: 39,
    attack: 52,
    defense: 43,
    speed: 65,
    sprite: 'https://example.com/4.gif',
  },
  {
    id: 7,
    name: 'Squirtle',
    type: ['Water'],
    hp: 44,
    attack: 48,
    defense: 65,
    speed: 43,
    sprite: 'https://example.com/7.gif',
  },
  {
    id: 25,
    name: 'Pikachu',
    type: ['Electric'],
    hp: 35,
    attack: 55,
    defense: 40,
    speed: 90,
    sprite: 'https://example.com/25.gif',
  },
  {
    id: 6,
    name: 'Charizard',
    type: ['Fire', 'Flying'],
    hp: 78,
    attack: 84,
    defense: 78,
    speed: 100,
    sprite: 'https://example.com/6.gif',
  },
  {
    id: 9,
    name: 'Blastoise',
    type: ['Water'],
    hp: 79,
    attack: 83,
    defense: 100,
    speed: 78,
    sprite: 'https://example.com/9.gif',
  },
];

export class FakePokemonApiService implements IPokemonApiService {
  async getList(): Promise<PokemonCatalogItem[]> {
    return CATALOG.map((p) => ({ id: p.id, name: p.name, sprite: p.sprite }));
  }

  async getById(id: number): Promise<PokemonDetail> {
    const pokemon = CATALOG.find((p) => p.id === id);
    if (!pokemon) throw new Error(`Pokemon ${id} not found`);
    return structuredClone(pokemon);
  }

  async getByIds(ids: number[]): Promise<PokemonDetail[]> {
    return Promise.all(ids.map((id) => this.getById(id)));
  }
}
