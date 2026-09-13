/**
 * Monefy PWA - Core TypeScript Types & Models
 * Offline-first personal finance application with Google Sheets / Drive sync
 */

export interface AuditFields {
  id: string; // UUID v4
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  isDeleted: boolean; // Tombstone for soft deletes
  deletedAt?: string | null; // ISO 8601 UTC timestamp on soft delete
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdByDeviceId?: string;
  updatedByDeviceId?: string;
  deviceId?: string;
}

export type MovementType = 'expense' | 'income';

export interface Movement extends AuditFields {
  date: string; // YYYY-MM-DD or ISO 8601 date string
  amount: number; // positive float
  type: MovementType;
  description: string;
  categoryId: string;
  accountId: string;
  cardId?: string;
  notes?: string;
  ticketId?: string; // Reference to Ticket entity
}

export interface Transfer extends AuditFields {
  transferId?: string; // Explicit transfer ID matching requirement, synchronized with id
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description?: string;
}

export type AccountType = 'cash' | 'bank' | 'savings' | 'investment' | 'other';

export interface Account extends AuditFields {
  name: string;
  initialBalance: number;
  type: AccountType;
  color: string;
  icon?: string;
  currency?: string;
  visibility?: 'private' | 'shared';
  ownerUserId?: string;
  authorizedUserIds?: string[];
  authorizedUserEmails?: string[];
}

export type CardType = 'credit' | 'debit';

export interface Card extends AuditFields {
  accountId: string;
  name: string;
  last4: string;
  type: CardType;
  color: string;
  icon?: string;
  creditLimit?: number;
  cutoffDay?: number;
  paymentDay?: number;
  notes?: string;
}

export interface Category extends AuditFields {
  name: string;
  icon: string;
  color: string;
  type: MovementType;
}

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Recurring extends AuditFields {
  name: string;
  amount: number;
  type: MovementType;
  categoryId: string;
  accountId: string;
  cardId?: string;
  frequency: RecurrenceFrequency;
  intervalDays?: number; // Used when frequency === 'custom'
  startDate: string;
  nextDueDate: string;
  lastGeneratedDate?: string;
  occurrencesGenerated?: string[]; // Array of scheduledDate keys to prevent duplicates
}

export type BudgetPeriod = 'monthly' | 'yearly' | 'custom';

export interface Budget extends AuditFields {
  categoryId: string;
  amount: number;
  period?: BudgetPeriod;
  periodMonth?: string;
  startDate?: string;
  endDate?: string;
}

export type TicketStatus = 'pending_upload' | 'uploaded' | 'error';

export interface Ticket extends AuditFields {
  movementId?: string;
  fileName: string;
  mimeType: string;
  dataBase64?: string; // Stored locally in IndexedDB while pending_upload
  fileSize: number;
  driveFileId?: string; // Google Drive file ID once uploaded
  driveUrl?: string; // Google Drive web view URL
  folderId?: string; // Google Drive folder ID
  status: TicketStatus;
  error?: string;
}

export type SyncEntityType =
  | 'accounts'
  | 'cards'
  | 'categories'
  | 'movements'
  | 'transfers'
  | 'recurring'
  | 'budgets'
  | 'tickets'
  | 'users';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncQueueStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'conflict';

export interface SyncQueueItem {
  id: string; // UUID
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: any;
  createdAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  status: SyncQueueStatus;
  error?: string;
}

export type ConflictResolution = 'pending' | 'keep_local' | 'keep_remote' | 'manual';

export interface SyncConflict {
  id: string; // UUID
  conflictId: string;
  entityType: SyncEntityType;
  entityId: string;
  localVersion: any;
  remoteVersion: any;
  detectedAt: string;
  resolution: ConflictResolution;
  resolvedAt?: string;
}

export interface User extends AuditFields {
  email: string;
  name: string;
  avatarUrl?: string;
  currency?: string;
  role?: 'owner' | 'member' | string;
  googleId?: string;
  status?: 'active' | 'invited' | 'disabled';
}

export interface AppConfig {
  deviceId: string;
  userId: string;
  userName: string;
  userEmail: string;
  isSharedAccount: boolean;
  currency: string;
  appsScriptUrl: string;
  googleAccessToken?: string;
  googleTokenExpiresAt?: number;
  spreadsheetId?: string;
  spreadsheetName?: string;
  driveFolderId?: string;
  driveFolderName?: string;
  lastSyncTimestamp?: string | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'conflict' | 'pending';
  lastSyncError?: string | null;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  action: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

export type AuditLog = SyncLog;

// Request and Response interfaces for Google Apps Script API
export interface AppsScriptRequest<T = any> {
  requestId: string;
  userId?: string;
  deviceId: string;
  timestamp: string;
  action:
    | 'GET_DATA'
    | 'SYNC'
    | 'CREATE_RECORD'
    | 'UPDATE_RECORD'
    | 'DELETE_RECORD'
    | 'UPLOAD_TICKET'
    | 'GET_CONFIG'
    | 'CREATE_DATABASE'
    | 'CREATE_FOLDER'
    | 'CREATE_SPREADSHEET'
    | 'PING';
  payload: T;
}

export interface AppsScriptResponse<T = any> {
  success: boolean;
  requestId: string;
  timestamp: string;
  error?: string;
  data?: T;
}

export interface BankImportItem {
  id: string;
  date: string;
  amount: number;
  type: MovementType;
  description: string;
  accountId: string;
  categoryId: string;
  rawText?: string;
  isDuplicate?: boolean;
  selected?: boolean;
}
