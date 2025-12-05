import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/database.js';
import { getFirebaseAuth } from '../../config/firebase.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

const loginSchema = z.object({
  firebaseToken: z.string().min(1, 'Firebase token is required'),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);

    // Verify Firebase token
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(data.firebaseToken);

    // Find user
    const user = await prisma.user.findUnique({
      where: { firebaseId: decodedToken.uid },
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
      },
    });

    if (!user) {
      throw new AppError('User not found. Please register first.', 404);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });

    logger.info(`User logged in: ${user.username}`);

    sendSuccess(res, { user }, { message: 'Login successful' });
  } catch (error) {
    next(error);
  }
}
