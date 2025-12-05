import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate, type AuthenticatedRequest } from '../../middleware/authenticate.js';
import {
  mediaService,
  requestUploadUrlSchema,
  confirmUploadSchema,
  listMediaSchema,
} from '../../services/mediaService.js';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse.js';

export const mediaRouter = Router();

/**
 * POST /api/v1/media/upload-url
 * Request upload URL
 * B2-011
 */
mediaRouter.post(
  '/upload-url',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = requestUploadUrlSchema.parse(req.body);
      const uploadData = await mediaService.requestUploadUrl(req.user!.id, data);

      sendSuccess(res, uploadData, { message: 'Upload URL generated' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/media/confirm
 * Confirm upload and create media record
 * B2-012
 */
mediaRouter.post(
  '/confirm',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = confirmUploadSchema.parse(req.body);
      const media = await mediaService.confirmUpload(req.user!.id, data);

      sendSuccess(res, { media }, { statusCode: 201, message: 'Media uploaded successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/media/:id
 * Get media by ID
 * B2-013
 */
mediaRouter.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id']!;
    const media = await mediaService.getMediaById(id);

    sendSuccess(res, { media });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/media/:id
 * Delete media
 * B2-015
 */
mediaRouter.delete(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      await mediaService.deleteMedia(id, req.user!.id);

      sendSuccess(res, null, { message: 'Media deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/media/:id/like
 * Like media
 * B2-016
 */
mediaRouter.post(
  '/:id/like',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      await mediaService.likeMedia(id, req.user!.id);

      sendSuccess(res, null, { message: 'Media liked' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/media/:id/like
 * Unlike media
 * B2-017
 */
mediaRouter.delete(
  '/:id/like',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      await mediaService.unlikeMedia(id, req.user!.id);

      sendSuccess(res, null, { message: 'Media unliked' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/media/:id/favorite
 * Add to favorites
 */
mediaRouter.post(
  '/:id/favorite',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      await mediaService.addToFavorites(id, req.user!.id);

      sendSuccess(res, null, { message: 'Added to favorites' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/media/:id/favorite
 * Remove from favorites
 */
mediaRouter.delete(
  '/:id/favorite',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id']!;
      await mediaService.removeFromFavorites(id, req.user!.id);

      sendSuccess(res, null, { message: 'Removed from favorites' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/media/favorites
 * Get user favorites
 */
mediaRouter.get(
  '/user/favorites',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;

      const { media, total } = await mediaService.getUserFavorites(req.user!.id, page, limit);

      sendPaginated(res, media, { page, limit, total });
    } catch (error) {
      next(error);
    }
  }
);
