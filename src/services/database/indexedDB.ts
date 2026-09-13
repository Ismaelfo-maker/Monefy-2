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
  User,
} from '../../types';
import { generateUUID } from '../../utils/uuid';
import { getOrCreateDeviceId } from '../../utils/device';

const DB_NAME = 'monefy_pwa_database';
const DB_VERSION = 2;

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
        const transaction = request.transaction!;

        // Safe helper to obtain existing store or create if absent
        const ensureStore = (
          name: string,
          options: IDBObjectStoreParameters
        ): IDBObjectStore => {
          if (!db.objectStoreNames.contains(name)) {
            return db.createObjectStore(name, options);
          }
          return transaction.objectStore(name);
        };

        // Safe helper to create index only if absent without re-creating stores
        const ensureIndex = (
          store: IDBObjectStore,
          name: string,
          keyPath: string | string[],
          options?: IDBIndexParameters
        ) => {
          if (!store.indexNames.contains(name)) {
            store.createIndex(name, keyPath, options);
          }
        };

        // Incremental migration for Phase 1: covers all 13 stores and exact operational indices
        if (oldVersion < 2) {
          // 1. users
          const usersStore = ensureStore('users', { keyPath: 'id' });
          ensureIndex(usersStore, 'by_email', 'email', { unique: false });
          ensureIndex(usersStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(usersStore, 'by_isDeleted', 'isDeleted', { unique: false });

          // 2. accounts
          const accountsStore = ensureStore('accounts', { keyPath: 'id' });
          ensureIndex(accountsStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(accountsStore, 'by_isDeleted', 'isDeleted', { unique: false });
          ensureIndex(accountsStore, 'by_visibility', 'visibility', { unique: false });

          // 3. cards
          const cardsStore = ensureStore('cards', { keyPath: 'id' });
          ensureIndex(cardsStore, 'by_accountId', 'accountId', { unique: false });
          ensureIndex(cardsStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(cardsStore, 'by_isDeleted', 'isDeleted', { unique: false });

          // 4. categories
          const categoriesStore = ensureStore('categories', { keyPath: 'id' });
          ensureIndex(categoriesStore, 'by_type', 'type', { unique: false });
          ensureIndex(categoriesStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(categoriesStore, 'by_isDeleted', 'isDeleted', { unique: false });

          // 5. movements
          const movementsStore = ensureStore('movements', { keyPath: 'id' });
          ensureIndex(movementsStore, 'by_date', 'date', { unique: false });
          ensureIndex(movementsStore, 'by_categoryId', 'categoryId', { unique: false });
          ensureIndex(movementsStore, 'by_accountId', 'accountId', { unique: false });
          ensureIndex(movementsStore, 'by_cardId', 'cardId', { unique: false });
          ensureIndex(movementsStore, 'by_ticketId', 'ticketId', { unique: false });
          ensureIndex(movementsStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(movementsStore, 'by_isDeleted', 'isDeleted', { unique: false });

          // 6. transfers (strictly independent from movements)
          const transfersStore = ensureStore('transfers', { keyPath: 'id' });
          ensureIndex(transfersStore, 'by_date', 'date', { unique: false });
          ensureIndex(transfersStore, 'by_fromAccountId', 'fromAccountId', { unique: false });
          ensureIndex(transfersStore, 'by_toAccountId', 'toAccountId', { unique: false });
          ensureIndex(transfersStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(transfersStore, 'by_isDeleted', 'isDeleted', { unique: false });

          // 7. recurring
          const recurringStore = ensureStore('recurring', { keyPath: 'id' });
          ensureIndex(recurringStore, 'by_nextDueDate', 'nextDueDate', { unique: false });
          ensureIndex(recurringStore, 'by_accountId', 'accountId', { unique: false });
          ensureIndex(recurringStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(recurringStore, 'by_isDeleted', 'isDeleted', { unique: false });

          // 8. budgets
          const budgetsStore = ensureStore('budgets', { keyPath: 'id' });
          ensureIndex(budgetsStore, 'by_categoryId', 'categoryId', { unique: false });
          ensureIndex(budgetsStore, 'by_periodMonth', 'periodMonth', { unique: false });
          ensureIndex(budgetsStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(budgetsStore, 'by_isDeleted', 'isDeleted', { unique: false });

          // 9. tickets
          const ticketsStore = ensureStore('tickets', { keyPath: 'id' });
          ensureIndex(ticketsStore, 'by_movementId', 'movementId', { unique: false });
          ensureIndex(ticketsStore, 'by_status', 'status', { unique: false });
          ensureIndex(ticketsStore, 'by_updatedAt', 'updatedAt', { unique: false });
          ensureIndex(ticketsStore, 'by_isDeleted', 'isDeleted', { unique: false });

          // 10. sync_queue
          const queueStore = ensureStore('sync_queue', { keyPath: 'id' });
          ensureIndex(queueStore, 'by_status', 'status', { unique: false });
          ensureIndex(queueStore, 'by_createdAt', 'createdAt', { unique: false });
          ensureIndex(queueStore, 'by_entityId', 'entityId', { unique: false });

          // 11. sync_conflicts
          const conflictsStore = ensureStore('sync_conflicts', { keyPath: 'id' });
          ensureIndex(conflictsStore, 'by_resolution', 'resolution', { unique: false });
          ensureIndex(conflictsStore, 'by_entityId', 'entityId', { unique: false });
          ensureIndex(conflictsStore, 'by_detectedAt', 'detectedAt', { unique: false });

          // 12. config (key-value store for app configuration)
          ensureStore('config', { keyPath: 'key' });

          // 13. sync_logs
          const logsStore = ensureStore('sync_logs', { keyPath: 'id' });
          ensureIndex(logsStore, 'by_timestamp', 'timestamp', { unique: false });
          ensureIndex(logsStore, 'by_status', 'status', { unique: false });
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

    const deviceId = getOrCreateDeviceId();
    const now = new Date().toISOString();

    // Ensure audit fields & stable UUID
    const enrichedItem: any = {
      ...item,
      id: item.id || generateUUID(),
      createdAt: (item as any).createdAt || now,
      updatedAt: now,
      isDeleted: (item as any).isDeleted ?? false,
      updatedByDeviceId: deviceId,
      deviceId: deviceId,
    };

    // Ensure Transfer has synchronized transferId
    if (storeName === 'transfers') {
      if (!enrichedItem.transferId) {
        enrichedItem.transferId = enrichedItem.id;
      }
    }

    await new Promise<void>((resolve, reject) => {
      const req = store.put(enrichedItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (enqueueSync) {
      const queueStore = tx.objectStore('sync_queue');
      const queueItem: SyncQueueItem = {
        id: generateUUID(),
        entityType: storeName as SyncEntityType,
        entityId: enrichedItem.id,
        operation,
        payload: enrichedItem,
        createdAt: now,
        retryCount: 0,
        status: 'pending',
      };
      queueStore.put(queueItem);
    }

    return enrichedItem as T;
  }

  public async softDeleteItem(
    storeName: string,
    id: string,
    enqueueSync = true
  ): Promise<boolean> {
    const existing = await this.getById<any>(storeName, id);
    if (!existing) return false;

    const deviceId = getOrCreateDeviceId();
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
      updatedByDeviceId: deviceId,
      deviceId: deviceId,
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
        createdAt: now,
        retryCount: 0,
        status: 'pending',
      };
      queueStore.put(queueItem);
    }

    return true;
  }

  // Raw put without queue (used by sync engine when pulling from remote)
  public async directPut<T extends { id: string }>(storeName: string, item: T): Promise<void> {
    const enrichedItem: any = { ...item };
    if (storeName === 'transfers' && !enrichedItem.transferId) {
      enrichedItem.transferId = enrichedItem.id;
    }

    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(enrichedItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // User Management
  public async getUser(id: string): Promise<User | null> {
    return this.getById<User>('users', id);
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const store = await this.getStore('users', 'readonly');
    return new Promise((resolve) => {
      if (!store.indexNames.contains('by_email')) {
        this.getAll<User>('users').then((users) => {
          resolve(users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null);
        });
        return;
      }
      const index = store.index('by_email');
      const req = index.get(email.toLowerCase());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  public async saveUser(user: User, enqueueSync = false): Promise<User> {
    return this.putItem<User>('users', user, enqueueSync, user.createdAt ? 'UPDATE' : 'CREATE');
  }

  public async getActiveUser(): Promise<User | null> {
    const config = await this.getConfig();
    if (!config.userId) return null;
    return this.getUser(config.userId);
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
          // Clean initial default configuration - No mock user or demo data
          const defaultConfig: AppConfig = {
            deviceId: getOrCreateDeviceId(),
            userId: '',
            userName: '',
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
          userId: '',
          userName: '',
          userEmail: '',
          isSharedAccount: false,
          currency: 'EUR',
          appsScriptUrl: '',
          syncStatus: 'idle',
          lastSyncTimestamp: null,
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
