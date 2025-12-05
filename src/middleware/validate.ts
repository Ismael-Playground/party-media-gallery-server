import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';

import { sendError } from '../utils/apiResponse.js';

type RequestPart = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodSchema<T>, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));

      return sendError(res, 'Validation error', {
        statusCode: 400,
        errors,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    req[part] = result.data as typeof req[typeof part];
    next();
  };
}
