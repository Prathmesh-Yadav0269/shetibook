import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  recoverPasswordSchema,
} from '../../validators/auth.validator.js';
import { config } from '../../config/index.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await authService.register(
        validated.phoneNumber,
        validated.password,
        req.ip,
        req.headers['user-agent']
      );

      res.status(201).json({
        success: true,
        data: {
          userId: result.userId,
          phoneNumber: result.phoneNumber,
          recoveryCode: result.recoveryCode,
          message: 'Account created successfully. Please store your recovery code securely.',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await authService.login(
        validated.phoneNumber,
        validated.password,
        req.ip,
        req.headers['user-agent']
      );

      // Set secure HTTP-only cookie with configured SameSite & Secure policies
      res.cookie(config.SESSION_COOKIE_NAME, result.sessionToken, {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: config.COOKIE_SAME_SITE,
        maxAge: config.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          groups: result.groups,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await authService.logout(
          req.user.sessionId,
          req.user.id,
          req.ip,
          req.headers['user-agent']
        );
      }

      res.clearCookie(config.SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: config.COOKIE_SAME_SITE,
        path: '/',
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully.',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
        return;
      }

      const result = await authService.getMe(req.user.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async recoverPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = recoverPasswordSchema.parse(req.body);
      const result = await authService.recoverPassword(
        validated.phoneNumber,
        validated.recoveryCode,
        validated.newPassword,
        req.ip,
        req.headers['user-agent']
      );

      // Clear any session cookie since old sessions were invalidated
      res.clearCookie(config.SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: config.COOKIE_SAME_SITE,
        path: '/',
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Password successfully reset. Please log in with your new password.',
          newRecoveryCode: result.newRecoveryCode,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
