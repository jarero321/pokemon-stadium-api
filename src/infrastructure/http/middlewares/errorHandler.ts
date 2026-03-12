import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { BusinessError } from '@core/errors/BusinessError';
import { fail } from '../ApiResponse';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const traceId = request.traceId;

  if (error instanceof BusinessError) {
    reply.status(400).send(fail(error.code, error.message, traceId));
    return;
  }

  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message;

  reply
    .status(error.statusCode ?? 500)
    .send(fail('INTERNAL_ERROR', message, traceId));
}
