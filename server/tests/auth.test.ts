import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDatabaseClient } from '../src/database/client.js';
import { hashToken } from '../src/utils/crypto.js';

describe('ShetiBook Phase 1 - Authentication Tests', () => {
  const validPhone = '9876543210';
  const validPassword = 'FarmPassword123';
  let recoveryCode = '';
  let sessionCookie = '';

  it('1. Rejects invalid phone number registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: '12345',
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('2. Rejects weak password registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: validPhone,
        password: 'weak',
        confirmPassword: 'weak',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('3. Successfully registers account, returns recovery code once, hashes password with Argon2id', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: validPhone,
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phoneNumber).toBe(validPhone);
    expect(res.body.data.recoveryCode).toBeDefined();
    expect(res.body.data.recoveryCode).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    recoveryCode = res.body.data.recoveryCode;

    // Verify database record has Argon2id password hash and hashed recovery code
    const client = getDatabaseClient();
    const dbUser = await client.execute({
      sql: 'SELECT password_hash, recovery_code_hash FROM users WHERE phone_number = ?',
      args: [validPhone],
    });

    expect(dbUser.rows.length).toBe(1);
    const storedHash = String(dbUser.rows[0].password_hash);
    expect(storedHash.startsWith('$argon2id$')).toBe(true);
    expect(String(dbUser.rows[0].recovery_code_hash)).toBe(hashToken(recoveryCode));
  });

  it('4. Rejects duplicate phone number registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phoneNumber: validPhone,
        password: validPassword,
        confirmPassword: validPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PHONE_ALREADY_EXISTS');
  });

  it('5. Rejects incorrect password login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: validPhone,
        password: 'WrongPassword123',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('6. Successful login sets HTTP-only session cookie and creates hashed session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
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

  it('7. Accesses protected /me endpoint with valid session', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.phoneNumber).toBe(validPhone);
  });

  it('8. Rejects protected endpoint without session cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('9. Rejects password recovery with invalid recovery code', async () => {
    const res = await request(app)
      .post('/api/v1/auth/recover-password')
      .send({
        phoneNumber: validPhone,
        recoveryCode: 'WRONG-CODE',
        newPassword: 'NewPassword999',
        confirmPassword: 'NewPassword999',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_RECOVERY_CREDENTIALS');
  });

  it('10. Successfully recovers password, invalidates old sessions and issues new recovery code', async () => {
    const res = await request(app)
      .post('/api/v1/auth/recover-password')
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
    expect(newRecoveryCode).not.toBe(recoveryCode);

    // Old session should now be rejected as revoked
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie);

    expect(meRes.status).toBe(401);

    // Old recovery code must no longer work
    const retryOld = await request(app)
      .post('/api/v1/auth/recover-password')
      .send({
        phoneNumber: validPhone,
        recoveryCode: recoveryCode,
        newPassword: 'AnotherPassword123',
        confirmPassword: 'AnotherPassword123',
      });

    expect(retryOld.status).toBe(400);

    // Can log in with new password
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: validPhone,
        password: 'NewPassword999',
      });

    expect(loginRes.status).toBe(200);
  });

  it('11. Logout revokes session', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        phoneNumber: validPhone,
        password: 'NewPassword999',
      });

    const activeCookie = (loginRes.headers['set-cookie'] as unknown as string[])[0];

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', activeCookie);

    expect(logoutRes.status).toBe(200);

    // Session is now revoked
    const checkRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', activeCookie);

    expect(checkRes.status).toBe(401);
  });
});
