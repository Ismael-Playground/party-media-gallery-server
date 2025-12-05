import type { Request, Response, NextFunction } from 'express';

import { getFirebaseAuth } from '../config/firebase.js';
import { prisma } from '../config/database.js';
import { AppError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    firebaseId: string;
    email: string;
    username: string;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7);

    // Verify Firebase token
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(token);

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { firebaseId: decodedToken.uid },
      select: {
        id: true,
        firebaseId: true,
        email: true,
        username: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.error('Authentication error:', error);
    next(new AppError('Invalid or expired token', 401));
  }
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  authenticate(req, _res, next).catch(next);
}
