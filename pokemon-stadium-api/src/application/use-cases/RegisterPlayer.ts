import type { ILogger } from '@core/interfaces/index';
import type { IPlayerRepository } from '@core/interfaces/index';
import type { PlayerStats } from '@core/entities/index';
import { BusinessError } from '@core/errors/index';

const NICKNAME_MIN_LENGTH = 1;
const NICKNAME_MAX_LENGTH = 20;
const NICKNAME_PATTERN = /^[a-zA-Z0-9_\- ]+$/;

export class InvalidNicknameError extends BusinessError {
  constructor(reason: string) {
    super('INVALID_NICKNAME', reason, 400);
  }
}

export class RegisterPlayer {
  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(
    nickname: string,
  ): Promise<{ player: PlayerStats; isNewPlayer: boolean }> {
    const trimmed = nickname.trim();

    if (trimmed.length < NICKNAME_MIN_LENGTH) {
      throw new InvalidNicknameError('Nickname must be at least 1 character');
    }

    if (trimmed.length > NICKNAME_MAX_LENGTH) {
      throw new InvalidNicknameError('Nickname cannot exceed 20 characters');
    }

    if (!NICKNAME_PATTERN.test(trimmed)) {
      throw new InvalidNicknameError(
        'Nickname can only contain letters, numbers, underscores, hyphens, and spaces',
      );
    }

    const existing = await this.playerRepository.findByNickname(trimmed);

    if (existing) {
      this.logger.info('Returning player registered', {
        nickname: trimmed,
        totalBattles: existing.totalBattles,
      });

      return { player: existing, isNewPlayer: false };
    }

    const newPlayer = await this.playerRepository.upsert({
      nickname: trimmed,
      wins: 0,
      losses: 0,
      totalBattles: 0,
      winRate: 0,
      battleHistory: [],
    });

    this.logger.info('New player registered', { nickname: trimmed });

    return { player: newPlayer, isNewPlayer: true };
  }
}
