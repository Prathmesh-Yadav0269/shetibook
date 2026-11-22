import crypto from 'crypto';
import { getDatabaseClient } from '../../database/client.js';
import {
  hashPassword,
  verifyPassword,
  generateRecoveryCode,
  hashToken,
  generateSessionToken,
} from '../../utils/crypto.js';
import { AppError } from '../../middleware/error.middleware.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class AuthService {
  async register(phoneNumber: string, passwordPlain: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();

    // Check if phone number already exists
    const existing = await client.execute({
      sql: 'SELECT id FROM users WHERE phone_number = ?',
      args: [phoneNumber],
    });

    if (existing.rows.length > 0) {
      throw new AppError('An account with this phone number already exists.', 409, 'PHONE_ALREADY_EXISTS');
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHashed = await hashPassword(passwordPlain);
    const recoveryCodePlain = generateRecoveryCode();
    const recoveryCodeHashed = hashToken(recoveryCodePlain);

    // Insert user
    await client.execute({
      sql: `
        INSERT INTO users (id, phone_number, password_hash, recovery_code_hash, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
      `,
      args: [userId, phoneNumber, passwordHashed, recoveryCodeHashed, now, now],
    });

    // Audit log
    await client.execute({
      sql: `
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
        VALUES (?, ?, 'USER_REGISTERED', 'user', ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        userId,
        userId,
        JSON.stringify({ phoneEnding: phoneNumber.slice(-4) }),
        ip || null,
        userAgent || null,
        now,
      ],
    });

    logger.info('User registered successfully', { userId });

    return {
      userId,
      phoneNumber,
      recoveryCode: recoveryCodePlain, // shown ONCE to user
    };
  }

  async login(phoneNumber: string, passwordPlain: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();

    const userResult = await client.execute({
      sql: 'SELECT id, phone_number, password_hash, status FROM users WHERE phone_number = ?',
      args: [phoneNumber],
    });

    if (userResult.rows.length === 0) {
      // Constant-time-like generic error
      throw new AppError('Invalid phone number or password.', 401, 'INVALID_CREDENTIALS');
    }

    const user = userResult.rows[0];
    if (user.status !== 'active') {
      throw new AppError('Account is inactive or suspended.', 403, 'ACCOUNT_SUSPENDED');
    }

    const validPassword = await verifyPassword(String(user.password_hash), passwordPlain);
    if (!validPassword) {
      throw new AppError('Invalid phone number or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Generate secure session
    const rawSessionToken = generateSessionToken();
    const tokenHash = hashToken(rawSessionToken);
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await client.execute({
      sql: `
        INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [sessionId, String(user.id), tokenHash, expiresAt, now.toISOString()],
    });

    // Audit log
    await client.execute({
      sql: `
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
        VALUES (?, ?, 'USER_LOGIN', 'session', ?, ?, ?, ?)
      `,
      args: [crypto.randomUUID(), String(user.id), sessionId, ip || null, userAgent || null, now.toISOString()],
    });

    // Fetch user groups
    const groupsResult = await client.execute({
      sql: `
        SELECT fg.id, fg.name, gm.role, gm.joined_at
        FROM group_members gm
        JOIN farming_groups fg ON fg.id = gm.group_id
        WHERE gm.user_id = ? AND gm.status = 'active' AND fg.status = 'active'
        ORDER BY fg.created_at ASC
      `,
      args: [String(user.id)],
    });

    return {
      sessionToken: rawSessionToken,
      user: {
        id: String(user.id),
        phoneNumber: String(user.phone_number),
        status: String(user.status),
      },
      groups: groupsResult.rows.map(g => ({
        id: String(g.id),
        name: String(g.name),
        role: String(g.role),
        joinedAt: String(g.joined_at),
      })),
    };
  }

  async logout(sessionId: string, userId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();

    await client.execute({
      sql: 'UPDATE sessions SET revoked_at = ? WHERE id = ?',
      args: [now, sessionId],
    });

    await client.execute({
      sql: `
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
        VALUES (?, ?, 'USER_LOGOUT', 'session', ?, ?, ?, ?)
      `,
      args: [crypto.randomUUID(), userId, sessionId, ip || null, userAgent || null, now],
    });
  }

  async recoverPassword(phoneNumber: string, recoveryCodePlain: string, newPasswordPlain: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();

    const userResult = await client.execute({
      sql: 'SELECT id, recovery_code_hash, status FROM users WHERE phone_number = ?',
      args: [phoneNumber],
    });

    // Generic error to prevent enumeration
    if (userResult.rows.length === 0) {
      throw new AppError('Invalid recovery code or phone number.', 400, 'INVALID_RECOVERY_CREDENTIALS');
    }

    const user = userResult.rows[0];
    const suppliedCodeHash = hashToken(recoveryCodePlain);

    if (String(user.recovery_code_hash) !== suppliedCodeHash) {
      throw new AppError('Invalid recovery code or phone number.', 400, 'INVALID_RECOVERY_CREDENTIALS');
    }

    const now = new Date().toISOString();
    const newPasswordHashed = await hashPassword(newPasswordPlain);
    const newRecoveryCodePlain = generateRecoveryCode();
    const newRecoveryCodeHashed = hashToken(newRecoveryCodePlain);

    // Invalidate all existing sessions for this user
    await client.execute({
      sql: 'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
      args: [now, String(user.id)],
    });

    // Update password and replace recovery code
    await client.execute({
      sql: `
        UPDATE users
        SET password_hash = ?, recovery_code_hash = ?, updated_at = ?
        WHERE id = ?
      `,
      args: [newPasswordHashed, newRecoveryCodeHashed, now, String(user.id)],
    });

    // Audit log
    await client.execute({
      sql: `
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
        VALUES (?, ?, 'PASSWORD_RECOVERED', 'user', ?, ?, ?, ?)
      `,
      args: [crypto.randomUUID(), String(user.id), String(user.id), ip || null, userAgent || null, now],
    });

    logger.info('Password recovered successfully and old sessions invalidated', { userId: String(user.id) });

    return {
      success: true,
      newRecoveryCode: newRecoveryCodePlain, // Shown ONCE to user
    };
  }

  async getMe(userId: string) {
    const client = getDatabaseClient();

    const userResult = await client.execute({
      sql: 'SELECT id, phone_number, status, created_at FROM users WHERE id = ?',
      args: [userId],
    });

    if (userResult.rows.length === 0) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const user = userResult.rows[0];

    const groupsResult = await client.execute({
      sql: `
        SELECT fg.id, fg.name, gm.role, gm.joined_at
        FROM group_members gm
        JOIN farming_groups fg ON fg.id = gm.group_id
        WHERE gm.user_id = ? AND gm.status = 'active' AND fg.status = 'active'
        ORDER BY fg.created_at ASC
      `,
      args: [userId],
    });

    return {
      user: {
        id: String(user.id),
        phoneNumber: String(user.phone_number),
        status: String(user.status),
        createdAt: String(user.created_at),
      },
      groups: groupsResult.rows.map(g => ({
        id: String(g.id),
        name: String(g.name),
        role: String(g.role),
        joinedAt: String(g.joined_at),
      })),
    };
  }
}

export const authService = new AuthService();
