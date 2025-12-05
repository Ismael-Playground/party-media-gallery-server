import type { Request, Response, NextFunction } from 'express';

import { logger } from '../utils/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    const level = statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
  });

  next();
}
