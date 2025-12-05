import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate, type AuthenticatedRequest } from '../../middleware/authenticate.js';
import {
  partyService,
  createPartySchema,
  updatePartySchema,
  listPartiesSchema,
} from '../../services/partyService.js';
import { mediaService, listMediaSchema } from '../../services/mediaService.js';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse.js';

export const partiesRouter = Router();

/**
 * GET /api/v1/parties
 * List parties with filters
 * B2-005
 */
partiesRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = listPartiesSchema.parse(req.query);
    const { parties, total } = await partyService.listParties(filters);

    sendPaginated(res, parties, {
      page: filters.page,
      limit: filters.limit,
      total,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/parties
 * Create a new party
 * B2-001
 */
partiesRouter.post(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createPartySchema.parse(req.body);
      const party = await partyService.createParty(req.user!.id, data);

      sendSuccess(res, { party }, { statusCode: 201, message: 'Party created successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/parties/:id
 * Get party by ID
 * B2-002
 */
partiesRouter.get(
  '/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      const userId = req.user?.id;
      const party = await partyService.getPartyById(id, userId);

      sendSuccess(res, { party });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/parties/:id
 * Update party
 * B2-003
 */
partiesRouter.put(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      const data = updatePartySchema.parse(req.body);
      const party = await partyService.updateParty(id, req.user!.id, data);

      sendSuccess(res, { party }, { message: 'Party updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/parties/:id
 * Delete party
 * B2-004
 */
partiesRouter.delete(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      await partyService.deleteParty(id, req.user!.id);

      sendSuccess(res, null, { message: 'Party deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/parties/:id/join
 * Join a party
 * B2-006
 */
partiesRouter.post(
  '/:id/join',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      const { accessCode } = req.body;
      await partyService.joinParty(id, req.user!.id, accessCode);

      sendSuccess(res, null, { message: 'Joined party successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/parties/:id/leave
 * Leave a party
 * B2-007
 */
partiesRouter.post(
  '/:id/leave',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      await partyService.leaveParty(id, req.user!.id);

      sendSuccess(res, null, { message: 'Left party successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/parties/:id/attendees
 * Get party attendees
 * B2-008
 */
partiesRouter.get(
  '/:id/attendees',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;

      const { attendees, total } = await partyService.getAttendees(id, page, limit);

      sendPaginated(res, attendees, { page, limit, total });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/parties/join-by-code
 * Join party by access code
 * B2-009
 */
partiesRouter.post(
  '/join-by-code',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accessCode } = req.body;

      if (!accessCode) {
        res.status(400).json({ success: false, message: 'Access code is required' });
        return;
      }

      const party = await partyService.joinByAccessCode(req.user!.id, accessCode);

      sendSuccess(res, { party }, { message: 'Joined party successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/parties/:id/media
 * Get party media
 * B2-014
 */
partiesRouter.get(
  '/:id/media',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      const filters = listMediaSchema.parse(req.query);
      const { media, total } = await mediaService.getPartyMedia(id, filters);

      sendPaginated(res, media, {
        page: filters.page,
        limit: filters.limit,
        total,
      });
    } catch (error) {
      next(error);
    }
  }
);
