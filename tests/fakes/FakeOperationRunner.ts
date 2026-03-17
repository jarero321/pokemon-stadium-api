import type {
  IOperationRunner,
  OperationResult,
  TransactionSession,
} from '@core/interfaces/index';

export class FakeOperationRunner implements IOperationRunner {
  async run<T>(
    _requestId: string,
    work: (session: TransactionSession) => Promise<T>,
  ): Promise<OperationResult<T>> {
    const result = await work(undefined);
    return { result, fromCache: false };
  }
}
