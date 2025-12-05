import { z } from 'zod';

import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { storageService } from './storageService.js';

/**
 * Media Service - Business logic for media operations
 * B2-011 to B2-017: Media endpoints
 */

// Validation schemas
export const requestUploadUrlSchema = z.object({
  partyId: z.string().min(1, 'Party ID is required'),
  mediaType: z.enum(['PHOTO', 'VIDEO', 'AUDIO']),
  contentType: z.string().min(1, 'Content type is required'),
  fileName: z.string().optional(),
});

export const confirmUploadSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  partyId: z.string().min(1, 'Party ID is required'),
  mediaType: z.enum(['PHOTO', 'VIDEO', 'AUDIO']),
  mood: z.enum(['HYPE', 'CHILL', 'WILD', 'ROMANTIC', 'CRAZY', 'ELEGANT']).optional(),
  caption: z.string().max(500).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().int().positive().optional(),
});

export const listMediaSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  mediaType: z.enum(['PHOTO', 'VIDEO', 'AUDIO']).optional(),
  mood: z.enum(['HYPE', 'CHILL', 'WILD', 'ROMANTIC', 'CRAZY', 'ELEGANT']).optional(),
  uploaderId: z.string().optional(),
});

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
export type ListMediaInput = z.infer<typeof listMediaSchema>;

