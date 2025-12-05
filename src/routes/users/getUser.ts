import type { Request, Response, NextFunction } from 'express';

import { userService } from '../../services/userService.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * GET /api/v1/users/:id
 * Get user by ID
 */
export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, message: 'User ID is required' });
      return;
    }

    const user = await userService.getUserById(id);

    sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
}
