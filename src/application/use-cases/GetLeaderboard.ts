import type { IPlayerRepository } from '@core/interfaces/index';
import type { ILogger } from '@core/interfaces/index';
import type { PlayerStats } from '@core/entities/index';

export class GetLeaderboard {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(limit: number = 10): Promise<PlayerStats[]> {
    this.logger.debug('Fetching leaderboard', { limit });
    return this.playerRepository.getLeaderboard(limit);
  }
}
