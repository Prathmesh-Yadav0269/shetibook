import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDatabaseClient } from '../src/database/client.js';
import { randomUUID } from 'crypto';

describe('ShetiBook Phase 1 - Family Management, Concurrency & DB Integrity Tests', () => {
  const ownerPhone = '9123456780';
  const memberPhone = '9123456781';
  const racerPhone = '9123456782';
  const outsiderPhone = '9123456783';
  const password = 'FarmPassword123';

  let ownerCookie = '';
  let memberCookie = '';
  let racerCookie = '';
  let outsiderCookie = '';
  let ownerId = '';
  let memberId = '';
  let racerId = '';
  let groupId = '';
  let inviteToken = '';

  it('Setup: Register 4 users (Owner, Member, Racer, Outsider)', async () => {
    const r1 = await request(app).post('/api/v1/auth/register').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: ownerPhone, password, confirmPassword: password });
    ownerId = r1.body.data.userId;

    const r2 = await request(app).post('/api/v1/auth/register').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: memberPhone, password, confirmPassword: password });
    memberId = r2.body.data.userId;

    const r3 = await request(app).post('/api/v1/auth/register').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: racerPhone, password, confirmPassword: password });
    racerId = r3.body.data.userId;

    await request(app).post('/api/v1/auth/register').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: outsiderPhone, password, confirmPassword: password });

    const l1 = await request(app).post('/api/v1/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: ownerPhone, password });
    ownerCookie = (l1.headers['set-cookie'] as unknown as string[])[0];

    const l2 = await request(app).post('/api/v1/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: memberPhone, password });
    memberCookie = (l2.headers['set-cookie'] as unknown as string[])[0];

    const l3 = await request(app).post('/api/v1/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: racerPhone, password });
    racerCookie = (l3.headers['set-cookie'] as unknown as string[])[0];

    const l4 = await request(app).post('/api/v1/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ phoneNumber: outsiderPhone, password });
    outsiderCookie = (l4.headers['set-cookie'] as unknown as string[])[0];

    expect(ownerCookie).toBeDefined();
    expect(memberCookie).toBeDefined();
    expect(racerCookie).toBeDefined();
    expect(outsiderCookie).toBeDefined();
  });

  it('1. Owner creates farming group and becomes sole active owner', async () => {
    const res = await request(app)
      .post('/api/v1/groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ name: 'यादव कुटुंब शेती (Yadav Farm)' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('यादव कुटुंब शेती (Yadav Farm)');
    expect(res.body.data.role).toBe('owner');
    groupId = res.body.data.id;
  });

  it('2. Enforces database partial unique index: rejects second active owner for same group', async () => {
    const client = getDatabaseClient();
    const duplicateOwnerMemberId = randomUUID();

    // Directly attempting to insert a second active owner member for the same group must fail
    await expect(
      client.execute({
        sql: `INSERT INTO group_members (id, group_id, user_id, role, status)
              VALUES (?, ?, ?, 'owner', 'active')`,
        args: [duplicateOwnerMemberId, groupId, memberId],
      })
    ).rejects.toThrow(/UNIQUE constraint failed|constraint/i);
  });

  it('3. Enforces audit log immutability via database triggers', async () => {
    const client = getDatabaseClient();
    const testAuditId = randomUUID();

    // Insert an audit log record
    await client.execute({
      sql: `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
            VALUES (?, ?, 'TEST_ACTION', 'group', ?, '{}', datetime('now'))`,
      args: [testAuditId, ownerId, groupId],
    });

    // 1. UPDATE must be aborted by trigger trg_audit_logs_no_update
    await expect(
      client.execute({
        sql: `UPDATE audit_logs SET action = 'TAMPERED_ACTION' WHERE id = ?`,
        args: [testAuditId],
      })
    ).rejects.toThrow(/Audit logs are immutable/i);

    // 2. DELETE must be aborted by trigger trg_audit_logs_no_delete
    await expect(
      client.execute({
        sql: `DELETE FROM audit_logs WHERE id = ?`,
        args: [testAuditId],
      })
    ).rejects.toThrow(/Audit logs are immutable/i);
  });

  it('4. Owner creates open invitation token (stored hashed in database)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({}); // Open invitation without pre-specified phone

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    inviteToken = res.body.data.token;

    // Verify token is hashed in DB
    const client = getDatabaseClient();
    const invRow = await client.execute({
      sql: 'SELECT token_hash FROM group_invitations WHERE id = ?',
      args: [res.body.data.invitationId],
    });
    expect(invRow.rows[0].token_hash).not.toBe(inviteToken);
  });

  it('5. Member cannot create invitation (Owner only)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({});

    expect(res.status).toBe(403);
  });

  it('6. Retrieves public invitation info', async () => {
    const res = await request(app).get(`/api/v1/groups/invitations/${inviteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.groupName).toBe('यादव कुटुंब शेती (Yadav Farm)');
    expect(res.body.data.isValid).toBe(true);
  });

  it('7. Concurrency Test: Exactly one concurrent request succeeds in consuming invitation', async () => {
    // Member and Racer concurrently attempt to consume the single-use inviteToken
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/groups/join')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', memberCookie)
        .send({ token: inviteToken }),
      request(app)
        .post('/api/v1/groups/join')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Cookie', racerCookie)
        .send({ token: inviteToken }),
    ]);

    const results = [resA, resB];
    const successes = results.filter((r) => r.status === 200 && r.body.success === true);
    const conflicts = results.filter(
      (r) => r.status === 400 && r.body.error?.code === 'INVITATION_ALREADY_USED'
    );

    // Strict single consumer verification: Exactly 1 success, exactly 1 rejection
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);

    // Verify database state: invitation is marked accepted
    const client = getDatabaseClient();
    const invState = await client.execute({
      sql: 'SELECT status, accepted_by FROM group_invitations WHERE group_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [groupId],
    });
    expect(invState.rows[0].status).toBe('accepted');
    expect(invState.rows[0].accepted_by).toBeDefined();

    // Verify only the winner was added as active member
    const winnerUserId = invState.rows[0].accepted_by;
    const memberCheck = await client.execute({
      sql: `SELECT user_id, role, status FROM group_members WHERE group_id = ? AND status = 'active'`,
      args: [groupId],
    });
    // Owner + 1 Winner = exactly 2 active members
    expect(memberCheck.rows.length).toBe(2);
    expect(memberCheck.rows.some((row) => row.user_id === winnerUserId)).toBe(true);
  });

  it('8. Rejects subsequent attempt to reuse already-accepted invitation', async () => {
    const res = await request(app)
      .post('/api/v1/groups/join')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', outsiderCookie)
      .send({ token: inviteToken });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVITATION_ALREADY_USED');
  });

  it('9. Outsider is forbidden from accessing group details (Cross-group isolation)', async () => {
    const res = await request(app)
      .get(`/api/v1/groups/${groupId}`)
      .set('Cookie', outsiderCookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_GROUP_ACCESS');
  });

  it('10. Owner removes member successfully', async () => {
    const client = getDatabaseClient();
    const members = await client.execute({
      sql: `SELECT user_id FROM group_members WHERE group_id = ? AND role = 'member' AND status = 'active'`,
      args: [groupId],
    });
    const joinedMemberId = String(members.rows[0].user_id);

    const res = await request(app)
      .delete(`/api/v1/groups/${groupId}/members/${joinedMemberId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('11. Group deactivation preserves historical database records', async () => {
    const res = await request(app)
      .delete(`/api/v1/groups/${groupId}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(200);

    const client = getDatabaseClient();
    const groupCheck = await client.execute({
      sql: 'SELECT status FROM farming_groups WHERE id = ?',
      args: [groupId],
    });
    expect(groupCheck.rows[0].status).toBe('deactivated');
  });
});
