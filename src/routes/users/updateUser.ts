import type { Response, NextFunction } from 'express';

import type { AuthenticatedRequest } from '../../middleware/authenticate.js';
import { userService, updateUserSchema } from '../../services/userService.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * PUT /api/v1/users/:id
 * Update user profile
 */
export async function updateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    // Users can only update their own profile
    if (req.user.id !== id) {
      throw new AppError('You can only update your own profile', 403);
    }

    const data = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(id, data);

    sendSuccess(res, { user }, { message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
}
