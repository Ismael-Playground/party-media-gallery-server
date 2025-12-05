import { Router, type Request, type Response } from 'express';

import { prisma } from '../config/database.js';
import { getRedisClient } from '../config/redis.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected' | 'disabled';
  };
}

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Check database
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    // Check Redis
    let redisStatus: 'connected' | 'disconnected' | 'disabled' = 'disabled';
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.ping();
        redisStatus = 'connected';
      } catch {
        redisStatus = 'disconnected';
      }
    }

    const overallStatus: HealthStatus['status'] =
      dbStatus === 'connected'
        ? redisStatus === 'disconnected'
          ? 'degraded'
          : 'healthy'
        : 'unhealthy';

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };

    if (overallStatus === 'unhealthy') {
      return sendError(res, 'Service unhealthy', { statusCode: 503 });
    }

    return sendSuccess(res, health);
  } catch (error) {
    return sendError(res, 'Health check failed', { statusCode: 500 });
  }
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendSuccess(res, { ready: true });
  } catch {
    return sendError(res, 'Service not ready', { statusCode: 503 });
  }
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  return sendSuccess(res, { alive: true });
});
