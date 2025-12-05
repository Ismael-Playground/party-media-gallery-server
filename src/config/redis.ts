import { Redis } from 'ioredis';

import { env } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    logger.warn('Redis URL not configured, caching disabled');
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number): number {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  client.on('connect', () => {
    logger.info('✅ Redis connected successfully');
  });

  client.on('error', (error: Error) => {
    logger.error('❌ Redis error:', error);
  });

  redisClient = client;
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}
