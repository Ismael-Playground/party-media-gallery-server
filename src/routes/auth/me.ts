import type { Response, NextFunction } from 'express';

import { prisma } from '../../config/database.js';
import type { AuthenticatedRequest } from '../../middleware/authenticate.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../middleware/errorHandler.js';

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatarUrl: true,
        followersCount: true,
        followingCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
}
