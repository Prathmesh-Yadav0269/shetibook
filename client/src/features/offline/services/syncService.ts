import {
  enqueueOperation,
  getPendingOperations,
  removeOperations,
  clearGroupQueue,
  QueuedSyncOperation,
} from './indexedDb';
import { api } from '../../../services/api/apiClient';

export interface SyncResult {
  processed: number;
  failed: number;
  results: Array<{
    clientOperationId: string;
    success: boolean;
    entityId?: string;
    error?: string;
  }>;
}

export const syncService = {
  // Queue a mutation when offline
  queueMutation: async (
    groupId: string,
    entityType: QueuedSyncOperation['entityType'],
    action: QueuedSyncOperation['action'],
    payload: Record<string, any>
  ): Promise<string> => {
    const clientOperationId = crypto.randomUUID();
    const op: QueuedSyncOperation = {
      id: clientOperationId,
      groupId,
      entityType,
      action,
      payload,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    await enqueueOperation(op);
    return clientOperationId;
  },

  getPendingCount: async (groupId: string): Promise<number> => {
    try {
      const pending = await getPendingOperations(groupId);
      return pending.length;
    } catch {
      return 0;
    }
  },

  // Perform sync with server
  syncGroupOperations: async (groupId: string): Promise<SyncResult> => {
    const pending = await getPendingOperations(groupId);
    if (pending.length === 0) {
      return { processed: 0, failed: 0, results: [] };
    }

    try {
      const response = await api.post<SyncResult>(`/groups/${groupId}/sync`, {
        operations: pending.map((op) => ({
          clientOperationId: op.id,
          entityType: op.entityType,
          action: op.action,
          payload: op.payload,
          createdAt: op.createdAt,
        })),
      });

      // Remove successful operations from IndexedDB
      const succeededIds = response.results
        .filter((r) => r.success)
        .map((r) => r.clientOperationId);

      await removeOperations(succeededIds);
      return response;
    } catch (err: any) {
      // Check for removed-member rejection
      if (
        err?.message?.includes('not an active member') ||
        err?.code === 'MEMBER_REMOVED' ||
        err?.code === 'FORBIDDEN'
      ) {
        // Clear local queue for security & integrity
        await clearGroupQueue(groupId);
        throw new Error('तुम्ही या गटाचे सक्रिय सदस्य नसल्याने स्थानिक नोंदी रद्द केल्या गेल्या आहेत.');
      }
      throw err;
    }
  },
};
