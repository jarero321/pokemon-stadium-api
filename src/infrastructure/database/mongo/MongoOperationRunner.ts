import mongoose from 'mongoose';
import type {
  IOperationRunner,
  OperationResult,
  TransactionSession,
} from '@core/interfaces/index';
import type { ILogger } from '@core/interfaces/index';
import { IdempotencyModel } from './schemas/IdempotencySchema';

export class MongoOperationRunner implements IOperationRunner {
  constructor(private readonly logger: ILogger) {}

  async run<T>(
    requestId: string,
    work: (session: TransactionSession) => Promise<T>,
  ): Promise<OperationResult<T>> {
    const cached = await IdempotencyModel.findOne({ requestId }).lean();
    if (cached) {
      this.logger.debug(
        'Idempotent request detected, returning cached result',
        { requestId },
      );
      return { result: cached.result as T, fromCache: true };
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const result = await work(session);

      await IdempotencyModel.create([{ requestId, result }], { session });

      await session.commitTransaction();

      this.logger.debug('Transaction committed', { requestId });

      return { result, fromCache: false };
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Transaction aborted', error as Error, { requestId });
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
