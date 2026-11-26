-- ShetiBook Phase 4: Intelligence, Notifications, Reminders & Offline Sync Schema Migration

-- 1. Notifications Table (In-App Notification Center)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('activity_reminder', 'activity_escalation', 'financial_alert', 'sync_status', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
  read_at TEXT,
  created_at TEXT NOT NULL
);

-- 2. Activity Reminders Table (Escalation schedule: 2h -> 30m -> 1m family alert)
CREATE TABLE IF NOT EXISTS activity_reminders (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK(stage IN (1, 2, 3)),
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'cancelled', 'paused')),
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE CASCADE,
  activity_reminders INTEGER NOT NULL DEFAULT 1 CHECK(activity_reminders IN (0, 1)),
  family_escalations INTEGER NOT NULL DEFAULT 1 CHECK(family_escalations IN (0, 1)),
  financial_alerts INTEGER NOT NULL DEFAULT 1 CHECK(financial_alerts IN (0, 1)),
  web_push_enabled INTEGER NOT NULL DEFAULT 0 CHECK(web_push_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, group_id)
);

-- 4. Push Subscriptions Table (Web Push API)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

-- 5. Sync Operations Table (Durable Idempotency & Operation Journal)
CREATE TABLE IF NOT EXISTS sync_operations (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farming_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_operation_id TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'conflict')),
  response_payload TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

-- 6. Device Registrations Table (Offline device tracking)
CREATE TABLE IF NOT EXISTS device_registrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, device_id)
);

-- 7. Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_group ON notifications(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_reminders_due ON activity_reminders(status, due_at);
CREATE INDEX IF NOT EXISTS idx_activity_reminders_activity ON activity_reminders(activity_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_client_op ON sync_operations(client_operation_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_group ON sync_operations(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_registrations_user ON device_registrations(user_id);
