import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { authService } from '../auth/auth.service.js';

export const usersRouter = Router();

usersRouter.get('/profile', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
      return;
    }
    const profile = await authService.getMe(req.user.id);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});
