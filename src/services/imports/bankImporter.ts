/**
 * Monefy PWA - Bank Importer Service
 * Parses and normalizes CSV exports from ING, ABANCA, Revolut, and Generic formats,
 * and detects duplicates against existing IndexedDB movements.
 */

import { BankImportItem, Movement } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { dbService } from '../database/indexedDB';

export type BankFormat = 'ING' | 'ABANCA' | 'REVOLUT' | 'GENERIC';

export class BankImporter {
  /**
   * Parse CSV content based on specified format
   */
  public async parseCSV(
    csvText: string,
    format: BankFormat,
    targetAccountId: string,
    defaultCategoryId: string
  ): Promise<BankImportItem[]> {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) return [];

    const existingMovements = await dbService.getAll<Movement>('movements');
    const items: BankImportItem[] = [];

    // Skip header row
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      // Split taking into account quoted CSV values
      const cols = this.parseCSVLine(line);
      if (cols.length < 2) continue;

      let date = '';
      let amount = 0;
      let description = '';

      if (format === 'ING') {
        // Typical ING: F.Operación;F.Valor;Descripción;Importe;Saldo
        date = this.normalizeDate(cols[0]);
        description = cols[2] || cols[1] || 'Movimiento ING';
        amount = this.normalizeAmount(cols[3]);
      } else if (format === 'ABANCA') {
        // Typical ABANCA: Fecha;Concepto;Importe;Divisa;Saldo
        date = this.normalizeDate(cols[0]);
        description = cols[1] || 'Movimiento ABANCA';
        amount = this.normalizeAmount(cols[2]);
      } else if (format === 'REVOLUT') {
        // Typical Revolut: Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
        date = this.normalizeDate(cols[2] || cols[3] || cols[0]);
        description = cols[4] || cols[0] || 'Movimiento Revolut';
        amount = this.normalizeAmount(cols[5]);
      } else {
        // Generic: Date, Amount, Description
        date = this.normalizeDate(cols[0]);
        amount = this.normalizeAmount(cols[1]);
        description = cols[2] || 'Movimiento';
      }

      if (!date || isNaN(amount) || amount === 0) continue;

      const type = amount < 0 ? 'expense' : 'income';
      const positiveAmount = Math.abs(amount);

      // Duplicate detection key: date + amount + description + account
      const isDuplicate = existingMovements.some((m) => {
        if (m.isDeleted) return false;
        if (m.accountId !== targetAccountId) return false;
        if (m.date !== date) return false;
        if (Math.abs(m.amount - positiveAmount) > 0.01) return false;
        // Check text similarity
        const d1 = (m.description || '').toLowerCase().trim();
        const d2 = description.toLowerCase().trim();
        return d1 === d2 || d1.includes(d2) || d2.includes(d1);
      });

      items.push({
        id: generateUUID(),
        date,
        amount: positiveAmount,
        type,
        description: description.replace(/"/g, ''),
        accountId: targetAccountId,
        categoryId: defaultCategoryId,
        rawText: line,
        isDuplicate,
        selected: !isDuplicate, // Default unselect detected duplicates
      });
    }

    return items;
  }

  private parseCSVLine(line: string): string[] {
    const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    const regex = new RegExp(
      `(?:^|\\${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"\\${delimiter}]*))`,
      'g'
    );
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      matches.push((match[1] || match[2] || '').trim());
    }
    return matches;
  }

  private normalizeDate(raw: string): string {
    if (!raw) return '';
    const clean = raw.trim().replace(/"/g, '');
    // DD/MM/YYYY or DD-MM-YYYY
    const parts = clean.split(/[/\-.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return clean.substring(0, 10);
  }

  private normalizeAmount(raw: string): number {
    if (!raw) return 0;
    // Replace European formatting (e.g. 1.250,50 -> 1250.50)
    let cleaned = raw.trim().replace(/"/g, '').replace(/\s+/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    // Remove non-numeric except - and .
    cleaned = cleaned.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
}

export const bankImporter = new BankImporter();
