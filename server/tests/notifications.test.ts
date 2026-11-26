import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { NotificationService } from '../src/modules/notifications/notification.service.js';
import { getDatabaseClient } from '../src/database/client.js';

describe('ShetiBook Phase 4 - Notifications & Reminders Integration Tests', () => {
  const ownerPhone = '9666611111';
  const memberPhone = '9666622222';
  const outsiderPhone = '9666633333';
  const password = 'NotifPassword123';

  let ownerCookie = '';
  let memberCookie = '';
  let outsiderCookie = '';
  let groupId = '';
  let farmId = '';
  let plotId = '';
  let cropId = '';
  let activityId = '';
  const notificationService = new NotificationService();

  it('Setup: Register 3 users, create group, add member, setup farm, crop & activity', async () => {
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

    // 3. Outsider
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: outsiderPhone, password, confirmPassword: password });
    const l3 = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ phoneNumber: outsiderPhone, password });
    outsiderCookie = (l3.headers['set-cookie'] as unknown as string[])[0];

    // Group
    const gRes = await request(app)
      .post('/api/v1/groups')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ name: 'जाधव शेती गट' });
    groupId = gRes.body.data.id;

    // Invite & join member
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

    // Farm & plot & crop
    const fRes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmName: 'जाधव मळा',
        village: 'नायगाव',
        areaValue: 4,
        areaUnit: 'acre',
      });
    farmId = fRes.body.data.id;

    const pRes = await request(app)
      .post(`/api/v1/groups/${groupId}/farms/${farmId}/plots`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        plotName: 'तुकडा अ',
        areaValue: 4,
        areaUnit: 'acre',
        cultivationMode: 'separate',
      });
    plotId = pRes.body.data.id;

    const cRes = await request(app)
      .post(`/api/v1/groups/${groupId}/crops`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        plotId,
        cropTypeId: 'crop_soybean',
        cropSeasonId: 'season_kharif',
        sowingDate: '2026-06-15',
      });
    cropId = cRes.body.data.id;

    // Activity
    const actRes = await request(app)
      .post(`/api/v1/groups/${groupId}/activities`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        plotId,
        cropId,
        activityTypeId: 'act_spraying',
        description: 'कीटकनाशक फवारणी',
      });
    activityId = actRes.body.data.id;
  });

  it('1. GET & PUT notification preferences', async () => {
    // Default preferences
    const getRes = await request(app)
      .get(`/api/v1/groups/${groupId}/notifications/preferences`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.activityReminders).toBe(true);

    // Update preferences
    const putRes = await request(app)
      .put(`/api/v1/groups/${groupId}/notifications/preferences`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        activityReminders: true,
        familyEscalations: false,
        financialAlerts: true,
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.familyEscalations).toBe(false);
  });

  it('2. Activity start automatically schedules 3-stage reminder escalation (2h -> 30m -> 1m)', async () => {
    // Start activity
    const startRes = await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ transition: 'start', notes: 'फवारणी सुरू केली' });

    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('in_progress');

    // Query database directly to verify 3 stages scheduled
    const client = getDatabaseClient();
    const remindersRes = await client.execute({
      sql: 'SELECT stage, status FROM activity_reminders WHERE activity_id = ? ORDER BY stage ASC',
      args: [activityId],
    });

    expect(remindersRes.rows.length).toBe(3);
    expect(Number(remindersRes.rows[0].stage)).toBe(1);
    expect(String(remindersRes.rows[0].status)).toBe('pending');
    expect(Number(remindersRes.rows[1].stage)).toBe(2);
    expect(String(remindersRes.rows[1].status)).toBe('pending');
    expect(Number(remindersRes.rows[2].stage)).toBe(3);
    expect(String(remindersRes.rows[2].status)).toBe('pending');
  });

  it('3. Activity pause and resume manages reminder states properly', async () => {
    // Pause activity
    await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ transition: 'pause', notes: 'दुपारची विश्रांती' });

    const client = getDatabaseClient();
    const pausedRes = await client.execute({
      sql: 'SELECT status FROM activity_reminders WHERE activity_id = ?',
      args: [activityId],
    });
    for (const row of pausedRes.rows) {
      expect(String(row.status)).toBe('paused');
    }

    // Resume activity
    await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ transition: 'resume', notes: 'पुन्हा फवारणी सुरू' });

    const resumedRes = await client.execute({
      sql: 'SELECT status FROM activity_reminders WHERE activity_id = ?',
      args: [activityId],
    });
    for (const row of resumedRes.rows) {
      expect(String(row.status)).toBe('pending');
    }
  });

  it('4. processDueReminders executes notifications and escalates to family', async () => {
    const client = getDatabaseClient();
    // Simulate Stage 1 & Stage 3 due in past
    const pastTime = new Date(Date.now() - 10000).toISOString();
    await client.execute({
      sql: "UPDATE activity_reminders SET due_at = ? WHERE activity_id = ? AND stage IN (1, 3)",
      args: [pastTime, activityId],
    });

    const processedCount = await notificationService.processDueReminders();
    expect(processedCount).toBeGreaterThanOrEqual(2);

    // Verify in-app notifications generated for owner (Stage 1) and member (Stage 3 escalation)
    const ownerNotifs = await request(app)
      .get(`/api/v1/groups/${groupId}/notifications`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(ownerNotifs.status).toBe(200);
    expect(ownerNotifs.body.data.notifications.length).toBeGreaterThan(0);
    expect(ownerNotifs.body.data.unreadCount).toBeGreaterThan(0);

    const memberNotifs = await request(app)
      .get(`/api/v1/groups/${groupId}/notifications`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', memberCookie);

    expect(memberNotifs.status).toBe(200);
    expect(memberNotifs.body.data.notifications.length).toBeGreaterThan(0);
    expect(memberNotifs.body.data.notifications[0].type).toBe('activity_escalation');
  });

  it('5. Mark notification as read and mark all as read', async () => {
    const notifs = await request(app)
      .get(`/api/v1/groups/${groupId}/notifications`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    const firstId = notifs.body.data.notifications[0].id;

    // Single mark read
    const patchRes = await request(app)
      .patch(`/api/v1/groups/${groupId}/notifications/${firstId}/read`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(patchRes.status).toBe(200);

    // Mark all read
    const allRes = await request(app)
      .post(`/api/v1/groups/${groupId}/notifications/mark-all-read`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(allRes.status).toBe(200);

    const check = await request(app)
      .get(`/api/v1/groups/${groupId}/notifications`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie);

    expect(check.body.data.unreadCount).toBe(0);
  });

  it('6. Activity completion cancels remaining reminders', async () => {
    // Complete activity
    await request(app)
      .post(`/api/v1/groups/${groupId}/activities/${activityId}/transition`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({ transition: 'complete', notes: 'फवारणी यशस्वी पूर्ण' });

    const client = getDatabaseClient();
    const finalReminders = await client.execute({
      sql: "SELECT status FROM activity_reminders WHERE activity_id = ? AND status = 'pending'",
      args: [activityId],
    });

    expect(finalReminders.rows.length).toBe(0);
  });

  it('7. Controlled timestamp verification: 2h -> 30m -> 1m exact schedule, pause immunity, and resume recalculation', async () => {
    const client = getDatabaseClient();

    // Create a new controlled activity
    const newActRes = await request(app)
      .post(`/api/v1/groups/${groupId}/activities`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Cookie', ownerCookie)
      .send({
        farmId,
        plotId,
        cropId,
        activityTypeId: 'act_irrigation',
        description: 'नियंत्रित वेळेची पाणी देणे नोंद',
      });
    const ctrlActId = newActRes.body.data.id;

    // Controlled start timestamp: T0 = 2026-11-26T08:00:00.000Z
    const t0 = new Date('2026-11-26T08:00:00.000Z');
    const userRow = await client.execute({
      sql: 'SELECT id FROM users WHERE phone_number = ?',
      args: [ownerPhone],
    });
    const validActorId = String(userRow.rows[0].id);
    await notificationService.scheduleActivityReminders(ctrlActId, groupId, validActorId, t0.toISOString());

    const reminders = await client.execute({
      sql: 'SELECT stage, due_at, status FROM activity_reminders WHERE activity_id = ? ORDER BY stage ASC',
      args: [ctrlActId],
    });

    expect(reminders.rows.length).toBe(3);

    // Stage 1: T0 + 2 hours (120 minutes) = 10:00:00.000Z
    const stage1 = reminders.rows[0];
    expect(Number(stage1.stage)).toBe(1);
    expect(String(stage1.status)).toBe('pending');
    expect(new Date(String(stage1.due_at)).getTime()).toBe(t0.getTime() + 120 * 60 * 1000);

    // Stage 2: T0 + 2h 30m (+30 min after Stage 1) = 10:30:00.000Z
    const stage2 = reminders.rows[1];
    expect(Number(stage2.stage)).toBe(2);
    expect(String(stage2.status)).toBe('pending');
    expect(new Date(String(stage2.due_at)).getTime()).toBe(t0.getTime() + 150 * 60 * 1000);

    // Stage 3: T0 + 2h 31m (+1 min after Stage 2) = 10:31:00.000Z
    const stage3 = reminders.rows[2];
    expect(Number(stage3.stage)).toBe(3);
    expect(String(stage3.status)).toBe('pending');
    expect(new Date(String(stage3.due_at)).getTime()).toBe(t0.getTime() + 151 * 60 * 1000);

    // Pause activity at 09:00:00: All reminders must become 'paused'
    await notificationService.pauseActivityReminders(ctrlActId);
    const pausedCheck = await client.execute({
      sql: 'SELECT status FROM activity_reminders WHERE activity_id = ?',
      args: [ctrlActId],
    });
    expect(pausedCheck.rows.every((r) => String(r.status) === 'paused')).toBe(true);

    // Resume activity at T1 = 2026-11-26T11:00:00.000Z (before Stage 1 was sent): full countdown resets from T1
    const t1 = new Date('2026-11-26T11:00:00.000Z');
    await notificationService.resumeActivityReminders(ctrlActId, t1.toISOString());
    const resumedCheck = await client.execute({
      sql: 'SELECT stage, due_at, status FROM activity_reminders WHERE activity_id = ? ORDER BY stage ASC',
      args: [ctrlActId],
    });
    expect(resumedCheck.rows[0].status).toBe('pending');
    expect(new Date(String(resumedCheck.rows[0].due_at)).getTime()).toBe(t1.getTime() + 120 * 60 * 1000); // 13:00:00
    expect(new Date(String(resumedCheck.rows[1].due_at)).getTime()).toBe(t1.getTime() + 150 * 60 * 1000); // 13:30:00
    expect(new Date(String(resumedCheck.rows[2].due_at)).getTime()).toBe(t1.getTime() + 151 * 60 * 1000); // 13:31:00

    // Simulate Stage 1 being sent at 13:00:00
    await client.execute({
      sql: "UPDATE activity_reminders SET status = 'sent', sent_at = '2026-11-26T13:00:00.000Z' WHERE activity_id = ? AND stage = 1",
      args: [ctrlActId],
    });

    // Pause activity again at 13:10:00
    await notificationService.pauseActivityReminders(ctrlActId);
    // Resume at T2 = 2026-11-26T14:00:00.000Z: Stage 2 should be T2 + 30m, Stage 3 = T2 + 31m
    const t2 = new Date('2026-11-26T14:00:00.000Z');
    await notificationService.resumeActivityReminders(ctrlActId, t2.toISOString());
    const resumedAfterStage1 = await client.execute({
      sql: 'SELECT stage, due_at, status FROM activity_reminders WHERE activity_id = ? ORDER BY stage ASC',
      args: [ctrlActId],
    });
    // Stage 1 remains sent
    expect(resumedAfterStage1.rows[0].status).toBe('sent');
    // Stage 2 is due at 14:30:00 (T2 + 30 min)
    expect(resumedAfterStage1.rows[1].status).toBe('pending');
    expect(new Date(String(resumedAfterStage1.rows[1].due_at)).getTime()).toBe(t2.getTime() + 30 * 60 * 1000);
    // Stage 3 is due at 14:31:00 (T2 + 31 min)
    expect(resumedAfterStage1.rows[2].status).toBe('pending');
    expect(new Date(String(resumedAfterStage1.rows[2].due_at)).getTime()).toBe(t2.getTime() + 31 * 60 * 1000);

    // Cancel activity reminders
    await notificationService.cancelActivityReminders(ctrlActId);
    const cancelledCheck = await client.execute({
      sql: "SELECT status FROM activity_reminders WHERE activity_id = ? AND status = 'cancelled'",
      args: [ctrlActId],
    });
    // Stage 2 and 3 are now cancelled
    expect(cancelledCheck.rows.length).toBe(2);
  });
});
