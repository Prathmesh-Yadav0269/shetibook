-- ShetiBook Migration 002: Active Owner Database Constraint & Audit Log Immutability Triggers

-- 1. Enforce at most one active owner per farming group at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_single_active_owner
ON group_members(group_id)
WHERE role = 'owner' AND status = 'active';

-- 2. Database-level immutability for audit logs (prevent UPDATE)
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'Audit logs are immutable and cannot be updated');
END;

-- 3. Database-level immutability for audit logs (prevent DELETE)
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'Audit logs are immutable and cannot be deleted');
END;
