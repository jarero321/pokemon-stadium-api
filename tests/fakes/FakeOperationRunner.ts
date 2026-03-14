import type {
  IOperationRunner,
  TransactionSession,
} from '@core/interfaces/index';

export class FakeOperationRunner implements IOperationRunner {
  async run<T>(
    _requestId: string,
    work: (session: TransactionSession) => Promise<T>,
  ): Promise<T> {
    return work(undefined);
  }
}
