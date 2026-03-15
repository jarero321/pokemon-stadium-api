export interface Pokemon {
  readonly id: number;
  readonly name: string;
  readonly type: readonly string[];
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly sprite: string;
  readonly defeated: boolean;
}
