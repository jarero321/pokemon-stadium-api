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

export interface PokemonDefeatedDTO {
  owner: string;
  pokemon: string;
  defeatedBy: string;
  remainingTeam: number;
}

export interface PokemonSwitchDTO {
  player: string;
  previousPokemon: string;
  newPokemon: string;
  newPokemonHp: number;
  newPokemonMaxHp: number;
}

export interface BattleEndDTO {
  winner: string;
  loser: string;
  battleId: string;
}
