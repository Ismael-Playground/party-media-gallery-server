import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Response, type Request } from 'express';

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
  followersCount: 0,
  followingCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
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
import { authRouter } from '../src/routes/auth/index.js';

describe('Auth Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRouter);
    app.use(errorHandler);
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    const validRegisterData = {
      firebaseToken: 'valid-firebase-token',
      username: 'newuser',
      firstName: 'New',
      lastName: 'User',
      bio: 'Hello world',
    };

    it('should register a new user successfully', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user).toBeDefined();
    });

    it('should return 409 if user already exists', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid username format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          username: 'ab', // too short
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firebaseToken: 'valid-token',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for username with special characters', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterData,
          username: 'user@name!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login existing user successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ firebaseToken: 'valid-firebase-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ firebaseToken: 'valid-firebase-token' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user profile', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.username).toBe(mockUser.username);
    });

    it('should return 404 if user not found in database', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication Middleware', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid token format', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
