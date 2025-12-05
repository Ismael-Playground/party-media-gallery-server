import { z } from 'zod';

import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Party Service - Business logic for party operations
 * B2-001 to B2-009: Party CRUD
 */

// Validation schemas
export const createPartySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  isPrivate: z.boolean().default(false),
  maxAttendees: z.number().int().positive().optional(),
  venue: z
    .object({
      name: z.string().min(1).max(200),
      address: z.string().max(500).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      placeId: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export const updatePartySchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isPrivate: z.boolean().optional(),
  maxAttendees: z.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'PLANNED', 'LIVE', 'ENDED', 'CANCELLED']).optional(),
  venue: z
    .object({
      name: z.string().min(1).max(200),
      address: z.string().max(500).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      placeId: z.string().optional(),
    })
    .optional(),
});

export const listPartiesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['DRAFT', 'PLANNED', 'LIVE', 'ENDED', 'CANCELLED']).optional(),
  hostId: z.string().optional(),
  search: z.string().max(100).optional(),
  upcoming: z.coerce.boolean().optional(),
});

export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
export type ListPartiesInput = z.infer<typeof listPartiesSchema>;

// Response types
interface PartyResponse {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  isPrivate: boolean;
  accessCode: string | null;
  maxAttendees: number | null;
  attendeesCount: number;
  createdAt: Date;
  host: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  venue: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  tags: string[];
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const partyService = {
  /**
   * Create a new party
   * B2-001: POST /api/v1/parties
   */
  async createParty(hostId: string, data: CreatePartyInput): Promise<PartyResponse> {
    // Generate access code for private parties
    const accessCode = data.isPrivate ? generateAccessCode() : null;

    const party = await prisma.partyEvent.create({
      data: {
        hostId,
        title: data.title,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        isPrivate: data.isPrivate,
        accessCode,
        maxAttendees: data.maxAttendees,
        status: 'PLANNED',
        venue: data.venue
          ? {
              create: {
                name: data.venue.name,
                address: data.venue.address,
                latitude: data.venue.latitude,
                longitude: data.venue.longitude,
                placeId: data.venue.placeId,
              },
            }
          : undefined,
      },
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
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Add host as attendee
    await prisma.partyAttendee.create({
      data: {
        partyId: party.id,
        userId: hostId,
        role: 'host',
      },
    });

    // Create chat room for party
    await prisma.chatRoom.create({
      data: {
        partyId: party.id,
      },
    });

    // Handle tags if provided
    if (data.tags && data.tags.length > 0) {
      await this.attachTags(party.id, data.tags);
    }

    logger.info(`Party created: ${party.id}`, { hostId, title: data.title });

    return this.formatPartyResponse(party);
  },

  /**
   * Get party by ID
   * B2-002: GET /api/v1/parties/:id
   */
  async getPartyById(partyId: string, userId?: string): Promise<PartyResponse> {
    const party = await prisma.partyEvent.findUnique({
      where: { id: partyId },
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
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    // Check access for private parties
    if (party.isPrivate && party.hostId !== userId) {
      const isAttendee = await prisma.partyAttendee.findUnique({
        where: {
          partyId_userId: {
            partyId,
            userId: userId || '',
          },
        },
      });

      if (!isAttendee) {
        throw new AppError('Access denied to private party', 403);
      }
    }

    return this.formatPartyResponse(party);
  },

  /**
   * Update party
   * B2-003: PUT /api/v1/parties/:id
   */
  async updateParty(
    partyId: string,
    hostId: string,
    data: UpdatePartyInput
  ): Promise<PartyResponse> {
    const party = await prisma.partyEvent.findUnique({
      where: { id: partyId },
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    if (party.hostId !== hostId) {
      throw new AppError('Only the host can update the party', 403);
    }

    const updatedParty = await prisma.partyEvent.update({
      where: { id: partyId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.coverImageUrl && { coverImageUrl: data.coverImageUrl }),
        ...(data.startsAt && { startsAt: new Date(data.startsAt) }),
        ...(data.endsAt && { endsAt: new Date(data.endsAt) }),
        ...(data.isPrivate !== undefined && { isPrivate: data.isPrivate }),
        ...(data.maxAttendees && { maxAttendees: data.maxAttendees }),
        ...(data.status && { status: data.status }),
      },
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
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Update venue if provided
    if (data.venue) {
      await prisma.venue.upsert({
        where: { partyId },
        create: {
          partyId,
          name: data.venue.name,
          address: data.venue.address,
          latitude: data.venue.latitude,
          longitude: data.venue.longitude,
          placeId: data.venue.placeId,
        },
        update: {
          name: data.venue.name,
          address: data.venue.address,
          latitude: data.venue.latitude,
          longitude: data.venue.longitude,
          placeId: data.venue.placeId,
        },
      });
    }

    logger.info(`Party updated: ${partyId}`, { hostId });

    return this.formatPartyResponse(updatedParty);
  },

  /**
   * Delete party
   * B2-004: DELETE /api/v1/parties/:id
   */
  async deleteParty(partyId: string, hostId: string): Promise<void> {
    const party = await prisma.partyEvent.findUnique({
      where: { id: partyId },
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    if (party.hostId !== hostId) {
      throw new AppError('Only the host can delete the party', 403);
    }

    await prisma.partyEvent.delete({
      where: { id: partyId },
    });

    logger.info(`Party deleted: ${partyId}`, { hostId });
  },

  /**
   * List parties with filters
   * B2-005: GET /api/v1/parties
   */
  async listParties(
    filters: ListPartiesInput
  ): Promise<{ parties: PartyResponse[]; total: number }> {
    const { page, limit, status, hostId, search, upcoming } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where['status'] = status;
    }

    if (hostId) {
      where['hostId'] = hostId;
    }

    if (search) {
      where['OR'] = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (upcoming) {
      where['startsAt'] = { gte: new Date() };
      where['status'] = { in: ['PLANNED', 'LIVE'] };
    }

    // Only show public parties or parties where user is host/attendee
    where['isPrivate'] = false;

    const [parties, total] = await Promise.all([
      prisma.partyEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startsAt: 'asc' },
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
          tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
      prisma.partyEvent.count({ where }),
    ]);

    return {
      parties: parties.map((p) => this.formatPartyResponse(p)),
      total,
    };
  },

  /**
   * Join a party
   * B2-006: POST /api/v1/parties/:id/join
   */
  async joinParty(partyId: string, userId: string, accessCode?: string): Promise<void> {
    const party = await prisma.partyEvent.findUnique({
      where: { id: partyId },
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    // Check if private and validate access code
    if (party.isPrivate) {
      if (!accessCode || accessCode !== party.accessCode) {
        throw new AppError('Invalid access code', 403);
      }
    }

    // Check max attendees
    if (party.maxAttendees && party.attendeesCount >= party.maxAttendees) {
      throw new AppError('Party is full', 400);
    }

    // Check if already attending
    const existing = await prisma.partyAttendee.findUnique({
      where: {
        partyId_userId: {
          partyId,
          userId,
        },
      },
    });

    if (existing) {
      throw new AppError('Already attending this party', 400);
    }

    // Add attendee and increment count
    await prisma.$transaction([
      prisma.partyAttendee.create({
        data: {
          partyId,
          userId,
          role: 'guest',
        },
      }),
      prisma.partyEvent.update({
        where: { id: partyId },
        data: { attendeesCount: { increment: 1 } },
      }),
    ]);

    logger.info(`User joined party: ${partyId}`, { userId });
  },

  /**
   * Leave a party
   * B2-007: POST /api/v1/parties/:id/leave
   */
  async leaveParty(partyId: string, userId: string): Promise<void> {
    const party = await prisma.partyEvent.findUnique({
      where: { id: partyId },
    });

    if (!party) {
      throw new AppError('Party not found', 404);
    }

    if (party.hostId === userId) {
      throw new AppError('Host cannot leave the party', 400);
    }

    const attendee = await prisma.partyAttendee.findUnique({
      where: {
        partyId_userId: {
          partyId,
          userId,
        },
      },
    });

    if (!attendee) {
      throw new AppError('Not attending this party', 400);
    }

    // Remove attendee and decrement count
    await prisma.$transaction([
      prisma.partyAttendee.delete({
        where: { id: attendee.id },
      }),
      prisma.partyEvent.update({
        where: { id: partyId },
        data: { attendeesCount: { decrement: 1 } },
      }),
    ]);

    logger.info(`User left party: ${partyId}`, { userId });
  },

  /**
   * Get party attendees
   * B2-008: GET /api/v1/parties/:id/attendees
   */
  async getAttendees(
    partyId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    attendees: Array<{
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      role: string;
      joinedAt: Date;
    }>;
    total: number;
  }> {
    const skip = (page - 1) * limit;

    const [attendees, total] = await Promise.all([
      prisma.partyAttendee.findMany({
        where: { partyId },
        skip,
        take: limit,
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
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
      prisma.partyAttendee.count({ where: { partyId } }),
    ]);

    return {
      attendees: attendees.map((a) => ({
        ...a.user,
        role: a.role,
        joinedAt: a.joinedAt,
      })),
      total,
    };
  },

  /**
   * Join by access code
   * B2-009: POST /api/v1/parties/join-by-code
   */
  async joinByAccessCode(userId: string, accessCode: string): Promise<PartyResponse> {
    const party = await prisma.partyEvent.findUnique({
      where: { accessCode },
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
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!party) {
      throw new AppError('Invalid access code', 404);
    }

    // Check max attendees
    if (party.maxAttendees && party.attendeesCount >= party.maxAttendees) {
      throw new AppError('Party is full', 400);
    }

    // Check if already attending
    const existing = await prisma.partyAttendee.findUnique({
      where: {
        partyId_userId: {
          partyId: party.id,
          userId,
        },
      },
    });

    if (!existing) {
      await prisma.$transaction([
        prisma.partyAttendee.create({
          data: {
            partyId: party.id,
            userId,
            role: 'guest',
          },
        }),
        prisma.partyEvent.update({
          where: { id: party.id },
          data: { attendeesCount: { increment: 1 } },
        }),
      ]);

      logger.info(`User joined party by code: ${party.id}`, { userId });
    }

    return this.formatPartyResponse(party);
  },

  /**
   * Attach tags to party
   */
  async attachTags(partyId: string, tagNames: string[]): Promise<void> {
    for (const name of tagNames) {
      const slug = name.toLowerCase().replace(/\s+/g, '-');

      const tag = await prisma.tag.upsert({
        where: { slug },
        create: { name, slug },
        update: { usageCount: { increment: 1 } },
      });

      await prisma.partyTag.upsert({
        where: {
          partyId_tagId: {
            partyId,
            tagId: tag.id,
          },
        },
        create: {
          partyId,
          tagId: tag.id,
        },
        update: {},
      });
    }
  },

  /**
   * Format party response
   */
  formatPartyResponse(party: {
    id: string;
    title: string;
    description: string | null;
    coverImageUrl: string | null;
    startsAt: Date;
    endsAt: Date | null;
    status: string;
    isPrivate: boolean;
    accessCode: string | null;
    maxAttendees: number | null;
    attendeesCount: number;
    createdAt: Date;
    host: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    venue: {
      name: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null;
    tags?: Array<{ tag: { name: string } }>;
  }): PartyResponse {
    return {
      id: party.id,
      title: party.title,
      description: party.description,
      coverImageUrl: party.coverImageUrl,
      startsAt: party.startsAt,
      endsAt: party.endsAt,
      status: party.status,
      isPrivate: party.isPrivate,
      accessCode: party.isPrivate ? party.accessCode : null,
      maxAttendees: party.maxAttendees,
      attendeesCount: party.attendeesCount,
      createdAt: party.createdAt,
      host: party.host,
      venue: party.venue,
      tags: party.tags?.map((t) => t.tag.name) || [],
    };
  },
};
