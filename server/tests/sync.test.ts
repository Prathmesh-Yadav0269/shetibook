import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../src/app.js';
import { getDatabaseClient } from '../src/database/client.js';

describe('ShetiBook Phase 4 - Offline Sync & Idempotency Integration Tests', () => {
  const ownerPhone = '9555511111';
  const memberPhone = '9555522222';
  const password = 'SyncPassword123';

  let ownerCookie = '';
  let memberCookie = '';
  let groupId = '';
  let farmId = '';
  let cropId = '';
  const deviceId = 'test-android-device-uuid-1';

  it('Setup: Register owner & member, create farm & crop', async () => {
    // 1. Owner
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: ownerPhone, password, confirmPassword: password });
    const l1 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: ownerPhone, password });
    ownerCookie = (l1.headers['set-cookie'] as unknown as string[])[0];

    // 2. Member
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: memberPhone, password, confirmPassword: password });
    const l2 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: memberPhone, password });
    memberCookie = (l2.headers['set-cookie'] as unknown as string[])[0];

    // Group
    const gRes = await request(app)
      .post('/api/v1/groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ name: 'कदम कृषी परिवार' });
    groupId = gRes.body.data.id;

    // Member joins
    const invRes = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({});
    const token = invRes.body.data.token;

    await request(app)
      .post('/api/v1/groups/join')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({ token });

    // Farm
    const fRes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmName: 'कदम शेत',
        village: 'कदमवाडी',
        areaValue: 3,
        areaUnit: 'acre',
      });
    farmId = fRes.body.data.id;

    // Plot
    const pRes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        plotName: 'प्लॉट १',
        areaValue: 3,
        areaUnit: 'acre',
        cultivationMode: 'separate',
      });
    const plotId = pRes.body.data.id;

    // Crop
    const cRes = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        plotId,
        cropTypeId: 'crop_wheat',
        cropSeasonId: 'season_rabi',
        sowingDate: '2026-11-01',
      });
    cropId = cRes.body.data.id;
  });

  const opId1 = crypto.randomUUID();
  const opId2 = crypto.randomUUID();

  it('1. POST /sync processes queued offline operations and persists records', async () => {
    const operations = [
      {
        clientOperationId: opId1,
        entityType: 'expense',
        operation: 'create',
        payload: {
          farmId,
          expenseCategoryId: 'cat_seeds',
          amountPaise: 250000,
          expenseDate: '2026-11-20',
          description: 'ऑफलाइन बियाणे खरेदी',
        },
        createdAt: '2026-11-20T10:00:00.000Z',
      },
      {
        clientOperationId: opId2,
        entityType: 'harvest',
        operation: 'create',
        payload: {
          farmId,
          cropId,
          harvestDate: '2026-11-21',
          quantity: 12,
          unit: 'quintal',
          notes: 'ऑफलाइन तोडणी नोंद',
        },
        createdAt: '2026-11-21T10:00:00.000Z',
      },
    ];

    const syncRes = await request(app)
      .post(`/api/v1/groups/${groupId}/sync`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        deviceId,
        deviceName: 'Samsung Galaxy F14',
        operations,
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.data.results.length).toBe(2);
    expect(syncRes.body.data.results[0].status).toBe('success');
    expect(syncRes.body.data.results[1].status).toBe('success');

    // Verify records created on server
    const client = getDatabaseClient();
    const expRes = await client.execute({
      sql: 'SELECT id, amount_paise FROM expenses WHERE group_id = ? AND description = ?',
      args: [groupId, 'ऑफलाइन बियाणे खरेदी'],
    });
    expect(expRes.rows.length).toBe(1);
    expect(Number(expRes.rows[0].amount_paise)).toBe(250000);

    const harvRes = await client.execute({
      sql: 'SELECT id, quantity FROM harvests WHERE group_id = ? AND notes = ?',
      args: [groupId, 'ऑफलाइन तोडणी नोंद'],
    });
    expect(harvRes.rows.length).toBe(1);
    expect(Number(harvRes.rows[0].quantity)).toBe(12);
  });

  it('2. Idempotency test: Replaying the same operations does not create duplicate records', async () => {
    // Replay identical operations with same clientOperationId
    const operations = [
      {
        clientOperationId: opId1,
        entityType: 'expense',
        operation: 'create',
        payload: {
          farmId,
          expenseCategoryId: 'cat_seeds',
          amountPaise: 250000,
          expenseDate: '2026-11-20',
        },
        createdAt: '2026-11-20T10:00:00.000Z',
      },
      {
        clientOperationId: opId2,
        entityType: 'harvest',
        operation: 'create',
        payload: {
          farmId,
          cropId,
          harvestDate: '2026-11-21',
          quantity: 12,
          unit: 'quintal',
        },
        createdAt: '2026-11-21T10:00:00.000Z',
      },
    ];

    const replayRes = await request(app)
      .post(`/api/v1/groups/${groupId}/sync`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        deviceId,
        operations,
      });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.data.results.length).toBe(2);
    expect(replayRes.body.data.results[0].status).toBe('success');

    // Confirm strict count: still EXACTLY 1 expense and 1 harvest
    const client = getDatabaseClient();
    const expCount = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM expenses WHERE group_id = ? AND description = ?',
      args: [groupId, 'ऑफलाइन बियाणे खरेदी'],
    });
    expect(Number(expCount.rows[0].count)).toBe(1);

    const harvCount = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM harvests WHERE group_id = ? AND notes = ?',
      args: [groupId, 'ऑफलाइन तोडणी नोंद'],
    });
    expect(Number(harvCount.rows[0].count)).toBe(1);
  });

  it('3. Removed-Member Protection: Synchronizations from removed member are strictly rejected', async () => {
    // Owner removes member from group
    const client = getDatabaseClient();
    await client.execute({
      sql: "UPDATE group_members SET status = 'removed', removed_at = datetime('now') WHERE group_id = ? AND status = 'active' AND role = 'member'",
      args: [groupId],
    });

    // Removed member tries to sync an offline expense
    const syncAttempt = await request(app)
      .post(`/api/v1/groups/${groupId}/sync`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie)
      .send({
        deviceId,
        operations: [
          {
            clientOperationId: crypto.randomUUID(),
            entityType: 'expense',
            operation: 'create',
            payload: {
              farmId,
              expenseCategoryId: 'cat_seeds',
              amountPaise: 990000,
              expenseDate: '2026-11-25',
              description: 'अनधिकृत खर्च (Unauthorized)',
            },
            createdAt: '2026-11-25T10:00:00.000Z',
          },
        ],
      });

    expect(syncAttempt.status).toBe(403);

    // Confirm no unauthorized record was created
    const unauthCheck = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM expenses WHERE description = ?',
      args: ['अनधिकृत खर्च (Unauthorized)'],
    });
    expect(Number(unauthCheck.rows[0].count)).toBe(0);
  });
});
