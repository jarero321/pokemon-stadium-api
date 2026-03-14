import jwt from 'jsonwebtoken';
import type { ITokenService, TokenPayload } from '@core/interfaces/index';
import { AuthenticationError } from '@core/errors/index';

export class JwtTokenService implements ITokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresInSeconds: number = 86400,
  ) {}

  sign(payload: TokenPayload): string {
    return jwt.sign({ nickname: payload.nickname }, this.secret, {
      expiresIn: this.expiresInSeconds,
    });
  }

  verify(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload;
      return { nickname: decoded.nickname as string };
    } catch {
      throw new AuthenticationError();
    }
  }
}
