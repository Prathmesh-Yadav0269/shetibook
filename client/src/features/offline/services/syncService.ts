import {
  enqueueOperation,
  getPendingOperations,
  removeOperations,
  quarantineGroupOperations,
  getQuarantinedOperations,
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

  getQuarantinedCount: async (groupId: string): Promise<number> => {
    try {
      const quarantined = await getQuarantinedOperations(groupId);
      return quarantined.length;
    } catch {
      return 0;
    }
  },

  getQuarantinedList: async (groupId: string): Promise<QueuedSyncOperation[]> => {
    try {
      return await getQuarantinedOperations(groupId);
    } catch {
      return [];
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
      // Check for removed-member rejection / revoked authorization
      const isUnauthorizedOrRevoked =
        err?.status === 401 ||
        err?.status === 403 ||
        err?.code === 'FORBIDDEN_GROUP_ACCESS' ||
        err?.code === 'MEMBER_REMOVED' ||
        err?.code === 'FORBIDDEN' ||
        err?.message?.includes('not an active member');

      if (isUnauthorizedOrRevoked) {
        // Quarantine rejected operations: do NOT delete user-created records; preserve local data where safe
        const reason =
          'गट सदस्यत्व किंवा अधिकार संपुष्टात आल्यामुळे या स्थानिक नोंदी क्वारंटाइन (सुरक्षित राखून) ठेवल्या आहेत. (Operations quarantined: unauthorized to sync)';
        await quarantineGroupOperations(groupId, reason);
        throw new Error(reason);
      }
      throw err;
    }
  },
};
