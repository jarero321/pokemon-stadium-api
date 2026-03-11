import type { Socket } from 'socket.io';
import { BusinessError } from '@core/errors/BusinessError';
import type { ILogger } from '@core/interfaces/index';
import { ServerEvent } from './SocketEvents';

type AsyncHandler<T = unknown> = (data: T) => Promise<void>;

export function withErrorBoundary<T = unknown>(
  socket: Socket,
  logger: ILogger,
  handler: AsyncHandler<T>,
): (data: T) => Promise<void> {
  return async (data: T) => {
    try {
      await handler(data);
    } catch (error) {
      if (error instanceof BusinessError) {
        socket.emit(ServerEvent.ERROR, {
          code: error.code,
          message: error.message,
        });
        logger.warn('Business error in socket handler', {
          code: error.code,
          message: error.message,
        });
      } else {
        socket.emit(ServerEvent.ERROR, {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        });
        logger.error(
          'Unexpected error in socket handler',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  };
}
