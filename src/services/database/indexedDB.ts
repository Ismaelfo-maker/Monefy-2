/**
 * Monefy PWA - IndexedDB Service
 * Robust local persistence layer with migration support and sync queue integration
 */

import {
  Account,
  Card,
  Category,
  Movement,
  Transfer,
  Recurring,
  Budget,
  Ticket,
  User,
  SyncQueueItem,
  SyncConflict,
  SyncLog,
  AppConfig,
  SyncEntityType,
} from '../../types';
import { generateUUID } from '../../utils/uuid';
import { getOrCreateDeviceId } from '../../utils/device';

const DB_NAME = 'monefy_pwa_database';
const DB_VERSION = 1;

export class DatabaseService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  public async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;

        // Version 1 initialization and safe migration pattern
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id' });
          }

          if (!db.objectStoreNames.contains('accounts')) {
            const store = db.createObjectStore('accounts', { keyPath: 'id' });
            store.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains('cards')) {
            const store = db.createObjectStore('cards', { keyPath: 'id' });
            store.createIndex('accountId', 'accountId', { unique: false });
            store.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains('categories')) {
            const store = db.createObjectStore('categories', { keyPath: 'id' });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains('movements')) {
            const store = db.createObjectStore('movements', { keyPath: 'id' });
            store.createIndex('date', 'date', { unique: false });
            store.createIndex('categoryId', 'categoryId', { unique: false });
            store.createIndex('accountId', 'accountId', { unique: false });
            store.createIndex('cardId', 'cardId', { unique: false });
            store.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains('transfers')) {
            const store = db.createObjectStore('transfers', { keyPath: 'id' });
            store.createIndex('date', 'date', { unique: false });
            store.createIndex('fromAccountId', 'fromAccountId', { unique: false });
            store.createIndex('toAccountId', 'toAccountId', { unique: false });
            store.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains('recurring')) {
            const store = db.createObjectStore('recurring', { keyPath: 'id' });
            store.createIndex('nextDueDate', 'nextDueDate', { unique: false });
            store.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains('budgets')) {
            const store = db.createObjectStore('budgets', { keyPath: 'id' });
            store.createIndex('categoryId', 'categoryId', { unique: false });
            store.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains('tickets')) {
            const store = db.createObjectStore('tickets', { keyPath: 'id' });
            store.createIndex('movementId', 'movementId', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('isDeleted', 'isDeleted', { unique: false });
          }

          if (!db.objectStoreNames.contains('sync_queue')) {
            const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }

          if (!db.objectStoreNames.contains('sync_conflicts')) {
            const store = db.createObjectStore('sync_conflicts', { keyPath: 'id' });
            store.createIndex('resolution', 'resolution', { unique: false });
            store.createIndex('entityId', 'entityId', { unique: false });
          }

          if (!db.objectStoreNames.contains('config')) {
            db.createObjectStore('config', { keyPath: 'key' });
          }

          if (!db.objectStoreNames.contains('sync_logs')) {
            const store = db.createObjectStore('sync_logs', { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // Generic store access helper
  private async getStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.getDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Generic CRUD helpers
  public async getAll<T>(storeName: string, includeDeleted = false): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as any[];
        if (!includeDeleted) {
          resolve(results.filter((item) => !item.isDeleted));
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async getById<T>(storeName: string, id: string): Promise<T | null> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async putItem<T extends { id: string }>(
    storeName: string,
    item: T,
    enqueueSync = true,
    operation: 'CREATE' | 'UPDATE' = 'CREATE'
  ): Promise<T> {
    const db = await this.getDB();
    const tx = db.transaction(enqueueSync ? [storeName, 'sync_queue'] : [storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    await new Promise<void>((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (enqueueSync) {
      const queueStore = tx.objectStore('sync_queue');
      const queueItem: SyncQueueItem = {
        id: generateUUID(),
        entityType: storeName as SyncEntityType,
        entityId: item.id,
        operation,
        payload: item,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
      };
      queueStore.put(queueItem);
    }

    return item;
  }

  public async softDeleteItem(
    storeName: string,
    id: string,
    enqueueSync = true
  ): Promise<boolean> {
    const existing = await this.getById<any>(storeName, id);
    if (!existing) return false;

    const deviceId = getOrCreateDeviceId();
    const updated = {
      ...existing,
      isDeleted: true,
      updatedAt: new Date().toISOString(),
      updatedByDeviceId: deviceId,
    };

    const db = await this.getDB();
    const tx = db.transaction(enqueueSync ? [storeName, 'sync_queue'] : [storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(updated);

    if (enqueueSync) {
      const queueStore = tx.objectStore('sync_queue');
      const queueItem: SyncQueueItem = {
        id: generateUUID(),
        entityType: storeName as SyncEntityType,
        entityId: id,
        operation: 'DELETE',
        payload: updated,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
      };
      queueStore.put(queueItem);
    }

    return true;
  }

  // Raw put without queue (used by sync engine when pulling from remote)
  public async directPut<T extends { id: string }>(storeName: string, item: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // App Configuration in config store
  public async getConfig(): Promise<AppConfig> {
    const store = await this.getStore('config', 'readonly');
    return new Promise((resolve) => {
      const req = store.get('app_config');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve(req.result.value);
        } else {
          // Initial default configuration
          const defaultConfig: AppConfig = {
            deviceId: getOrCreateDeviceId(),
            userId: 'user_default',
            userName: 'Usuario Principal',
            userEmail: '',
            isSharedAccount: false,
            currency: 'EUR',
            appsScriptUrl: '',
            syncStatus: 'idle',
            lastSyncTimestamp: null,
          };
          resolve(defaultConfig);
        }
      };
      req.onerror = () => {
        resolve({
          deviceId: getOrCreateDeviceId(),
          userId: 'user_default',
          userName: 'Usuario Principal',
          userEmail: '',
          isSharedAccount: false,
          currency: 'EUR',
          appsScriptUrl: '',
          syncStatus: 'idle',
        });
      };
    });
  }

  public async saveConfig(config: AppConfig): Promise<void> {
    const store = await this.getStore('config', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ key: 'app_config', value: config });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Sync Logs
  public async addLog(
    action: string,
    status: 'success' | 'error' | 'warning' | 'info',
    message: string,
    details?: string
  ): Promise<void> {
    try {
      const store = await this.getStore('sync_logs', 'readwrite');
      const log: SyncLog = {
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        action,
        status,
        message,
        details,
      };
      store.put(log);
    } catch {
      console.warn('Could not write sync log to IndexedDB');
    }
  }

  public async getLogs(limit = 100): Promise<SyncLog[]> {
    const store = await this.getStore('sync_logs', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const logs = (req.result || []) as SyncLog[];
        logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        resolve(logs.slice(0, limit));
      };
      req.onerror = () => resolve([]);
    });
  }

  public async clearLogs(): Promise<void> {
    const store = await this.getStore('sync_logs', 'readwrite');
    return new Promise((resolve) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  // Sync Queue Operations
  public async getPendingQueueItems(): Promise<SyncQueueItem[]> {
    const store = await this.getStore('sync_queue', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as SyncQueueItem[];
        resolve(
          items
            .filter((item) => item.status === 'pending' || item.status === 'error')
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        );
      };
      req.onerror = () => resolve([]);
    });
  }

  public async updateQueueItem(item: SyncQueueItem): Promise<void> {
    const store = await this.getStore('sync_queue', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async removeQueueItem(id: string): Promise<void> {
    const store = await this.getStore('sync_queue', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Conflicts Operations
  public async getConflicts(): Promise<SyncConflict[]> {
    const store = await this.getStore('sync_conflicts', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as SyncConflict[];
        resolve(items.filter((item) => item.resolution === 'pending'));
      };
      req.onerror = () => resolve([]);
    });
  }

  public async saveConflict(conflict: SyncConflict): Promise<void> {
    const store = await this.getStore('sync_conflicts', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(conflict);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Balance Calculation (Pure derivation)
  public async getAccountBalances(): Promise<Record<string, number>> {
    const accounts = await this.getAll<Account>('accounts');
    const movements = await this.getAll<Movement>('movements');
    const transfers = await this.getAll<Transfer>('transfers');

    const balances: Record<string, number> = {};
    for (const acc of accounts) {
      balances[acc.id] = Number(acc.initialBalance || 0);
    }

    // Process active movements
    for (const mov of movements) {
      if (mov.isDeleted) continue;
      const amt = Number(mov.amount) || 0;
      if (balances[mov.accountId] !== undefined) {
        if (mov.type === 'income') {
          balances[mov.accountId] += amt;
        } else if (mov.type === 'expense') {
          balances[mov.accountId] -= amt;
        }
      }
    }

    // Process active transfers: Affects origin (-) and destination (+)
    for (const tr of transfers) {
      if (tr.isDeleted) continue;
      const amt = Number(tr.amount) || 0;
      if (balances[tr.fromAccountId] !== undefined) {
        balances[tr.fromAccountId] -= amt;
      }
      if (balances[tr.toAccountId] !== undefined) {
        balances[tr.toAccountId] += amt;
      }
    }

    return balances;
  }
}

export const dbService = new DatabaseService();
