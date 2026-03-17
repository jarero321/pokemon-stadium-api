import type { ILobbyRepository } from '@core/interfaces/index';

export class CheckNicknameAvailability {
  constructor(private readonly lobbyRepository: ILobbyRepository) {}

  async execute(
    nickname: string,
  ): Promise<{ available: boolean; reason?: string }> {
    const activeLobby = await this.lobbyRepository.findActive();
    if (!activeLobby) return { available: true };

    const isInLobby = activeLobby.players.some((p) => p.nickname === nickname);

    if (isInLobby) {
      return {
        available: false,
        reason:
          'This nickname is currently in a lobby or battle. Try a different name.',
      };
    }

    return { available: true };
  }
}
