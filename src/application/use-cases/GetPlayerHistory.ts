import type { IBattleRepository } from '@core/interfaces/index';
import type { IPlayerRepository } from '@core/interfaces/index';
import type { ILogger } from '@core/interfaces/index';
import type { Battle, PlayerStats } from '@core/entities/index';

interface PlayerHistoryResult {
  stats: PlayerStats;
  battles: Battle[];
}

export class GetPlayerHistory {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly battleRepository: IBattleRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(nickname: string): Promise<PlayerHistoryResult | null> {
    const stats = await this.playerRepository.findByNickname(nickname);
    if (!stats) return null;

    const battles = await this.battleRepository.findByPlayer(nickname);

    this.logger.debug('Player history fetched', {
      nickname,
      totalBattles: battles.length,
    });

    return { stats, battles };
  }
}
