import mongoose from 'mongoose';
import type { ILogger } from '@core/interfaces/index';

export async function connectToMongo(
  uri: string,
  logger: ILogger,
): Promise<typeof mongoose> {
  logger.info('Connecting to MongoDB...', {
    uri: uri.replace(/\/\/.*@/, '//<credentials>@'),
  });

  const connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  logger.info('MongoDB connected', {
    host: connection.connection.host,
    name: connection.connection.name,
  });

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB connection error', error);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  return connection;
}
