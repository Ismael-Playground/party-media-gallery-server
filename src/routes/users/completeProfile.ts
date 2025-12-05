import type { Response, NextFunction } from 'express';

import type { AuthenticatedRequest } from '../../middleware/authenticate.js';
import { userService, completeProfileSchema } from '../../services/userService.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * POST /api/v1/users/complete-profile
 * Complete user profile after registration
 */
export async function completeProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const data = completeProfileSchema.parse(req.body);

    // Validate username format
    const validation = userService.validateUsername(data.username);
    if (!validation.valid) {
      sendError(res, validation.error ?? 'Invalid username', { statusCode: 400 });
      return;
    }

    const user = await userService.completeProfile(req.user.id, data);

    sendSuccess(res, { user }, { statusCode: 200, message: 'Profile completed successfully' });
  } catch (error) {
    next(error);
  }
}
