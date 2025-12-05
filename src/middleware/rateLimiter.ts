import type { Request, Response, NextFunction } from 'express';

import { sendError } from '../utils/apiResponse.js';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // requests per window

export function rateLimiter(req: Request, res: Response, next: NextFunction): void | Response {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();

  // Initialize or reset if window expired
  if (!store[ip] || now > store[ip].resetTime) {
    store[ip] = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    return next();
  }

  // Increment request count
  store[ip].count++;

  // Check if over limit
  if (store[ip].count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((store[ip].resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', store[ip].resetTime.toString());

    return sendError(res, 'Too many requests, please try again later', {
      statusCode: 429,
    });
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', (MAX_REQUESTS - store[ip].count).toString());
  res.setHeader('X-RateLimit-Reset', store[ip].resetTime.toString());

  next();
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    const entry = store[key];
    if (entry && entry.resetTime < now) {
      delete store[key];
    }
  }
}, WINDOW_MS);
