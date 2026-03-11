import type { Player } from '../entities/Player.js';

export interface IPlayerRepository {
  findByNickname(nickname: string): Promise<Player | null>;
  upsert(player: Player): Promise<Player>;
}
