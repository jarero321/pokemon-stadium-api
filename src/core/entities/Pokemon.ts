export interface Pokemon {
  id: number;
  name: string;
  type: string[];
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  sprite: string;
  defeated: boolean;
}
