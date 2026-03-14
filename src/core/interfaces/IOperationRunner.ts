export type TransactionSession = unknown;

export interface IOperationRunner {
  run<T>(
    requestId: string,
    work: (session: TransactionSession) => Promise<T>,
  ): Promise<T>;
}
