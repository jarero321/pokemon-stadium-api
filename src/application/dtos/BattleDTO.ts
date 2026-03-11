export interface TurnResultDTO {
  turnNumber: number;
  attacker: {
    nickname: string;
    pokemon: string;
    attack: number;
  };
  defender: {
    nickname: string;
    pokemon: string;
    defense: number;
    remainingHp: number;
    maxHp: number;
  };
  damage: number;
  typeMultiplier: number;
  defeated: boolean;
  nextPokemon: string | null;
  timestamp: Date;
}

export interface BattleEndDTO {
  winner: string;
  loser: string;
  battleId: string;
}
