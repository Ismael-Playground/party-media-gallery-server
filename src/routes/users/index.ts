import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { getUser } from './getUser.js';
import { updateUser } from './updateUser.js';
import { completeProfile } from './completeProfile.js';
import { checkUsername } from './checkUsername.js';
import { authenticate } from '../../middleware/authenticate.js';
import { prisma } from '../../config/database.js';
import { sendPaginated } from '../../utils/apiResponse.js';
import { partyService } from '../../services/partyService.js';

export const usersRouter = Router();

// Public routes
usersRouter.get('/check-username/:username', checkUsername);

// Protected routes
usersRouter.get('/:id', authenticate, getUser);
usersRouter.put('/:id', authenticate, updateUser);
usersRouter.post('/complete-profile', authenticate, completeProfile);

/**
 * GET /api/v1/users/:id/parties
 * Get parties hosted by user
 * B2-037
 */
usersRouter.get(
  '/:id/parties',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;

      const { parties, total } = await partyService.listParties({
        hostId: id,
        page,
        limit,
      });

      sendPaginated(res, parties, { page, limit, total });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/users/:id/attending
 * Get parties user is attending
 * B2-038
 */
usersRouter.get(
  '/:id/attending',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const skip = (page - 1) * limit;

      const [attendances, total] = await Promise.all([
        prisma.partyAttendee.findMany({
          where: { userId: id },
          skip,
          take: limit,
          orderBy: { joinedAt: 'desc' },
          include: {
            party: {
              include: {
                host: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
                venue: true,
              },
            },
          },
        }),
        prisma.partyAttendee.count({ where: { userId: id } }),
      ]);

      const parties = attendances.map((a) => ({
        ...a.party,
        role: a.role,
        joinedAt: a.joinedAt,
      }));

      sendPaginated(res, parties, { page, limit, total });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/users/:id/media
 * Get media uploaded by user
 * B2-039
 */
usersRouter.get(
  '/:id/media',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const skip = (page - 1) * limit;

      const [media, total] = await Promise.all([
        prisma.mediaContent.findMany({
          where: { uploaderId: id },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        }),
        prisma.mediaContent.count({ where: { uploaderId: id } }),
      ]);

      sendPaginated(res, media, { page, limit, total });
    } catch (error) {
      next(error);
    }
  }
);
