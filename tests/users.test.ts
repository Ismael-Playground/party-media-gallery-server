import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Response } from 'express';

import { errorHandler } from '../src/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../src/middleware/authenticate.js';

// Mock data
const mockUser = {
  id: 'user-123',
  firebaseId: 'firebase-uid-123',
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  bio: 'Test bio',
  avatarUrl: null,
  followersCount: 10,
  followingCount: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserProfile = {
  id: mockUser.id,
  email: mockUser.email,
  username: mockUser.username,
  firstName: mockUser.firstName,
  lastName: mockUser.lastName,
  bio: mockUser.bio,
  avatarUrl: mockUser.avatarUrl,
  followersCount: mockUser.followersCount,
  followingCount: mockUser.followingCount,
  createdAt: mockUser.createdAt,
};

// Mock Firebase
vi.mock('../src/config/firebase.js', () => ({
  getFirebaseAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: 'firebase-uid-123',
      email: 'test@example.com',
    }),
  })),
}));

// Mock Prisma
vi.mock('../src/config/database.js', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock authenticate middleware
vi.mock('../src/middleware/authenticate.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/middleware/authenticate.js')>();
  const { AppError } = await import('../src/middleware/errorHandler.js');
  return {
    ...original,
    authenticate: vi.fn((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return next(new AppError('No token provided', 401));
      }
      req.user = {
        id: 'user-123',
        firebaseId: 'firebase-uid-123',
        email: 'test@example.com',
        username: 'testuser',
      };
      next();
    }),
  };
});

// Import mocked modules
import { prisma } from '../src/config/database.js';
import { usersRouter } from '../src/routes/users/index.js';

describe('Users Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/users', usersRouter);
    app.use(errorHandler);

    vi.clearAllMocks();
  });

  describe('GET /api/v1/users/check-username/:username', () => {
    it('should return available for non-existing username', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await request(app).get('/api/v1/users/check-username/newusername');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(true);
      expect(response.body.data.valid).toBe(true);
    });

    it('should return unavailable for existing username', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const response = await request(app).get('/api/v1/users/check-username/testuser');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
    });

    it('should return invalid for username that is too short', async () => {
      const response = await request(app).get('/api/v1/users/check-username/ab');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.error).toContain('at least 3 characters');
    });

    it('should return invalid for username with special characters', async () => {
      const response = await request(app).get('/api/v1/users/check-username/user@name');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
      expect(response.body.data.valid).toBe(false);
    });

    it('should return invalid for reserved usernames', async () => {
      const response = await request(app).get('/api/v1/users/check-username/admin');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.error).toContain('reserved');
    });

    it('should provide suggestion for taken username', async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser) // First call - check availability
        .mockResolvedValue(null); // Subsequent calls - suggestion checks

      const response = await request(app).get('/api/v1/users/check-username/testuser');

      expect(response.status).toBe(200);
      expect(response.body.data.available).toBe(false);
      expect(response.body.data.suggestion).toBeDefined();
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return user by ID', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserProfile);

      const response = await request(app)
        .get(`/api/v1/users/${mockUser.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(mockUser.id);
    });

    it('should return 404 for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/users/nonexistent-id')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get(`/api/v1/users/${mockUser.id}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/users/:id', () => {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
      bio: 'Updated bio',
    };

    it('should update user profile', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUserProfile,
        ...updateData,
      });

      const response = await request(app)
        .put(`/api/v1/users/${mockUser.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
    });

    it('should return 403 when updating another users profile', async () => {
      const response = await request(app)
        .put('/api/v1/users/different-user-id')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('only update your own');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put(`/api/v1/users/${mockUser.id}`)
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate bio length', async () => {
      const response = await request(app)
        .put(`/api/v1/users/${mockUser.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          bio: 'a'.repeat(501), // exceeds 500 char limit
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate avatar URL format', async () => {
      const response = await request(app)
        .put(`/api/v1/users/${mockUser.id}`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          avatarUrl: 'not-a-valid-url',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/users/complete-profile', () => {
    const profileData = {
      username: 'newusername',
      firstName: 'New',
      lastName: 'User',
      bio: 'My new bio',
    };

    it('should complete user profile', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null); // Username not taken
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUserProfile,
        ...profileData,
      });

      const response = await request(app)
        .post('/api/v1/users/complete-profile')
        .set('Authorization', 'Bearer valid-token')
        .send(profileData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile completed successfully');
      expect(response.body.data.user.username).toBe(profileData.username);
    });

    it('should return 409 when username is already taken', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        id: 'different-user-id', // Different user has this username
      });

      const response = await request(app)
        .post('/api/v1/users/complete-profile')
        .set('Authorization', 'Bearer valid-token')
        .send(profileData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already taken');
    });

    it('should allow keeping the same username', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser); // Same user
      vi.mocked(prisma.user.update).mockResolvedValue(mockUserProfile);

      const response = await request(app)
        .post('/api/v1/users/complete-profile')
        .set('Authorization', 'Bearer valid-token')
        .send({
          ...profileData,
          username: mockUser.username,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid username format', async () => {
      const response = await request(app)
        .post('/api/v1/users/complete-profile')
        .set('Authorization', 'Bearer valid-token')
        .send({
          ...profileData,
          username: 'ab', // too short
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/users/complete-profile')
        .set('Authorization', 'Bearer valid-token')
        .send({
          username: 'validusername',
          // missing firstName and lastName
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/v1/users/complete-profile')
        .send(profileData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});

describe('UserService', () => {
  describe('validateUsername', () => {
    // Import the userService for unit testing
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should validate username correctly', async () => {
      const { userService } = await import('../src/services/userService.js');

      // Valid usernames
      expect(userService.validateUsername('validuser').valid).toBe(true);
      expect(userService.validateUsername('User_123').valid).toBe(true);
      expect(userService.validateUsername('abc').valid).toBe(true);

      // Invalid usernames
      expect(userService.validateUsername('ab').valid).toBe(false);
      expect(userService.validateUsername('user@name').valid).toBe(false);
      expect(userService.validateUsername('admin').valid).toBe(false);
      expect(userService.validateUsername('root').valid).toBe(false);
      expect(userService.validateUsername('a'.repeat(31)).valid).toBe(false);
    });
  });
});
