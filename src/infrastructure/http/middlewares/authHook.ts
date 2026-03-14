import type {
  FastifyRequest,
  FastifyReply,
  HookHandlerDoneFunction,
} from 'fastify';
import type { ITokenService } from '@core/interfaces/index';
import { fail } from '../ApiResponse';

export function createAuthHook(tokenService: ITokenService) {
  return function authHook(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction,
  ): void {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      reply
        .status(401)
        .send(
          fail(
            'UNAUTHORIZED',
            'Missing or invalid authorization header',
            request.traceId,
          ),
        );
      return;
    }

    const token = authHeader.slice(7);

    try {
      const payload = tokenService.verify(token);
      request.playerNickname = payload.nickname;
      done();
    } catch {
      reply
        .status(401)
        .send(
          fail('UNAUTHORIZED', 'Invalid or expired token', request.traceId),
        );
    }
  };
}
