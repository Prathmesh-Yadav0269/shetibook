import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getDatabaseClient } from '../src/database/client.js';

describe('ShetiBook Phase 1 - Family Management & Authorization Tests', () => {
  const ownerPhone = '9123456780';
  const memberPhone = '9123456781';
  const outsiderPhone = '9123456782';
  const password = 'FarmPassword123';

  let ownerCookie = '';
  let memberCookie = '';
  let outsiderCookie = '';
  let ownerId = '';
  let memberId = '';
  let groupId = '';
  let inviteToken = '';

  it('Setup: Register 3 users (Owner, Member, Outsider)', async () => {
    const r1 = await request(app).post('/api/v1/auth/register').send({ phoneNumber: ownerPhone, password, confirmPassword: password });
    ownerId = r1.body.data.userId;

    const r2 = await request(app).post('/api/v1/auth/register').send({ phoneNumber: memberPhone, password, confirmPassword: password });
    memberId = r2.body.data.userId;

    await request(app).post('/api/v1/auth/register').send({ phoneNumber: outsiderPhone, password, confirmPassword: password });

    const l1 = await request(app).post('/api/v1/auth/login').send({ phoneNumber: ownerPhone, password });
    ownerCookie = (l1.headers['set-cookie'] as unknown as string[])[0];

    const l2 = await request(app).post('/api/v1/auth/login').send({ phoneNumber: memberPhone, password });
    memberCookie = (l2.headers['set-cookie'] as unknown as string[])[0];

    const l3 = await request(app).post('/api/v1/auth/login').send({ phoneNumber: outsiderPhone, password });
    outsiderCookie = (l3.headers['set-cookie'] as unknown as string[])[0];

    expect(ownerCookie).toBeDefined();
    expect(memberCookie).toBeDefined();
    expect(outsiderCookie).toBeDefined();
  });

  it('1. Owner creates farming group and becomes owner', async () => {
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Cookie', ownerCookie)
      .send({ name: 'यादव कुटुंब शेती (Yadav Farm)' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('यादव कुटुंब शेती (Yadav Farm)');
    expect(res.body.data.role).toBe('owner');
    groupId = res.body.data.id;
  });

  it('2. Lists groups for owner', async () => {
    const res = await request(app)
      .get('/api/v1/groups')
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((g: { id: string }) => g.id === groupId)).toBe(true);
  });

  it('3. Owner creates invitation token (stored hashed in database)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ intendedPhone: memberPhone });

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

  it('4. Member cannot create invitation (Owner only)', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set('Cookie', memberCookie)
      .send({});

    // Not yet a member of this group
    expect(res.status).toBe(403);
  });

  it('5. Retrieves public invitation info', async () => {
    const res = await request(app).get(`/api/v1/groups/invitations/${inviteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.groupName).toBe('यादव कुटुंब शेती (Yadav Farm)');
    expect(res.body.data.isValid).toBe(true);
  });

  it('6. Rejects acceptance with wrong phone number (intended recipient validation)', async () => {
    const res = await request(app)
      .post('/api/v1/groups/join')
      .set('Cookie', outsiderCookie)
      .send({ token: inviteToken });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PHONE_MISMATCH');
  });

  it('7. Member successfully accepts invitation and joins group', async () => {
    const res = await request(app)
      .post('/api/v1/groups/join')
      .set('Cookie', memberCookie)
      .send({ token: inviteToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('8. Rejects reusing the same invitation (single-use constraint)', async () => {
    const res = await request(app)
      .post('/api/v1/groups/join')
      .set('Cookie', memberCookie)
      .send({ token: inviteToken });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVITATION_ALREADY_USED');
  });

  it('9. Member can now view group details and members list', async () => {
    const res = await request(app)
      .get(`/api/v1/groups/${groupId}`)
      .set('Cookie', memberCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.currentRole).toBe('member');
    expect(res.body.data.members.length).toBe(2);
  });

  it('10. Member cannot remove owner or other members', async () => {
    const res = await request(app)
      .delete(`/api/v1/groups/${groupId}/members/${ownerId}`)
      .set('Cookie', memberCookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('11. Outsider is forbidden from accessing group details (Cross-group isolation)', async () => {
    const res = await request(app)
      .get(`/api/v1/groups/${groupId}`)
      .set('Cookie', outsiderCookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_GROUP_ACCESS');
  });

  it('12. Owner removes member successfully', async () => {
    const res = await request(app)
      .delete(`/api/v1/groups/${groupId}/members/${memberId}`)
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('13. Removed member immediately loses access to the group', async () => {
    const res = await request(app)
      .get(`/api/v1/groups/${groupId}`)
      .set('Cookie', memberCookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_GROUP_ACCESS');
  });

  it('14. Group deactivation preserves historical database records', async () => {
    const res = await request(app)
      .delete(`/api/v1/groups/${groupId}`)
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
