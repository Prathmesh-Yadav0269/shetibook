import { Router } from 'express';
import { authController } from './auth.routes.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, (req, res, next) => authController.register(req, res, next));
authRouter.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
authRouter.post('/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));
authRouter.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));
authRouter.post('/recover-password', authLimiter, (req, res, next) => authController.recoverPassword(req, res, next));
