import { describe, it, expect, beforeEach } from 'vitest';
import {
  RegisterPlayer,
  InvalidNicknameError,
} from '@application/use-cases/RegisterPlayer';
import {
  FakePlayerRepository,
  FakeTokenService,
  SilentLogger,
} from './fakes/index';

describe('RegisterPlayer', () => {
  let playerRepo: FakePlayerRepository;
  let registerPlayer: RegisterPlayer;

  beforeEach(() => {
    playerRepo = new FakePlayerRepository();
    registerPlayer = new RegisterPlayer(
      playerRepo,
      new FakeTokenService(),
      new SilentLogger(),
    );
  });

  it('should register a new player', async () => {
    const result = await registerPlayer.execute('Ash');

    expect(result.isNewPlayer).toBe(true);
    expect(result.player.nickname).toBe('Ash');
    expect(result.player.wins).toBe(0);
    expect(result.player.losses).toBe(0);
    expect(result.player.totalBattles).toBe(0);
  });

  it('should return existing player without creating duplicate', async () => {
    await registerPlayer.execute('Ash');
    const result = await registerPlayer.execute('Ash');

    expect(result.isNewPlayer).toBe(false);
    expect(result.player.nickname).toBe('Ash');
  });

  it('should trim whitespace from nickname', async () => {
    const result = await registerPlayer.execute('  Ash  ');

    expect(result.player.nickname).toBe('Ash');
  });

  it('should reject empty nickname', async () => {
    await expect(registerPlayer.execute('')).rejects.toThrowError(
      InvalidNicknameError,
    );
  });

  it('should reject nickname with only spaces', async () => {
    await expect(registerPlayer.execute('   ')).rejects.toThrowError(
      InvalidNicknameError,
    );
  });

  it('should reject nickname exceeding 20 characters', async () => {
    const longName = 'A'.repeat(21);
    await expect(registerPlayer.execute(longName)).rejects.toThrowError(
      InvalidNicknameError,
    );
  });

  it('should reject nickname with special characters', async () => {
    await expect(registerPlayer.execute('Ash@#$')).rejects.toThrowError(
      InvalidNicknameError,
    );
  });

  it('should allow nickname with underscores, hyphens, and spaces', async () => {
    const result = await registerPlayer.execute('Ash_Ketchum-01 Go');

    expect(result.isNewPlayer).toBe(true);
    expect(result.player.nickname).toBe('Ash_Ketchum-01 Go');
  });
});
