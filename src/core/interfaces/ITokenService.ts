export interface TokenPayload {
  nickname: string;
}

export interface ITokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
