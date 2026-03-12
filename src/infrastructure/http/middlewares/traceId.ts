import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const TRACE_HEADER = 'x-trace-id';

export function traceIdHook(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
): void {
  const traceId =
    (request.headers[TRACE_HEADER] as string | undefined) ?? randomUUID();

  request.traceId = traceId;
  reply.header(TRACE_HEADER, traceId);

  done();
}
