/**
 * Monefy PWA - Recurring Movements Generator
 * Automatically creates pending occurrences based on frequency,
 * using unique (recurringId + scheduledDate) compound keys to strictly prevent duplicates across devices.
 */

import { Recurring, Movement } from '../../types';
import { dbService } from '../database/indexedDB';
import { generateUUID } from '../../utils/uuid';
import { getOrCreateDeviceId } from '../../utils/device';

export class RecurringService {
  /**
   * Process all active recurring rules and generate pending occurrences up to current date
   */
  public async processRecurringMovements(): Promise<{ generatedCount: number; errors: string[] }> {
    const rules = await dbService.getAll<Recurring>('recurring');
    const todayStr = new Date().toISOString().split('T')[0];
    let generatedCount = 0;
    const errors: string[] = [];

    for (const rule of rules) {
      if (rule.isDeleted) continue;

      try {
        const occurrences = rule.occurrencesGenerated || [];
        let nextDate = rule.nextDueDate || rule.startDate;
        let ruleUpdated = false;

        // Loop as long as nextDate is on or before today
        while (nextDate && nextDate <= todayStr) {
          const occurrenceKey = `${rule.id}_${nextDate}`;

          // Check if this occurrence was already generated
          if (!occurrences.includes(occurrenceKey)) {
            // Verify in existing movements as well
            const existingMovements = await dbService.getAll<Movement>('movements');
            const alreadyExists = existingMovements.some(
              (m) => (m as any).occurrenceKey === occurrenceKey
            );

            if (!alreadyExists) {
              const movement: Movement = {
                id: generateUUID(),
                date: nextDate,
                amount: rule.amount,
                type: rule.type,
                description: `${rule.name} (Recurrente)`,
                categoryId: rule.categoryId,
                accountId: rule.accountId,
                cardId: rule.cardId,
                notes: `Generado automáticamente por regla recurrente: ${rule.name}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isDeleted: false,
                createdByDeviceId: getOrCreateDeviceId(),
                createdByUserId: rule.createdByUserId,
              };

              // Attach custom field for duplicate avoidance
              (movement as any).occurrenceKey = occurrenceKey;
              (movement as any).recurringId = rule.id;

              await dbService.putItem('movements', movement, true, 'CREATE');
              occurrences.push(occurrenceKey);
              rule.lastGeneratedDate = nextDate;
              ruleUpdated = true;
              generatedCount++;
            } else {
              occurrences.push(occurrenceKey);
              ruleUpdated = true;
            }
          }

          // Advance to subsequent date based on recurrence frequency
          const computedNext = this.calculateNextDate(nextDate, rule.frequency, rule.intervalDays);
          if (!computedNext || computedNext === nextDate) {
            break; // Avoid infinite loops
          }
          nextDate = computedNext;
        }

        if (ruleUpdated) {
          rule.nextDueDate = nextDate;
          rule.occurrencesGenerated = occurrences;
          rule.updatedAt = new Date().toISOString();
          rule.updatedByDeviceId = getOrCreateDeviceId();
          await dbService.putItem('recurring', rule, true, 'UPDATE');
        }
      } catch (err: any) {
        errors.push(`Error procesando recurrente ${rule.name}: ${err.message || err}`);
      }
    }

    return { generatedCount, errors };
  }

  /**
   * Computes subsequent scheduled date based on recurrence pattern
   */
  public calculateNextDate(
    currentDateStr: string,
    frequency: Recurring['frequency'],
    intervalDays: number = 30
  ): string {
    const d = new Date(`${currentDateStr}T00:00:00`);

    switch (frequency) {
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'yearly':
        d.setFullYear(d.getFullYear() + 1);
        break;
      case 'custom':
        d.setDate(d.getDate() + Math.max(1, intervalDays || 1));
        break;
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

export const recurringService = new RecurringService();
