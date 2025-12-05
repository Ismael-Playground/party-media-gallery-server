import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { logger } from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public errors?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  logger.error('Error caught by handler:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    return sendError(res, 'Validation error', {
      statusCode: 400,
      errors,
    });
  }

  // Custom app errors
  if (err instanceof AppError) {
    return sendError(res, err.message, {
      statusCode: err.statusCode,
      errors: err.errors,
    });
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    return sendError(res, 'Database error', { statusCode: 400 });
  }

  // Default error
  return sendError(res, 'Internal server error', { statusCode: 500 });
}
