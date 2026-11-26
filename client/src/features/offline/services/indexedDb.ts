const DB_NAME = 'shetibook_offline_db';
const DB_VERSION = 1;

export interface QueuedSyncOperation {
  id: string; // clientOperationId (UUID)
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

let dbInstance: IDBDatabase | null = null;

export const initIndexedDb = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported on this device.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Queue for outgoing offline operations
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        queueStore.createIndex('groupId', 'groupId', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }

      // 2. Local cache for offline reading
      if (!db.objectStoreNames.contains('cached_records')) {
        db.createObjectStore('cached_records', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const enqueueOperation = async (op: QueuedSyncOperation): Promise<void> => {
  const db = await initIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const req = store.put(op);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getPendingOperations = async (groupId: string): Promise<QueuedSyncOperation[]> => {
  const db = await initIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const index = store.index('groupId');
    const req = index.getAll(groupId);
    req.onsuccess = () => {
      const all: QueuedSyncOperation[] = req.result || [];
      resolve(all.filter((item) => item.status === 'pending' || item.status === 'failed'));
    };
    req.onerror = () => reject(req.error);
  });
};

export const removeOperations = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const db = await initIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const quarantineGroupOperations = async (
  groupId: string,
  reason: string
): Promise<number> => {
  const db = await initIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const index = store.index('groupId');
    const req = index.getAll(groupId);

    let quarantinedCount = 0;
    req.onsuccess = () => {
      const items: QueuedSyncOperation[] = req.result || [];
      const now = new Date().toISOString();
      for (const item of items) {
        if (item.status === 'pending' || item.status === 'failed' || item.status === 'syncing') {
          item.status = 'quarantined';
          item.quarantineReason = reason;
          item.quarantinedAt = now;
          store.put(item);
          quarantinedCount++;
        }
      }
    };

    tx.oncomplete = () => resolve(quarantinedCount);
    tx.onerror = () => reject(tx.error);
  });
};

export const getQuarantinedOperations = async (groupId: string): Promise<QueuedSyncOperation[]> => {
  const db = await initIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const index = store.index('groupId');
    const req = index.getAll(groupId);
    req.onsuccess = () => {
      const all: QueuedSyncOperation[] = req.result || [];
      resolve(all.filter((item) => item.status === 'quarantined'));
    };
    req.onerror = () => reject(req.error);
  });
};

/**
 * Restores quarantined operations back to pending status after renewed authorization.
 * Explicit action required by farmer; never automatically triggered on plain login.
 */
export const restoreQuarantinedOperations = async (groupId: string): Promise<number> => {
  const db = await initIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const index = store.index('groupId');
    const req = index.getAll(groupId);

    let restoredCount = 0;
    req.onsuccess = () => {
      const items: QueuedSyncOperation[] = req.result || [];
      for (const item of items) {
        if (item.status === 'quarantined') {
          item.status = 'pending';
          delete item.quarantineReason;
          delete item.quarantinedAt;
          store.put(item);
          restoredCount++;
        }
      }
    };

    tx.oncomplete = () => resolve(restoredCount);
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Permanently discards quarantined operations if the farmer explicitly requests it.
 */
export const deleteQuarantinedOperations = async (groupId: string): Promise<number> => {
  const db = await initIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const index = store.index('groupId');
    const req = index.getAll(groupId);

    let deletedCount = 0;
    req.onsuccess = () => {
      const items: QueuedSyncOperation[] = req.result || [];
      for (const item of items) {
        if (item.status === 'quarantined') {
          store.delete(item.id);
          deletedCount++;
        }
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(tx.error);
  });
};

export const clearGroupQueue = async (groupId: string): Promise<void> => {
  const db = await initIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const index = store.index('groupId');
    const req = index.getAllKeys(groupId);
    req.onsuccess = () => {
      const keys = req.result;
      keys.forEach((k) => store.delete(k));
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const clearCachedRecords = async (): Promise<void> => {
  try {
    const db = await initIndexedDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_records', 'readwrite');
      const store = tx.objectStore('cached_records');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // If indexedDb not available or fails, silently resolve
  }
};
