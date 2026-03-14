import { BusinessError } from './errors/BusinessError';

export class InvalidInputError extends BusinessError {
  constructor(field: string, reason: string) {
    super('INVALID_INPUT', `${field}: ${reason}`, 400);
  }
}

export function guardNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidInputError(field, 'must be a non-empty string');
  }
}

export function guardNonNegativeInteger(
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new InvalidInputError(field, 'must be a non-negative integer');
  }
}
