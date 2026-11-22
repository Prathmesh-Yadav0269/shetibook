import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { AppError } from './error.middleware.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF and Origin Protection Middleware
 * 1. Validates Origin/Referer for state-changing requests against CLIENT_ORIGIN.
 * 2. Requires custom header (X-Requested-With: XMLHttpRequest or X-CSRF-Protection)
 *    to prevent cross-origin form submissions.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // Safe read-only HTTP methods do not mutate state
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Bypass during test suite if explicitly configured
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-bypass-csrf'] === 'true') {
    return next();
  }

  // 1. Origin / Referer Validation
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  if (origin) {
    if (origin !== config.CLIENT_ORIGIN) {
      return next(new AppError('Forbidden: Cross-origin request not permitted by CSRF policy.', 403, 'CSRF_ORIGIN_INVALID'));
    }
  } else if (referer && config.isProduction) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (refererOrigin !== config.CLIENT_ORIGIN) {
        return next(new AppError('Forbidden: Request referer does not match permitted origin.', 403, 'CSRF_ORIGIN_INVALID'));
      }
    } catch {
      return next(new AppError('Forbidden: Malformed referer header.', 403, 'CSRF_ORIGIN_INVALID'));
    }
  }

  // 2. Custom Header Verification (Defense-in-Depth against simple cross-site requests)
  const xRequestedWith = req.headers['x-requested-with'];
  const xCsrfProtection = req.headers['x-csrf-protection'];

  if (!xRequestedWith && !xCsrfProtection) {
    return next(new AppError('Forbidden: Missing required custom anti-CSRF request header.', 403, 'CSRF_HEADER_MISSING'));
  }

  next();
}
