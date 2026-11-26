import crypto from 'crypto';
import { getDatabaseClient } from '../../database/client.js';
import { AppError } from '../../middleware/error.middleware.js';
import { logger } from '../../utils/logger.js';
import { FinanceService } from '../finance/finance.service.js';
import { AgricultureService } from '../agriculture/agriculture.service.js';

export interface SyncOperationInput {
  clientOperationId: string;
  entityType: 'expense' | 'payment' | 'harvest' | 'sale' | 'activity' | 'activity_transition';
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
  createdAt: string;
}

export interface SyncOperationResult {
  clientOperationId: string;
  status: 'success' | 'failed' | 'conflict';
  entityId?: string | null;
  data?: any;
  error?: string | null;
}

export class SyncService {
  private financeService = new FinanceService();
  private agricultureService = new AgricultureService();

  async processBatchSync(
    groupId: string,
    userId: string,
    deviceId: string,
    operations: SyncOperationInput[],
    deviceName?: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ results: SyncOperationResult[]; serverTimestamp: string }> {
    const client = getDatabaseClient();
    const now = new Date().toISOString();

    // 1. Mandatory Removed-Member & Group Isolation Protection
    const memberRes = await client.execute({
      sql: "SELECT role, status FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'active'",
      args: [groupId, userId],
    });

    if (memberRes.rows.length === 0) {
      logger.warn('Offline sync rejected: user is not an active member of group', { groupId, userId });
      throw new AppError('या शेती गटात आपण सक्रिय सदस्य नाही. सिंक नाकारण्यात आले. (Unauthorized group sync)', 403, 'FORBIDDEN_GROUP_ACCESS');
    }

    // 2. Track / update device registration
    await client.execute({
      sql: `
        INSERT INTO device_registrations (id, user_id, device_id, device_name, last_sync_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, device_id) DO UPDATE SET
          device_name = COALESCE(excluded.device_name, device_registrations.device_name),
          last_sync_at = excluded.last_sync_at
      `,
      args: [crypto.randomUUID(), userId, deviceId, deviceName || 'Mobile Client', now, now],
    });

    const results: SyncOperationResult[] = [];

    // 3. Process operations sequentially with strict idempotency
    for (const op of operations) {
      // Check idempotency first: has this operation already been processed?
      const existingOp = await client.execute({
        sql: 'SELECT status, response_payload, error_message, entity_id FROM sync_operations WHERE client_operation_id = ?',
        args: [op.clientOperationId],
      });

      if (existingOp.rows.length > 0) {
        const row = existingOp.rows[0];
        results.push({
          clientOperationId: op.clientOperationId,
          status: String(row.status) as 'success' | 'failed' | 'conflict',
          entityId: row.entity_id ? String(row.entity_id) : null,
          data: row.response_payload ? JSON.parse(String(row.response_payload)) : null,
          error: row.error_message ? String(row.error_message) : null,
        });
        continue;
      }

      // Execute new operation
      try {
        let opResult: any = null;
        let createdEntityId: string | null = null;

        if (op.entityType === 'expense' && op.operation === 'create') {
          opResult = await this.financeService.createExpense(groupId, userId, op.payload as any, ip, userAgent);
          createdEntityId = opResult.id;
        } else if (op.entityType === 'payment' && op.operation === 'create') {
          opResult = await this.financeService.recordPayment(groupId, userId, op.payload as any, ip, userAgent);
          createdEntityId = opResult.id;
        } else if (op.entityType === 'harvest' && op.operation === 'create') {
          opResult = await this.financeService.createHarvest(groupId, userId, op.payload as any, ip, userAgent);
          createdEntityId = opResult.id;
        } else if (op.entityType === 'sale' && op.operation === 'create') {
          opResult = await this.financeService.createSale(groupId, userId, op.payload as any, ip, userAgent);
          createdEntityId = opResult.id;
        } else if (op.entityType === 'activity' && op.operation === 'create') {
          opResult = await this.agricultureService.createActivity(groupId, userId, op.payload as any, ip, userAgent);
          createdEntityId = opResult.id;
        } else if (op.entityType === 'activity_transition' && op.operation === 'update') {
          const { activityId, transition, notes } = op.payload;
          opResult = await this.agricultureService.transitionActivity(groupId, activityId, userId, transition, notes);
          createdEntityId = activityId;
        } else {
          throw new AppError(`असमर्थित ऑफलाइन कृती (Unsupported offline operation): ${op.entityType} ${op.operation}`, 400);
        }

        // Record successful sync operation journal
        await client.execute({
          sql: `
            INSERT INTO sync_operations (id, group_id, user_id, client_operation_id, entity_type, entity_id, operation, status, response_payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?, ?)
          `,
          args: [
            crypto.randomUUID(),
            groupId,
            userId,
            op.clientOperationId,
            op.entityType,
            createdEntityId,
            op.operation,
            JSON.stringify(opResult),
            now,
          ],
        });

        results.push({
          clientOperationId: op.clientOperationId,
          status: 'success',
          entityId: createdEntityId,
          data: opResult,
        });
      } catch (err: any) {
        const errorMsg = err.message || 'सिंक दरम्यान त्रुटी (Sync execution error)';
        const isConflict = err.statusCode === 409 || errorMsg.includes('concurrency') || errorMsg.includes('conflict');
        const status = isConflict ? 'conflict' : 'failed';

        // Persist failure state so client receives permanent deterministic error
        await client.execute({
          sql: `
            INSERT INTO sync_operations (id, group_id, user_id, client_operation_id, entity_type, operation, status, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            crypto.randomUUID(),
            groupId,
            userId,
            op.clientOperationId,
            op.entityType,
            op.operation,
            status,
            errorMsg,
            now,
          ],
        });

        results.push({
          clientOperationId: op.clientOperationId,
          status,
          error: errorMsg,
        });
      }
    }

    return {
      results,
      serverTimestamp: now,
    };
  }

  async getSyncStatus(groupId: string, userId: string, deviceId: string) {
    const client = getDatabaseClient();

    const deviceRes = await client.execute({
      sql: 'SELECT last_sync_at as lastSyncAt FROM device_registrations WHERE user_id = ? AND device_id = ?',
      args: [userId, deviceId],
    });

    const recentSyncsRes = await client.execute({
      sql: `
        SELECT client_operation_id as clientOperationId, entity_type as entityType,
               operation, status, error_message as errorMessage, created_at as createdAt
        FROM sync_operations
        WHERE group_id = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `,
      args: [groupId, userId],
    });

    return {
      lastSyncAt: deviceRes.rows.length > 0 ? String(deviceRes.rows[0].lastSyncAt) : null,
      recentOperations: recentSyncsRes.rows.map((r) => ({
        clientOperationId: String(r.clientOperationId),
        entityType: String(r.entityType),
        operation: String(r.operation),
        status: String(r.status),
        errorMessage: r.errorMessage ? String(r.errorMessage) : null,
        createdAt: String(r.createdAt),
      })),
    };
  }
}
