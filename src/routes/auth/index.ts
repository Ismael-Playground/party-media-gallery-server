import { Router } from 'express';

import { register } from './register.js';
import { login } from './login.js';
import { me } from './me.js';
import { authenticate } from '../../middleware/authenticate.js';

export const authRouter = Router();

// Public routes
authRouter.post('/register', register);
authRouter.post('/login', login);

// Protected routes
authRouter.get('/me', authenticate, me);
