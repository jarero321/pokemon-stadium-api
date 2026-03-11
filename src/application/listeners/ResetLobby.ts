import type { ILobbyRepository } from '#core/interfaces/index.js';
import type { ILogger } from '#core/interfaces/index.js';
import type { BattleFinishedEvent } from '#core/events/index.js';

export class ResetLobby {
  constructor(
    private readonly lobbyRepository: ILobbyRepository,
    private readonly logger: ILogger,
  ) {}

  async handle(event: BattleFinishedEvent): Promise<void> {
    await this.lobbyRepository.reset();

    this.logger.info('Lobby reset after battle', {
      battleId: event.battleId,
      correlationId: event.correlationId,
    });
  }
}
