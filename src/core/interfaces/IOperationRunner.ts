export type TransactionSession = unknown;

export interface OperationResult<T> {
  readonly result: T;
  readonly fromCache: boolean;
}

export interface IOperationRunner {
  run<T>(
    requestId: string,
    work: (session: TransactionSession) => Promise<T>,
  ): Promise<OperationResult<T>>;
}
