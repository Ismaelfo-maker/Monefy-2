/**
 * Monefy PWA - Backup and Export Service
 * Exports and restores entire dataset in JSON / CSV without sensitive tokens.
 */

import { dbService } from '../database/indexedDB';
import { generateUUID } from '../../utils/uuid';

export class BackupService {
  /**
   * Generates sanitized full backup object
   */
  public async generateFullBackup(): Promise<Record<string, any>> {
    const accounts = await dbService.getAll('accounts', true);
    const cards = await dbService.getAll('cards', true);
    const categories = await dbService.getAll('categories', true);
    const movements = await dbService.getAll('movements', true);
    const transfers = await dbService.getAll('transfers', true);
    const recurring = await dbService.getAll('recurring', true);
    const budgets = await dbService.getAll('budgets', true);
    const tickets = await dbService.getAll('tickets', true);
    const users = await dbService.getAll('users', true);
    const config = await dbService.getConfig();

    // Sanitize config - REMOVE OAUTH TOKENS AND SECRETS
    const sanitizedConfig = {
      deviceId: config.deviceId,
      userId: config.userId,
      userName: config.userName,
      currency: config.currency,
      spreadsheetId: config.spreadsheetId,
      spreadsheetName: config.spreadsheetName,
      driveFolderId: config.driveFolderId,
      driveFolderName: config.driveFolderName,
    };

    return {
      appName: 'Monefy PWA',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      config: sanitizedConfig,
      data: {
        users,
        accounts,
        cards,
        categories,
        movements,
        transfers,
        recurring,
        budgets,
        tickets,
      },
    };
  }

  /**
   * Downloads JSON backup file to user device
   */
  public async downloadJsonBackup(): Promise<void> {
    const backup = await this.generateFullBackup();
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monefy_backup_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Exports movements as CSV
   */
  public async downloadMovementsCsv(): Promise<void> {
    const movements = await dbService.getAll<any>('movements', false);
    const categories = await dbService.getAll<any>('categories', false);
    const accounts = await dbService.getAll<any>('accounts', false);

    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const accMap = new Map(accounts.map((a) => [a.id, a.name]));

    const headers = ['ID', 'Fecha', 'Tipo', 'Importe', 'Categoría', 'Cuenta', 'Descripción', 'Notas'];
    const rows = movements.map((m) => [
      m.id,
      m.date,
      m.type === 'expense' ? 'Gasto' : 'Ingreso',
      m.amount,
      `"${(catMap.get(m.categoryId) || 'Sin categoría').replace(/"/g, '""')}"`,
      `"${(accMap.get(m.accountId) || 'General').replace(/"/g, '""')}"`,
      `"${(m.description || '').replace(/"/g, '""')}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monefy_movimientos_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Restores data from validated JSON backup
   */
  public async restoreFromJson(
    jsonData: any,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<{ success: boolean; message: string; restoredCounts: Record<string, number> }> {
    if (!jsonData || !jsonData.data) {
      throw new Error('Formato de archivo de backup no válido.');
    }

    const { data } = jsonData;
    const restoredCounts: Record<string, number> = {};

    const entityStores = [
      'users',
      'accounts',
      'cards',
      'categories',
      'movements',
      'transfers',
      'recurring',
      'budgets',
      'tickets',
    ];

    for (const storeName of entityStores) {
      const records = data[storeName] || [];
      restoredCounts[storeName] = 0;

      for (const rec of records) {
        if (!rec.id) rec.id = generateUUID();
        await dbService.putItem(storeName, rec, true, 'CREATE');
        restoredCounts[storeName]++;
      }
    }

    await dbService.addLog('RESTORE', 'info', `Backup restaurado: ${JSON.stringify(restoredCounts)}`);

    return {
      success: true,
      message: 'Backup restaurado correctamente',
      restoredCounts,
    };
  }
}

export const backupService = new BackupService();
