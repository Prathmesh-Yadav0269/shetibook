import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

const isTest = process.env.NODE_ENV === 'test';

export const globalLimiter = isTest
  ? (_req: Request, _res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests from this IP, please try again later.',
        },
      },
    });

export const authLimiter = isTest
  ? (_req: Request, _res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.AUTH_RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts. Please try again after 15 minutes.',
        },
      },
    });
