import type { ITokenService, TokenPayload } from '@core/interfaces/index';

export class FakeTokenService implements ITokenService {
  sign(payload: TokenPayload): string {
    return `fake-token-${payload.nickname}`;
  }

  verify(token: string): TokenPayload {
    const nickname = token.replace('fake-token-', '');
    return { nickname };
  }
}
