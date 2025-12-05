import { Router } from 'express';

import { getUser } from './getUser.js';
import { updateUser } from './updateUser.js';
import { completeProfile } from './completeProfile.js';
import { checkUsername } from './checkUsername.js';
import { authenticate } from '../../middleware/authenticate.js';

export const usersRouter = Router();

// Public routes
usersRouter.get('/check-username/:username', checkUsername);

// Protected routes
usersRouter.get('/:id', authenticate, getUser);
usersRouter.put('/:id', authenticate, updateUser);
usersRouter.post('/complete-profile', authenticate, completeProfile);
