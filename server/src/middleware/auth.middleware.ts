import { Request, Response, NextFunction } from 'express';
import { getDatabaseClient } from '../database/client.js';
import { hashToken } from '../utils/crypto.js';
import { config } from '../config/index.js';
import { AppError } from './error.middleware.js';

export interface AuthenticatedUser {
  id: string;
  phone_number: string;
  status: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      groupMembership?: {
        groupId: string;
        role: 'owner' | 'member';
      };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = req.cookies[config.SESSION_COOKIE_NAME];
    if (!rawToken) {
      throw new AppError('Authentication required. No session cookie provided.', 401, 'UNAUTHORIZED');
    }

    const tokenHash = hashToken(rawToken);
    const client = getDatabaseClient();

    const sessionResult = await client.execute({
      sql: `
        SELECT s.id as session_id, s.user_id, s.expires_at, s.revoked_at,
               u.phone_number, u.status as user_status
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
      `,
      args: [tokenHash],
    });

    if (sessionResult.rows.length === 0) {
      throw new AppError('Invalid or expired session.', 401, 'UNAUTHORIZED');
    }

    const session = sessionResult.rows[0];
    if (session.revoked_at) {
      throw new AppError('Session has been revoked.', 401, 'UNAUTHORIZED');
    }

    const expiresAt = new Date(String(session.expires_at));
    if (expiresAt.getTime() <= Date.now()) {
      throw new AppError('Session has expired.', 401, 'UNAUTHORIZED');
    }

    if (session.user_status !== 'active') {
      throw new AppError('User account is inactive.', 403, 'ACCOUNT_INACTIVE');
    }

    req.user = {
      id: String(session.user_id),
      phone_number: String(session.phone_number),
      status: String(session.user_status),
      sessionId: String(session.session_id),
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireGroupMembership(allowedRoles: ('owner' | 'member')[] = ['owner', 'member']) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const groupId = req.params.groupId || req.body.groupId || req.query.groupId;
      if (!groupId || typeof groupId !== 'string') {
        throw new AppError('Group ID is required.', 400, 'GROUP_ID_REQUIRED');
      }

      const client = getDatabaseClient();
      const memberResult = await client.execute({
        sql: `
          SELECT role, status
          FROM group_members
          WHERE group_id = ? AND user_id = ? AND status = 'active'
        `,
        args: [groupId, req.user.id],
      });

      if (memberResult.rows.length === 0) {
        throw new AppError('You are not an active member of this group.', 403, 'FORBIDDEN_GROUP_ACCESS');
      }

      const member = memberResult.rows[0];
      const role = String(member.role) as 'owner' | 'member';

      if (!allowedRoles.includes(role)) {
        throw new AppError(`Action requires one of the following roles: ${allowedRoles.join(', ')}`, 403, 'INSUFFICIENT_PERMISSIONS');
      }

      req.groupMembership = {
        groupId,
        role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
