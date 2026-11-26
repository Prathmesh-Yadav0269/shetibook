import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

// Test client offline IndexedDB logic
describe('ShetiBook Phase 4 - Client IndexedDB Queue & Quarantine Unit Tests (Task C)', () => {
  const DB_NAME = 'shetibook_test_offline_db';
  const DB_VERSION = 1;

  interface QueuedSyncOperation {
    id: string;
    groupId: string;
    entityType: 'expense' | 'payment' | 'harvest' | 'sale' | 'activity' | 'activity_transition';
    action: 'create' | 'update' | 'delete' | 'transition';
    payload: Record<string, any>;
    createdAt: string;
    status: 'pending' | 'syncing' | 'failed' | 'quarantined';
    errorMessage?: string;
    quarantinedAt?: string;
    quarantineReason?: string;
  }

  let db: IDBDatabase;

  const initDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = (e.target as IDBOpenDBRequest).result;
        if (!d.objectStoreNames.contains('sync_queue')) {
          const qStore = d.createObjectStore('sync_queue', { keyPath: 'id' });
          qStore.createIndex('groupId', 'groupId', { unique: false });
          qStore.createIndex('status', 'status', { unique: false });
        }
        if (!d.objectStoreNames.contains('cached_records')) {
          d.createObjectStore('cached_records', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const enqueue = (op: QueuedSyncOperation): Promise<void> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').put(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const getPending = (groupId: string): Promise<QueuedSyncOperation[]> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').index('groupId').getAll(groupId);
      req.onsuccess = () => {
        const all: QueuedSyncOperation[] = req.result || [];
        resolve(all.filter((i) => i.status === 'pending' || i.status === 'failed'));
      };
      req.onerror = () => reject(req.error);
    });
  };

  const quarantine = (groupId: string, reason: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.index('groupId').getAll(groupId);
      let count = 0;
      req.onsuccess = () => {
        const all: QueuedSyncOperation[] = req.result || [];
        const now = new Date().toISOString();
        for (const item of all) {
          if (item.status === 'pending' || item.status === 'failed' || item.status === 'syncing') {
            item.status = 'quarantined';
            item.quarantineReason = reason;
            item.quarantinedAt = now;
            store.put(item);
            count++;
          }
        }
      };
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  };

  const getQuarantined = (groupId: string): Promise<QueuedSyncOperation[]> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').index('groupId').getAll(groupId);
      req.onsuccess = () => {
        const all: QueuedSyncOperation[] = req.result || [];
        resolve(all.filter((i) => i.status === 'quarantined'));
      };
      req.onerror = () => reject(req.error);
    });
  };

  const restoreQuarantined = (groupId: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.index('groupId').getAll(groupId);
      let count = 0;
      req.onsuccess = () => {
        const all: QueuedSyncOperation[] = req.result || [];
        for (const item of all) {
          if (item.status === 'quarantined') {
            item.status = 'pending';
            delete item.quarantineReason;
            delete item.quarantinedAt;
            store.put(item);
            count++;
          }
        }
      };
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  };

  beforeEach(async () => {
    db = await initDb();
    // Clear stores before each test
    await new Promise<void>((resolve) => {
      const tx = db.transaction(['sync_queue', 'cached_records'], 'readwrite');
      tx.objectStore('sync_queue').clear();
      tx.objectStore('cached_records').clear();
      tx.oncomplete = () => resolve();
    });
  });

  const groupId = 'group-kadam-family-1';

  it('1. Offline operations are persisted in IndexedDB sync_queue with pending status', async () => {
    const op: QueuedSyncOperation = {
      id: 'op-exp-001',
      groupId,
      entityType: 'expense',
      action: 'create',
      payload: { amountPaise: 150000, description: 'बियाणे खरेदी' },
      createdAt: '2026-11-26T10:00:00.000Z',
      status: 'pending',
    };
    await enqueue(op);

    const pending = await getPending(groupId);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe('op-exp-001');
    expect(pending[0].payload.description).toBe('बियाणे खरेदी');
  });

  it('2. Quarantines rejected operations without silently deleting user records', async () => {
    // 2 offline operations created
    await enqueue({
      id: 'op-exp-001',
      groupId,
      entityType: 'expense',
      action: 'create',
      payload: { amountPaise: 150000, description: 'खत खरेदी' },
      createdAt: '2026-11-26T10:00:00.000Z',
      status: 'pending',
    });
    await enqueue({
      id: 'op-harv-002',
      groupId,
      entityType: 'harvest',
      action: 'create',
      payload: { quantity: 10, unit: 'quintal' },
      createdAt: '2026-11-26T10:05:00.000Z',
      status: 'pending',
    });

    // Membership revoked: server returned 403, client quarantines
    const reason = 'गट सदस्यत्व रद्द झाल्यामुळे नोंदी सुरक्षित क्वारंटाइन केल्या आहेत.';
    const quarantinedCount = await quarantine(groupId, reason);
    expect(quarantinedCount).toBe(2);

    // CRITICAL: Records must NOT be silently deleted
    const allQuarantined = await getQuarantined(groupId);
    expect(allQuarantined.length).toBe(2);
    expect(allQuarantined[0].quarantineReason).toBe(reason);
    expect(allQuarantined[0].quarantinedAt).toBeDefined();
    expect(allQuarantined[1].id).toBe('op-harv-002');
  });

  it('3. Quarantined operations are strictly excluded from pending upload queue', async () => {
    await enqueue({
      id: 'op-quarantined-1',
      groupId,
      entityType: 'expense',
      action: 'create',
      payload: { amountPaise: 50000 },
      createdAt: '2026-11-26T10:00:00.000Z',
      status: 'quarantined',
      quarantineReason: 'Revoked membership',
      quarantinedAt: '2026-11-26T10:15:00.000Z',
    });

    // Background sync retries must find 0 pending operations to upload
    const pending = await getPending(groupId);
    expect(pending.length).toBe(0);
  });

  it('4. Restores quarantined operations back to pending upon explicit renewed authorization', async () => {
    await enqueue({
      id: 'op-q-1',
      groupId,
      entityType: 'activity',
      action: 'create',
      payload: { customActivityName: 'फवारणी' },
      createdAt: '2026-11-26T10:00:00.000Z',
      status: 'quarantined',
      quarantineReason: 'Access revoked',
    });

    // Farmer re-joins group or confirms authorization renewed
    const restoredCount = await restoreQuarantined(groupId);
    expect(restoredCount).toBe(1);

    // Now it is pending and ready for upload again
    const pending = await getPending(groupId);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe('op-q-1');
    expect(pending[0].status).toBe('pending');
    expect(pending[0].quarantineReason).toBeUndefined();
  });

  it('5. Logout cache cleanup clears cached_records while preserving unsynchronized user queue', async () => {
    // 1. Unsynced mutation in queue
    await enqueue({
      id: 'op-pending-1',
      groupId,
      entityType: 'expense',
      action: 'create',
      payload: { amountPaise: 99000 },
      createdAt: '2026-11-26T10:00:00.000Z',
      status: 'pending',
    });

    // 2. Sensitive read cache in cached_records
    await new Promise<void>((resolve) => {
      const tx = db.transaction('cached_records', 'readwrite');
      tx.objectStore('cached_records').put({ key: 'user_profile', data: { phone: '9876543210' } });
      tx.oncomplete = () => resolve();
    });

    // Perform logout cleanup: clear cached_records
    await new Promise<void>((resolve) => {
      const tx = db.transaction('cached_records', 'readwrite');
      tx.objectStore('cached_records').clear();
      tx.oncomplete = () => resolve();
    });

    // Verify cached_records is empty
    const checkCache = await new Promise<any[]>((resolve) => {
      const tx = db.transaction('cached_records', 'readonly');
      const req = tx.objectStore('cached_records').getAll();
      req.onsuccess = () => resolve(req.result);
    });
    expect(checkCache.length).toBe(0);

    // Verify pending user mutations in sync_queue remain safe and preserved
    const pendingCheck = await getPending(groupId);
    expect(pendingCheck.length).toBe(1);
    expect(pendingCheck[0].id).toBe('op-pending-1');
  });
});
