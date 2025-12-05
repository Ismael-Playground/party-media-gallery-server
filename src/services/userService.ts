import { z } from 'zod';

import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { UserProfile } from '../types/models.js';

// Validation schemas
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

export const completeProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

/**
 * User Service - Business logic for user operations
 */
export const userService = {
  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      throw new AppError('User not found', 404);
    }

    return user;
  },

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { username },
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
      throw new AppError('User not found', 404);
    }

    return user;
  },

  /**
   * Update user profile
   */
  async updateUser(userId: string, data: UpdateUserInput): Promise<UserProfile> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      },
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

    return user;
  },

  /**
   * Complete user profile (after registration)
   */
  async completeProfile(userId: string, data: CompleteProfileInput): Promise<UserProfile> {
    // Check if username is already taken
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new AppError('Username already taken', 409);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
      },
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

    return user;
  },

  /**
   * Check if username is available
   */
  async checkUsernameAvailability(
    username: string
  ): Promise<{ available: boolean; suggestion?: string }> {
    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!existingUser) {
      return { available: true };
    }

    // Generate suggestion
    const baseUsername = username.replace(/\d+$/, '');
    let suggestion = '';
    for (let i = 1; i <= 10; i++) {
      const candidateUsername = `${baseUsername}${Math.floor(Math.random() * 1000)}`;
      const candidate = await prisma.user.findUnique({
        where: { username: candidateUsername },
        select: { id: true },
      });
      if (!candidate) {
        suggestion = candidateUsername;
        break;
      }
    }

    return { available: false, suggestion: suggestion || undefined };
  },

  /**
   * Validate username format
   */
  validateUsername(username: string): { valid: boolean; error?: string } {
    if (username.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }
    if (username.length > 30) {
      return { valid: false, error: 'Username must be at most 30 characters' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return {
        valid: false,
        error: 'Username can only contain letters, numbers, and underscores',
      };
    }

    // Reserved usernames
    const reserved = ['admin', 'root', 'system', 'support', 'help', 'api', 'www'];
    if (reserved.includes(username.toLowerCase())) {
      return { valid: false, error: 'This username is reserved' };
    }

    return { valid: true };
  },
};
