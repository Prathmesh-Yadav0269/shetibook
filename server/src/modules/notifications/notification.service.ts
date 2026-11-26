import crypto from 'crypto';
import { getDatabaseClient } from '../../database/client.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/error.middleware.js';

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export class NotificationService {
  // ==========================================
  // 1. IN-APP NOTIFICATIONS
  // ==========================================

  async listNotifications(groupId: string, userId: string) {
    const client = getDatabaseClient();

    const result = await client.execute({
      sql: `
        SELECT id, group_id as groupId, user_id as userId, type, title, message,
               data, is_read as isRead, read_at as readAt, created_at as createdAt
        FROM notifications
        WHERE group_id = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `,
      args: [groupId, userId],
    });

    const unreadCountRes = await client.execute({
      sql: 'SELECT COUNT(*) as unreadCount FROM notifications WHERE group_id = ? AND user_id = ? AND is_read = 0',
      args: [groupId, userId],
    });

    const unreadCount = Number(unreadCountRes.rows[0].unreadCount);

    const notifications = result.rows.map((r) => ({
      id: String(r.id),
      groupId: String(r.groupId),
      userId: String(r.userId),
      type: String(r.type),
      title: String(r.title),
      message: String(r.message),
      data: r.data ? JSON.parse(String(r.data)) : null,
      isRead: Boolean(r.isRead),
      readAt: r.readAt ? String(r.readAt) : null,
      createdAt: String(r.createdAt),
    }));

    return {
      unreadCount,
      notifications,
    };
  }

  async markAsRead(groupId: string, userId: string, notificationId: string) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();

    const res = await client.execute({
      sql: 'UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ? AND group_id = ? AND user_id = ?',
      args: [now, notificationId, groupId, userId],
    });

    if (res.rowsAffected === 0) {
      throw new AppError('सूचना आढळली नाही (Notification not found)', 404);
    }

    return { success: true };
  }

  async markAllAsRead(groupId: string, userId: string) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();

    await client.execute({
      sql: 'UPDATE notifications SET is_read = 1, read_at = ? WHERE group_id = ? AND user_id = ? AND is_read = 0',
      args: [now, groupId, userId],
    });

    return { success: true };
  }

  async createNotification(
    groupId: string,
    userId: string,
    data: {
      type: 'activity_reminder' | 'activity_escalation' | 'financial_alert' | 'sync_status' | 'general';
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const client = getDatabaseClient();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await client.execute({
      sql: `
        INSERT INTO notifications (id, group_id, user_id, type, title, message, data, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `,
      args: [
        id,
        groupId,
        userId,
        data.type,
        data.title,
        data.message,
        data.metadata ? JSON.stringify(data.metadata) : null,
        now,
      ],
    });

    logger.info('Notification created', { id, userId, type: data.type });
    return { id, success: true };
  }

  // ==========================================
  // 2. NOTIFICATION PREFERENCES
  // ==========================================

  async getPreferences(groupId: string, userId: string) {
    const client = getDatabaseClient();
    const res = await client.execute({
      sql: `
        SELECT activity_reminders as activityReminders, family_escalations as familyEscalations,
               financial_alerts as financialAlerts, web_push_enabled as webPushEnabled
        FROM notification_preferences
        WHERE group_id = ? AND user_id = ?
      `,
      args: [groupId, userId],
    });

    if (res.rows.length === 0) {
      return {
        activityReminders: true,
        familyEscalations: true,
        financialAlerts: true,
        webPushEnabled: false,
      };
    }

    const r = res.rows[0];
    return {
      activityReminders: Boolean(r.activityReminders),
      familyEscalations: Boolean(r.familyEscalations),
      financialAlerts: Boolean(r.financialAlerts),
      webPushEnabled: Boolean(r.webPushEnabled),
    };
  }

  async updatePreferences(
    groupId: string,
    userId: string,
    prefs: {
      activityReminders?: boolean;
      familyEscalations?: boolean;
      financialAlerts?: boolean;
      webPushEnabled?: boolean;
    }
  ) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();
    const current = await this.getPreferences(groupId, userId);

    const merged = {
      activityReminders: prefs.activityReminders !== undefined ? prefs.activityReminders : current.activityReminders,
      familyEscalations: prefs.familyEscalations !== undefined ? prefs.familyEscalations : current.familyEscalations,
      financialAlerts: prefs.financialAlerts !== undefined ? prefs.financialAlerts : current.financialAlerts,
      webPushEnabled: prefs.webPushEnabled !== undefined ? prefs.webPushEnabled : current.webPushEnabled,
    };

    await client.execute({
      sql: `
        INSERT INTO notification_preferences (id, user_id, group_id, activity_reminders, family_escalations, financial_alerts, web_push_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, group_id) DO UPDATE SET
          activity_reminders = excluded.activity_reminders,
          family_escalations = excluded.family_escalations,
          financial_alerts = excluded.financial_alerts,
          web_push_enabled = excluded.web_push_enabled,
          updated_at = excluded.updated_at
      `,
      args: [
        crypto.randomUUID(),
        userId,
        groupId,
        merged.activityReminders ? 1 : 0,
        merged.familyEscalations ? 1 : 0,
        merged.financialAlerts ? 1 : 0,
        merged.webPushEnabled ? 1 : 0,
        now,
        now,
      ],
    });

    return merged;
  }

  // ==========================================
  // 3. PUSH SUBSCRIPTIONS (WEB PUSH API)
  // ==========================================

  async savePushSubscription(userId: string, data: PushSubscriptionData) {
    const client = getDatabaseClient();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await client.execute({
      sql: `
        INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
          user_id = excluded.user_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          user_agent = excluded.user_agent
      `,
      args: [id, userId, data.endpoint, data.p256dh, data.auth, data.userAgent || null, now],
    });

    return { success: true };
  }

  // ==========================================
  // 4. ACTIVITY REMINDER SCHEDULE ENGINE
  // ==========================================

  /**
   * Schedules the approved 3-stage reminder escalation:
   * Stage 1: 2 hours after start (120 min)
   * Stage 2: 30 min later (150 min from start)
   * Stage 3: 1 min later (151 min from start) -> family escalation
   */
  async scheduleActivityReminders(activityId: string, groupId: string, actorId: string, startedAt?: string) {
    const client = getDatabaseClient();
    const baseTime = startedAt ? new Date(startedAt).getTime() : Date.now();
    const now = new Date().toISOString();

    // Stage 1: +120 minutes (2 hours)
    const stage1Due = new Date(baseTime + 120 * 60 * 1000).toISOString();
    // Stage 2: +150 minutes (2.5 hours)
    const stage2Due = new Date(baseTime + 150 * 60 * 1000).toISOString();
    // Stage 3: +151 minutes (escalation to other family members)
    const stage3Due = new Date(baseTime + 151 * 60 * 1000).toISOString();

    const txn = await client.transaction('write');
    try {
      // Cancel any existing pending reminders for this activity
      await txn.execute({
        sql: "UPDATE activity_reminders SET status = 'cancelled', updated_at = ? WHERE activity_id = ? AND status = 'pending'",
        args: [now, activityId],
      });

      // Insert Stage 1
      await txn.execute({
        sql: `
          INSERT INTO activity_reminders (id, activity_id, group_id, actor_id, stage, due_at, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, 'pending', ?, ?)
        `,
        args: [crypto.randomUUID(), activityId, groupId, actorId, stage1Due, now, now],
      });

      // Insert Stage 2
      await txn.execute({
        sql: `
          INSERT INTO activity_reminders (id, activity_id, group_id, actor_id, stage, due_at, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 2, ?, 'pending', ?, ?)
        `,
        args: [crypto.randomUUID(), activityId, groupId, actorId, stage2Due, now, now],
      });

      // Insert Stage 3
      await txn.execute({
        sql: `
          INSERT INTO activity_reminders (id, activity_id, group_id, actor_id, stage, due_at, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 3, ?, 'pending', ?, ?)
        `,
        args: [crypto.randomUUID(), activityId, groupId, actorId, stage3Due, now, now],
      });

      await txn.commit();
      logger.info('Activity reminders scheduled', { activityId, groupId, actorId });
    } catch (err) {
      await txn.rollback();
      throw err;
    }
  }

  async pauseActivityReminders(activityId: string) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();
    await client.execute({
      sql: "UPDATE activity_reminders SET status = 'paused', updated_at = ? WHERE activity_id = ? AND status = 'pending'",
      args: [now, activityId],
    });
    logger.info('Activity reminders paused', { activityId });
  }

  async resumeActivityReminders(activityId: string, resumedAt?: string) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();
    const baseTime = resumedAt ? new Date(resumedAt).getTime() : Date.now();

    // Check existing reminders to see which stages have already been sent
    const existing = await client.execute({
      sql: 'SELECT stage, status FROM activity_reminders WHERE activity_id = ?',
      args: [activityId],
    });

    const stage1Sent = existing.rows.some((r) => Number(r.stage) === 1 && String(r.status) === 'sent');
    const stage2Sent = existing.rows.some((r) => Number(r.stage) === 2 && String(r.status) === 'sent');

    let stage1Due: string | null = null;
    let stage2Due: string | null = null;
    let stage3Due: string | null = null;

    if (!stage1Sent) {
      // Stage 1 was not yet sent: full timeline restart from resume time
      stage1Due = new Date(baseTime + 120 * 60 * 1000).toISOString(); // +2 hours (120 min)
      stage2Due = new Date(baseTime + 150 * 60 * 1000).toISOString(); // +2.5 hours (30 min after Stage 1)
      stage3Due = new Date(baseTime + 151 * 60 * 1000).toISOString(); // +2h 31m (1 min after Stage 2)
    } else if (!stage2Sent) {
      // Stage 1 was sent prior to pause: Stage 2 due 30 min from resume, Stage 3 due 31 min from resume
      stage2Due = new Date(baseTime + 30 * 60 * 1000).toISOString();
      stage3Due = new Date(baseTime + 31 * 60 * 1000).toISOString();
    } else {
      // Stage 1 and 2 were sent: Stage 3 due 1 min from resume
      stage3Due = new Date(baseTime + 1 * 60 * 1000).toISOString();
    }

    const txn = await client.transaction('write');
    try {
      if (stage1Due) {
        await txn.execute({
          sql: "UPDATE activity_reminders SET due_at = ?, status = 'pending', updated_at = ? WHERE activity_id = ? AND stage = 1 AND status = 'paused'",
          args: [stage1Due, now, activityId],
        });
      }
      if (stage2Due) {
        await txn.execute({
          sql: "UPDATE activity_reminders SET due_at = ?, status = 'pending', updated_at = ? WHERE activity_id = ? AND stage = 2 AND status = 'paused'",
          args: [stage2Due, now, activityId],
        });
      }
      if (stage3Due) {
        await txn.execute({
          sql: "UPDATE activity_reminders SET due_at = ?, status = 'pending', updated_at = ? WHERE activity_id = ? AND stage = 3 AND status = 'paused'",
          args: [stage3Due, now, activityId],
        });
      }
      await txn.commit();
      logger.info('Activity reminders resumed with SRS-aligned timeline', { activityId, stage1Sent, stage2Sent });
    } catch (err) {
      await txn.rollback();
      throw err;
    }
  }

  async cancelActivityReminders(activityId: string) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();
    await client.execute({
      sql: "UPDATE activity_reminders SET status = 'cancelled', updated_at = ? WHERE activity_id = ? AND status IN ('pending', 'paused')",
      args: [now, activityId],
    });
    logger.info('Activity reminders cancelled', { activityId });
  }

  /**
   * Farmer acknowledges reminder or logs progress, which persists an activity event
   * and cancels upcoming family escalation (Stage 3).
   */
  async acknowledgeActivityReminder(
    activityId: string,
    actorId: string,
    groupId: string,
    responseNote?: string
  ) {
    const client = getDatabaseClient();
    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();

    const txn = await client.transaction('write');
    try {
      // 1. Persist response event in activity_events audit log
      // Conforms to existing event_type CHECK constraint ('resumed') with tag in notes
      await txn.execute({
        sql: `
          INSERT INTO activity_events (id, activity_id, group_id, actor_id, event_type, event_at, notes)
          VALUES (?, ?, ?, ?, 'resumed', ?, ?)
        `,
        args: [
          eventId,
          activityId,
          groupId,
          actorId,
          now,
          `[reminder_acknowledged] ${responseNote?.trim() || 'काम चालू आहे (Work acknowledged in progress)'}`,
        ],
      });

      // 2. Suppress/Cancel pending Stage 3 family escalation
      await txn.execute({
        sql: "UPDATE activity_reminders SET status = 'cancelled', updated_at = ? WHERE activity_id = ? AND stage = 3 AND status = 'pending'",
        args: [now, activityId],
      });

      // 3. Mark in-app reminders for this activity as read
      await txn.execute({
        sql: "UPDATE notifications SET is_read = 1, read_at = ? WHERE group_id = ? AND user_id = ? AND type = 'activity_reminder'",
        args: [now, groupId, actorId],
      });

      await txn.commit();
      logger.info('Activity reminder acknowledged and escalation suppressed', { activityId, actorId });
      return { success: true, activityId, acknowledgedAt: now };
    } catch (err) {
      await txn.rollback();
      throw err;
    }
  }

  /**
   * Processes all due reminders. Can be triggered by background timer or on-demand server tick.
   * Handles server sleep / restart recovery idempotently.
   */
  async processDueReminders(): Promise<number> {
    const client = getDatabaseClient();
    const now = new Date().toISOString();

    // Query due pending reminders with activity details
    const dueRes = await client.execute({
      sql: `
        SELECT 
          r.id, r.activity_id as activityId, r.group_id as groupId, r.actor_id as actorId,
          r.stage, r.due_at as dueAt,
          a.custom_activity_name as customName,
          at.name_mr as activityTypeMr, at.name_en as activityTypeEn,
          f.farm_name as farmName
        FROM activity_reminders r
        JOIN activities a ON a.id = r.activity_id
        JOIN activity_types at ON at.id = a.activity_type_id
        JOIN farms f ON f.id = a.farm_id
        WHERE r.status = 'pending' AND r.due_at <= ? AND a.status = 'in_progress'
        ORDER BY r.due_at ASC
        LIMIT 20
      `,
      args: [now],
    });

    let processedCount = 0;

    for (const row of dueRes.rows) {
      const reminderId = String(row.id);
      const activityId = String(row.activityId);
      const groupId = String(row.groupId);
      const actorId = String(row.actorId);
      const stage = Number(row.stage);
      const activityName = String(row.customName || row.activityTypeMr);
      const farmName = String(row.farmName);

      const txn = await client.transaction('write');
      try {
        if (stage === 1) {
          // Stage 1: First reminder to actor (2 hours)
          await txn.execute({
            sql: `
              INSERT INTO notifications (id, group_id, user_id, type, title, message, data, is_read, created_at)
              VALUES (?, ?, ?, 'activity_reminder', ?, ?, ?, 0, ?)
            `,
            args: [
              crypto.randomUUID(),
              groupId,
              actorId,
              'काम चालू असल्याची आठवण (पहिली आठवण)',
              `'${farmName}' वरील '${activityName}' कामाला २ तास झाले आहेत. काम चालू आहे का?`,
              JSON.stringify({ activityId, stage: 1 }),
              now,
            ],
          });
        } else if (stage === 2) {
          // Stage 2: Second reminder to actor (2.5 hours)
          await txn.execute({
            sql: `
              INSERT INTO notifications (id, group_id, user_id, type, title, message, data, is_read, created_at)
              VALUES (?, ?, ?, 'activity_reminder', ?, ?, ?, 0, ?)
            `,
            args: [
              crypto.randomUUID(),
              groupId,
              actorId,
              'काम स्थिती नोंदवा (दुसरी आठवण)',
              `'${farmName}' वरील '${activityName}' कामाला २ तास ३० मिनिटे झाली आहेत. कृपया काम पूर्ण किंवा थांबल्याची नोंद करा.`,
              JSON.stringify({ activityId, stage: 2 }),
              now,
            ],
          });
        } else if (stage === 3) {
          // Check if farmer responded or logged activity updates since Stage 1 was sent or acknowledged
          const responseCheck = await txn.execute({
            sql: `
              SELECT COUNT(*) as eventCount
              FROM activity_events
              WHERE activity_id = ? AND (
                notes LIKE '%[reminder_acknowledged]%'
                OR (
                  event_at >= (
                    SELECT COALESCE(sent_at, '9999-12-31')
                    FROM activity_reminders
                    WHERE activity_id = ? AND stage = 1
                  ) AND event_type IN ('completed', 'paused', 'resumed')
                )
              )
            `,
            args: [activityId, activityId],
          });

          if (Number(responseCheck.rows[0].eventCount) > 0) {
            // Farmer responded or updated activity: cancel Stage 3 reminder without escalating to family
            await txn.execute({
              sql: "UPDATE activity_reminders SET status = 'cancelled', updated_at = ? WHERE id = ?",
              args: [now, reminderId],
            });
            await txn.commit();
            processedCount++;
            logger.info('Stage 3 family escalation suppressed: farmer response detected', { activityId });
            continue;
          }

          // Stage 3: Family escalation - notify other active group members
          const membersRes = await txn.execute({
            sql: `
              SELECT gm.user_id as memberUserId
              FROM group_members gm
              WHERE gm.group_id = ? AND gm.status = 'active' AND gm.user_id != ?
            `,
            args: [groupId, actorId],
          });

          // If actor is the only member, notify actor
          const targetUserIds =
            membersRes.rows.length > 0
              ? membersRes.rows.map((m) => String(m.memberUserId))
              : [actorId];

          for (const memberId of targetUserIds) {
            await txn.execute({
              sql: `
                INSERT INTO notifications (id, group_id, user_id, type, title, message, data, is_read, created_at)
                VALUES (?, ?, ?, 'activity_escalation', ?, ?, ?, 0, ?)
              `,
              args: [
                crypto.randomUUID(),
                groupId,
                memberId,
                'कुटुंब अलर्ट: शेतावरील कामाकडे लक्ष द्या!',
                `'${farmName}' वर '${activityName}' कामाला अडीच तास उलटूनही प्रतिसाद नाही. कृपया सहकाऱ्याशी संपर्क साधा.`,
                JSON.stringify({ activityId, stage: 3, actorId }),
                now,
              ],
            });
          }
        }

        // Mark reminder as sent
        await txn.execute({
          sql: "UPDATE activity_reminders SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?",
          args: [now, now, reminderId],
        });

        await txn.commit();
        processedCount++;
      } catch (err) {
        await txn.rollback();
        logger.error('Failed to process reminder', { reminderId, err });
      }
    }

    if (processedCount > 0) {
      logger.info('Processed due activity reminders', { count: processedCount });
    }
    return processedCount;
  }
}
