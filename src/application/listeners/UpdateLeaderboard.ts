import type { IPlayerRepository } from '@core/interfaces/index';
import type { ILogger } from '@core/interfaces/index';
import type { IOperationRunner } from '@core/interfaces/index';
import type { BattleFinishedEvent } from '@core/events/index';

export class UpdateLeaderboard {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly logger: ILogger,
    private readonly runner: IOperationRunner,
  ) {}

  async handle(event: BattleFinishedEvent): Promise<void> {
    await this.runner.run(event.correlationId, async (session) => {
      await this.playerRepository.addWin(event.winner, event.battleId, session);
      await this.playerRepository.addLoss(event.loser, event.battleId, session);

      this.logger.info('Leaderboard updated', {
        winner: event.winner,
        loser: event.loser,
        battleId: event.battleId,
        correlationId: event.correlationId,
      });
    });
  }
}