// Response types
interface MediaResponse {
  id: string;
  partyId: string;
  type: string;
  url: string;
  thumbnailUrl: string | null;
  mood: string | null;
  caption: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  likesCount: number;
  viewsCount: number;
  createdAt: Date;
  uploader: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export const mediaService = {
  /**
   * Request upload URL for media
   * B2-011: POST /api/v1/media/upload-url
   */
  async requestUploadUrl(
    userId: string,
    data: RequestUploadUrlInput
  ): Promise<{
    uploadUrl: string;
    downloadUrl: string;
    filePath: string;
    expiresAt: Date;
  }> {
    // Verify party exists and user is attendee
    const party = await prisma.partyEvent.findUnique({
      where: { id: data.partyId },
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    // Check if user is attendee
    const attendee = await prisma.partyAttendee.findUnique({
      where: {
        partyId_userId: {
          partyId: data.partyId,
          userId,
        },
      },
    });

    if (!attendee) {
      throw new AppError('You must be attending the party to upload media', 403);
    }

    // Generate upload URL
    const uploadData = await storageService.generateUploadUrl(
      userId,
      data.partyId,
      data.mediaType,
      data.contentType
    );

    logger.info(`Upload URL generated`, { userId, partyId: data.partyId, mediaType: data.mediaType });

    return uploadData;
  },

  /**
   * Confirm upload and create media record
   * B2-012: POST /api/v1/media/confirm
   */
  async confirmUpload(userId: string, data: ConfirmUploadInput): Promise<MediaResponse> {
    // Verify file was uploaded
    const metadata = await storageService.confirmUpload(data.filePath);

    if (!metadata) {
      throw new AppError('File not found. Upload may have failed.', 400);
    }

    // Verify party exists
    const party = await prisma.partyEvent.findUnique({
      where: { id: data.partyId },
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    // Create media record
    const thumbnailUrl = storageService.getThumbnailPath(data.filePath);

    const media = await prisma.mediaContent.create({
      data: {
        partyId: data.partyId,
        uploaderId: userId,
        type: data.mediaType,
        url: data.filePath,
        thumbnailUrl,
        mood: data.mood,
        caption: data.caption,
        width: data.width,
        height: data.height,
        duration: data.duration,
        fileSize: metadata.size,
        mimeType: metadata.contentType,
      },
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
    });

    logger.info(`Media confirmed: ${media.id}`, { userId, partyId: data.partyId });

    return this.formatMediaResponse(media);
  },

  /**
   * Get media by ID
   * B2-013: GET /api/v1/media/:id
   */
  async getMediaById(mediaId: string): Promise<MediaResponse> {
    const media = await prisma.mediaContent.findUnique({
      where: { id: mediaId },
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
    });

    if (!media) {
      throw new AppError('Media not found', 404);
    }

    // Increment view count
    await prisma.mediaContent.update({
      where: { id: mediaId },
      data: { viewsCount: { increment: 1 } },
    });

    return this.formatMediaResponse(media);
  },

  /**
   * Get party media
   * B2-014: GET /api/v1/parties/:id/media
   */
  async getPartyMedia(
    partyId: string,
    filters: ListMediaInput
  ): Promise<{ media: MediaResponse[]; total: number }> {
    const { page, limit, mediaType, mood, uploaderId } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { partyId };

    if (mediaType) {
      where['type'] = mediaType;
    }

    if (mood) {
      where['mood'] = mood;
    }

    if (uploaderId) {
      where['uploaderId'] = uploaderId;
    }

    const [media, total] = await Promise.all([
      prisma.mediaContent.findMany({
        where,
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
      prisma.mediaContent.count({ where }),
    ]);

    return {
      media: media.map((m) => this.formatMediaResponse(m)),
      total,
    };
  },

  /**
   * Delete media
   * B2-015: DELETE /api/v1/media/:id
   */
  async deleteMedia(mediaId: string, userId: string): Promise<void> {
    const media = await prisma.mediaContent.findUnique({
      where: { id: mediaId },
      include: {
        party: {
          select: { hostId: true },
        },
      },
    });

    if (!media) {
      throw new AppError('Media not found', 404);
    }

    // Only uploader or party host can delete
    if (media.uploaderId !== userId && media.party.hostId !== userId) {
      throw new AppError('Not authorized to delete this media', 403);
    }

    // Delete from storage
    await storageService.deleteMedia(media.url);

    // Delete thumbnail if exists
    if (media.thumbnailUrl) {
      await storageService.deleteMedia(media.thumbnailUrl);
    }

    // Delete from database
    await prisma.mediaContent.delete({
      where: { id: mediaId },
    });

    logger.info(`Media deleted: ${mediaId}`, { userId });
  },

  /**
   * Like media
   * B2-016: POST /api/v1/media/:id/like
   */
  async likeMedia(mediaId: string, userId: string): Promise<void> {
    const media = await prisma.mediaContent.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new AppError('Media not found', 404);
    }

    // Check if already liked
    const existingLike = await prisma.mediaLike.findUnique({
      where: {
        mediaId_userId: {
          mediaId,
          userId,
        },
      },
    });

    if (existingLike) {
      throw new AppError('Already liked this media', 400);
    }

    // Create like and increment count
    await prisma.$transaction([
      prisma.mediaLike.create({
        data: {
          mediaId,
          userId,
        },
      }),
      prisma.mediaContent.update({
        where: { id: mediaId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);

    logger.info(`Media liked: ${mediaId}`, { userId });
  },

  /**
   * Unlike media
   * B2-017: DELETE /api/v1/media/:id/like
   */
  async unlikeMedia(mediaId: string, userId: string): Promise<void> {
    const like = await prisma.mediaLike.findUnique({
      where: {
        mediaId_userId: {
          mediaId,
          userId,
        },
      },
    });

    if (!like) {
      throw new AppError('Like not found', 404);
    }

    // Delete like and decrement count
    await prisma.$transaction([
      prisma.mediaLike.delete({
        where: { id: like.id },
      }),
      prisma.mediaContent.update({
        where: { id: mediaId },
        data: { likesCount: { decrement: 1 } },
      }),
    ]);

    logger.info(`Media unliked: ${mediaId}`, { userId });
  },

  /**
   * Add media to favorites
   */
  async addToFavorites(mediaId: string, userId: string): Promise<void> {
    const media = await prisma.mediaContent.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new AppError('Media not found', 404);
    }

    const existingFavorite = await prisma.mediaFavorite.findUnique({
      where: {
        mediaId_userId: {
          mediaId,
          userId,
        },
      },
    });

    if (existingFavorite) {
      throw new AppError('Already in favorites', 400);
    }

    await prisma.mediaFavorite.create({
      data: {
        mediaId,
        userId,
      },
    });

    logger.info(`Media added to favorites: ${mediaId}`, { userId });
  },

  /**
   * Remove from favorites
   */
  async removeFromFavorites(mediaId: string, userId: string): Promise<void> {
    const favorite = await prisma.mediaFavorite.findUnique({
      where: {
        mediaId_userId: {
          mediaId,
          userId,
        },
      },
    });

    if (!favorite) {
      throw new AppError('Not in favorites', 404);
    }

    await prisma.mediaFavorite.delete({
      where: { id: favorite.id },
    });

    logger.info(`Media removed from favorites: ${mediaId}`, { userId });
  },

  /**
   * Get user favorites
   */
  async getUserFavorites(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ media: MediaResponse[]; total: number }> {
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      prisma.mediaFavorite.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          media: {
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
          },
        },
      }),
      prisma.mediaFavorite.count({ where: { userId } }),
    ]);

    return {
      media: favorites.map((f) => this.formatMediaResponse(f.media)),
      total,
    };
  },

  /**
   * Format media response
   */
  formatMediaResponse(media: {
    id: string;
    partyId: string;
    type: string;
    url: string;
    thumbnailUrl: string | null;
    mood: string | null;
    caption: string | null;
    duration: number | null;
    width: number | null;
    height: number | null;
    likesCount: number;
    viewsCount: number;
    createdAt: Date;
    uploader: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  }): MediaResponse {
    return {
      id: media.id,
      partyId: media.partyId,
      type: media.type,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      mood: media.mood,
      caption: media.caption,
      duration: media.duration,
      width: media.width,
      height: media.height,
      likesCount: media.likesCount,
      viewsCount: media.viewsCount,
      createdAt: media.createdAt,
      uploader: media.uploader,
    };
  },
};
