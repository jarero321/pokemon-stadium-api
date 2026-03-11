export enum ClientEvent {
  JOIN_LOBBY = 'join_lobby',
  ASSIGN_POKEMON = 'assign_pokemon',
  READY = 'ready',
  ATTACK = 'attack',
  SWITCH_POKEMON = 'switch_pokemon',
}

export enum ServerEvent {
  LOBBY_STATUS = 'lobby_status',
  BATTLE_START = 'battle_start',
  TURN_RESULT = 'turn_result',
  POKEMON_DEFEATED = 'pokemon_defeated',
  POKEMON_SWITCH = 'pokemon_switch',
  BATTLE_END = 'battle_end',
  ERROR = 'error',
}
