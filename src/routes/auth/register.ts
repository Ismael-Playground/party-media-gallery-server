import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/database.js';
import { getFirebaseAuth } from '../../config/firebase.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

const registerSchema = z.object({
  firebaseToken: z.string().min(1, 'Firebase token is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  bio: z.string().max(500).optional(),
});

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = registerSchema.parse(req.body);

    // Verify Firebase token
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(data.firebaseToken);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ firebaseId: decodedToken.uid }, { username: data.username }],
      },
    });

    if (existingUser) {
      if (existingUser.firebaseId === decodedToken.uid) {
        throw new AppError('User already registered', 409);
      }
      throw new AppError('Username already taken', 409);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        firebaseId: decodedToken.uid,
        email: decodedToken.email ?? '',
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        bio: data.bio,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    logger.info(`User registered: ${user.username}`);

    sendSuccess(res, { user }, { statusCode: 201, message: 'User registered successfully' });
  } catch (error) {
    next(error);
  }
}
