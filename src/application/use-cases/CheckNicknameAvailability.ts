import type { ILobbyRepository } from '@core/interfaces/index';
import { LobbyStatus } from '@core/enums/index';

export class CheckNicknameAvailability {
  constructor(private readonly lobbyRepository: ILobbyRepository) {}

  async execute(
    nickname: string,
  ): Promise<{ available: boolean; reason?: string }> {
    const activeLobby = await this.lobbyRepository.findActive();
    if (!activeLobby) return { available: true };

    const isInBattle =
      activeLobby.players.some((p) => p.nickname === nickname) &&
      activeLobby.status === LobbyStatus.BATTLING;

    if (isInBattle) {
      return {
        available: false,
        reason: 'This nickname is currently in a battle. Try a different name.',
      };
    }

    return { available: true };
  }
}
