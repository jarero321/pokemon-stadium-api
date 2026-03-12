export interface PokemonCatalogItem {
  id: number;
  name: string;
  sprite: string;
}

export interface PokemonDetail {
  id: number;
  name: string;
  type: string[];
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  sprite: string;
}

export interface IPokemonApiService {
  getList(): Promise<PokemonCatalogItem[]>;
  getById(id: number): Promise<PokemonDetail>;
  getByIds(ids: number[]): Promise<PokemonDetail[]>;
}
