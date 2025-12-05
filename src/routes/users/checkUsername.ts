import type { Request, Response, NextFunction } from 'express';

import { userService } from '../../services/userService.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

/**
 * GET /api/v1/users/check-username/:username
 * Check if username is available
 */
export async function checkUsername(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username } = req.params;

    if (!username) {
      sendError(res, 'Username is required', { statusCode: 400 });
      return;
    }

    // Validate username format first
    const validation = userService.validateUsername(username);
    if (!validation.valid) {
      sendSuccess(res, {
        available: false,
        valid: false,
        error: validation.error,
      });
      return;
    }

    // Check availability
    const result = await userService.checkUsernameAvailability(username);

    sendSuccess(res, {
      available: result.available,
      valid: true,
      ...(result.suggestion && { suggestion: result.suggestion }),
    });
  } catch (error) {
    next(error);
  }
}
