import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDatabaseClient } from '../src/database/client.js';
import { verifyRecoverySecret } from '../src/utils/crypto.js';

describe('ShetiBook Phase 1 - Authentication & Security Tests', () => {
  const validPhone = '9876543210';
  const validPassword = 'FarmPassword123';
  let recoveryCode = '';
  let sessionCookie = '';

  it('1. CSRF Protection: Rejects state-changing request without anti-CSRF custom header', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: '12345',
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CSRF_HEADER_MISSING');
  });

  it('2. CSRF Protection: Rejects request with forbidden cross-origin Origin header', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Origin', 'https://malicious-attacker.com')
      .send({
        phoneNumber: '12345',
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CSRF_ORIGIN_INVALID');
  });

  it('3. Rejects invalid phone number registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: '12345',
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('4. Rejects weak password registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        password: 'weak',
        confirmPassword: 'weak',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('5. Successfully registers account, returns 128-bit recovery secret once, hashes password and recovery secret with Argon2id', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phoneNumber).toBe(validPhone);
    expect(res.body.data.recoveryCode).toBeDefined();

    // 128-bit randomness formatted as 8 groups of 4 hex digits (32 hex characters total)
    expect(res.body.data.recoveryCode).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
    recoveryCode = res.body.data.recoveryCode;

    // Verify database record has Argon2id password hash and Argon2id recovery secret hash
    const client = getDatabaseClient();
    const dbUser = await client.execute({
      sql: 'SELECT password_hash, recovery_code_hash FROM users WHERE phone_number = ?',
      args: [validPhone],
    });

    expect(dbUser.rows.length).toBe(1);
    const storedPwHash = String(dbUser.rows[0].password_hash);
    const storedRecoveryHash = String(dbUser.rows[0].recovery_code_hash);

    expect(storedPwHash.startsWith('$argon2id$')).toBe(true);
    expect(storedRecoveryHash.startsWith('$argon2id$')).toBe(true);

    // Verify recovery secret verifies using peppered Argon2id (hash, secret)
    const isValid = await verifyRecoverySecret(storedRecoveryHash, recoveryCode);
    expect(isValid).toBe(true);
  });

  it('6. Rejects duplicate phone number registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
  });

  it('7. Rejects incorrect password login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        password: 'WrongPassword123',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('8. Successful login sets HTTP-only session cookie and creates hashed session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        password: validPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.phoneNumber).toBe(validPhone);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('sb_session=') && c.includes('HttpOnly'))).toBe(true);
    sessionCookie = cookies[0];
  });

  it('9. Accesses protected /me endpoint with valid session', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.phoneNumber).toBe(validPhone);
  });

  it('10. Rejects protected endpoint without session cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('11. Account enumeration resistance: Non-existent phone returns identical error without leaking user existence', async () => {
    const res = await request(app)
      .post('/api/v1/auth/recover-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: '9000000000',
        recoveryCode: 'A1B2-C3D4-E5F6-7890-1234-5678-9ABC-DEF0',
        newPassword: 'NewPassword999',
        confirmPassword: 'NewPassword999',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_RECOVERY_CREDENTIALS');
  });

  it('12. Rejects password recovery with invalid recovery secret for existing user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/recover-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        recoveryCode: '0000-0000-0000-0000-0000-0000-0000-0000',
        newPassword: 'NewPassword999',
        confirmPassword: 'NewPassword999',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_RECOVERY_CREDENTIALS');
  });

  it('13. Successfully recovers password with 128-bit secret, invalidates old sessions and issues new 128-bit secret', async () => {
    const res = await request(app)
      .post('/api/v1/auth/recover-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        recoveryCode: recoveryCode,
        newPassword: 'NewPassword999',
        confirmPassword: 'NewPassword999',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.newRecoveryCode).toBeDefined();
    const newRecoveryCode = res.body.data.newRecoveryCode;
    expect(newRecoveryCode).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
    expect(newRecoveryCode).not.toBe(recoveryCode);

    // Old session should now be rejected as revoked
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie);

    expect(meRes.status).toBe(401);

    // Old recovery code must no longer work
    const retryOld = await request(app)
      .post('/api/v1/auth/recover-password')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        recoveryCode: recoveryCode,
        newPassword: 'AnotherPassword123',
        confirmPassword: 'AnotherPassword123',
      });

    expect(retryOld.status).toBe(400);
    expect(retryOld.body.error.code).toBe('INVALID_RECOVERY_CREDENTIALS');

    // Can log in with new password
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        password: 'NewPassword999',
      });

    expect(loginRes.status).toBe(200);
  });

  it('14. Logout revokes session', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        phoneNumber: validPhone,
        password: 'NewPassword999',
      });

    const activeCookie = (loginRes.headers['set-cookie'] as unknown as string[])[0];

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', activeCookie);

    expect(logoutRes.status).toBe(200);

    // Session is now revoked
    const checkRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', activeCookie);

    expect(checkRes.status).toBe(401);
  });
});
