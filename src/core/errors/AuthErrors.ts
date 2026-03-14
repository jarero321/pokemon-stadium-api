import { BusinessError } from './BusinessError';

export class AuthenticationError extends BusinessError {
  constructor(message = 'Invalid or expired token') {
    super('AUTHENTICATION_ERROR', message, 401);
  }
}
