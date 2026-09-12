/**
 * Monefy PWA - Synchronization Engine
 * Manages two-way sync between IndexedDB and Google Sheets via Apps Script,
 * with UUID-based merges, offline queuing, and conflict detection.
 */

import {
  SyncQueueItem,
  SyncConflict,
  AppConfig,
  SyncEntityType,
} from '../../types';
import { dbService } from '../database/indexedDB';
import { googleApi } from '../google/apiClient';
import { generateUUID } from '../../utils/uuid';

export class SyncEngine {
  private isSyncing = false;
  private listeners: Array<(status: AppConfig['syncStatus'], message?: string) => void> = [];

  public subscribe(callback: (status: AppConfig['syncStatus'], message?: string) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notify(status: AppConfig['syncStatus'], message?: string) {
    this.listeners.forEach((l) => l(status, message));
  }

  /**
   * Run synchronization process
   */
  public async sync(): Promise<{ success: boolean; message: string; conflictsCount?: number }> {
    // 1. Guard against concurrent syncs on same device
    if (this.isSyncing) {
      return { success: false, message: 'Una sincronización ya está en curso' };
    }

    if (!navigator.onLine) {
      await this.updateStatus('pending', 'Sin conexión a Internet (Offline)');
      return { success: false, message: 'Sin conexión a Internet' };
    }

    const config = await dbService.getConfig();
    if (!config.appsScriptUrl || !config.appsScriptUrl.trim()) {
      await this.updateStatus('idle', 'Apps Script no configurado');
      return {
        success: false,
        message: 'Google Apps Script no configurado. Ve a Configuración para enlazarlo.',
      };
    }

    this.isSyncing = true;
    await this.updateStatus('syncing', 'Sincronizando con Google Sheets...');

    try {
      // 2. Read pending queue
      const pendingItems = await dbService.getPendingQueueItems();

      // 3. Mark items as 'syncing' in queue
      for (const item of pendingItems) {
        item.status = 'syncing';
        item.lastAttemptAt = new Date().toISOString();
        item.retryCount += 1;
        await dbService.updateQueueItem(item);
      }

      // 4. Send SYNC request to Apps Script
      const syncPayload = {
        operations: pendingItems,
        lastSyncTimestamp: config.lastSyncTimestamp,
        spreadsheetId: config.spreadsheetId,
      };

      const response = await googleApi.sendRequest<{
        processedOperations: string[];
        errors: Array<{ opId: string; error: string }>;
        serverTimestamp: string;
        remoteChanges: Record<string, any[]>;
      }>('SYNC', syncPayload);

      if (!response.success || !response.data) {
        // Rollback status in queue to 'error' or 'pending'
        for (const item of pendingItems) {
          item.status = 'error';
          item.error = response.error || 'Error desconocido del servidor';
          await dbService.updateQueueItem(item);
        }

        const errMsg = response.error || 'Error devuelto por Apps Script';
        await this.updateStatus('error', errMsg);
        await dbService.addLog('SYNC', 'error', errMsg);
        this.isSyncing = false;
        return { success: false, message: errMsg };
      }

      const { processedOperations, errors, serverTimestamp, remoteChanges } = response.data;

      // 5. Remove or mark processed operations from sync_queue
      for (const opId of processedOperations) {
        await dbService.removeQueueItem(opId);
      }

      // If any specific operations failed on server
      if (errors && errors.length > 0) {
        for (const errItem of errors) {
          const item = pendingItems.find((p) => p.id === errItem.opId);
          if (item) {
            item.status = 'error';
            item.error = errItem.error;
            await dbService.updateQueueItem(item);
          }
        }
      }

      // 6. Merge Remote Changes into Local IndexedDB
      let detectedConflicts = 0;
      if (remoteChanges) {
        detectedConflicts = await this.mergeRemoteDeltas(remoteChanges, config.lastSyncTimestamp);
      }

      // 7. Sync pending tickets to Drive if any exist
      await this.syncPendingTickets(config);

      // 8. Update configuration and status
      config.lastSyncTimestamp = serverTimestamp || new Date().toISOString();
      config.lastSyncError = null;
      config.syncStatus = detectedConflicts > 0 ? 'conflict' : 'synced';
      await dbService.saveConfig(config);

      await dbService.addLog(
        'SYNC',
        'success',
        `Sincronización completada. ${processedOperations.length} ops subidas, ${detectedConflicts} conflictos.`
      );

      this.notify(config.syncStatus, 'Sincronizado');
      this.isSyncing = false;

      return {
        success: true,
        message: 'Sincronización completada con éxito',
        conflictsCount: detectedConflicts,
      };
    } catch (err: any) {
      const errMsg = err.message || 'Fallo inesperado durante la sincronización';
      await this.updateStatus('error', errMsg);
      await dbService.addLog('SYNC', 'error', errMsg);
      this.isSyncing = false;
      return { success: false, message: errMsg };
    }
  }

  /**
   * Merge remote deltas with local IndexedDB records by UUID
   */
  private async mergeRemoteDeltas(
    remoteChanges: Record<string, any[]>,
    clientLastSync: string | null | undefined
  ): Promise<number> {
    let conflictCount = 0;
    const entityKeys = Object.keys(remoteChanges) as SyncEntityType[];

    for (const entityType of entityKeys) {
      const remoteItems = remoteChanges[entityType] || [];
      for (const remoteItem of remoteItems) {
        if (!remoteItem.id) continue;

        const localItem = await dbService.getById<any>(entityType, remoteItem.id);

        if (!localItem) {
          // Only exists remotely: Insert locally directly
          await dbService.directPut(entityType, remoteItem);
        } else {
          // Exists on both: Check timestamps
          const localUpdated = localItem.updatedAt || localItem.createdAt || '';
          const remoteUpdated = remoteItem.updatedAt || remoteItem.createdAt || '';

          if (localUpdated === remoteUpdated) {
            // Already identical or in sync
            continue;
          }

          // If local was updated after last sync AND remote was also updated
          if (clientLastSync && localUpdated > clientLastSync && remoteUpdated > clientLastSync) {
            // Both sides modified concurrently -> Conflict!
            const conflict: SyncConflict = {
              id: generateUUID(),
              conflictId: `conf_${generateUUID().substring(0, 8)}`,
              entityType,
              entityId: remoteItem.id,
              localVersion: localItem,
              remoteVersion: remoteItem,
              detectedAt: new Date().toISOString(),
              resolution: 'pending',
            };
            await dbService.saveConflict(conflict);
            conflictCount += 1;
            await dbService.addLog(
              'CONFLICT',
              'warning',
              `Conflicto en ${entityType} ID: ${remoteItem.id}`
            );
          } else if (remoteUpdated > localUpdated) {
            // Remote is newer, update local directly
            await dbService.directPut(entityType, remoteItem);
          }
          // If local is newer and wasn't sent yet, it's either in sync_queue or will be sent on next cycle
        }
      }
    }

    return conflictCount;
  }

  /**
   * Process offline ticket photos and upload to Google Drive
   */
  private async syncPendingTickets(config: AppConfig): Promise<void> {
    const tickets = await dbService.getAll<any>('tickets', false);
    const pendingTickets = tickets.filter(
      (t) => t.status === 'pending_upload' && t.dataBase64
    );

    for (const ticket of pendingTickets) {
      try {
        const uploadRes = await googleApi.sendRequest<{
          fileId: string;
          webViewLink: string;
        }>('UPLOAD_TICKET', {
          folderId: config.driveFolderId,
          fileName: ticket.fileName || `ticket_${ticket.id}.jpg`,
          mimeType: ticket.mimeType || 'image/jpeg',
          dataBase64: ticket.dataBase64,
          ticketRecord: ticket,
        });

        if (uploadRes.success && uploadRes.data) {
          ticket.driveFileId = uploadRes.data.fileId;
          ticket.driveUrl = uploadRes.data.webViewLink;
          ticket.status = 'uploaded';
          ticket.updatedAt = new Date().toISOString();
          // Keep local base64 for offline viewing, but mark uploaded
          await dbService.directPut('tickets', ticket);
          await dbService.addLog('TICKET_UPLOAD', 'success', `Ticket ${ticket.id} subido a Drive`);
        }
      } catch (err: any) {
        console.warn('Failed to upload ticket to Drive:', err);
      }
    }
  }

  /**
   * Resolve a recorded sync conflict
   */
  public async resolveConflict(
    conflictId: string,
    resolution: 'keep_local' | 'keep_remote' | 'manual',
    customData?: any
  ): Promise<void> {
    const conflicts = await dbService.getAll<SyncConflict>('sync_conflicts', true);
    const conflict = conflicts.find((c) => c.id === conflictId || c.conflictId === conflictId);

    if (!conflict) return;

    const { entityType, localVersion, remoteVersion } = conflict;

    if (resolution === 'keep_local') {
      // Re-enqueue local version as UPDATE to overwrite remote
      await dbService.putItem(entityType, localVersion, true, 'UPDATE');
    } else if (resolution === 'keep_remote') {
      // Overwrite local with remote version
      await dbService.directPut(entityType, remoteVersion);
    } else if (resolution === 'manual' && customData) {
      // Save manual merge locally and enqueue update
      await dbService.putItem(entityType, customData, true, 'UPDATE');
    }

    conflict.resolution = resolution;
    conflict.resolvedAt = new Date().toISOString();
    await dbService.saveConflict(conflict);

    // Trigger sync to push resolution
    this.sync();
  }

  private async updateStatus(status: AppConfig['syncStatus'], message: string) {
    const config = await dbService.getConfig();
    config.syncStatus = status;
    if (status === 'error') {
      config.lastSyncError = message;
    }
    await dbService.saveConfig(config);
    this.notify(status, message);
  }
}

export const syncEngine = new SyncEngine();
