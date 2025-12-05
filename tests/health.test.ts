import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

import { healthRouter } from '../src/routes/health.js';

// Mock dependencies
vi.mock('../src/config/database.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('../src/config/redis.js', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
}));

describe('Health Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use('/health', healthRouter);
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status when database is connected', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services.database).toBe('connected');
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alive).toBe(true);
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status when database is available', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ready).toBe(true);
    });
  });
});
