import React, { useState } from 'react';
import { Upload, FileText, Check, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Account, Category, BankImportItem, Movement } from '../types';
import { bankImporter, BankFormat } from '../services/imports/bankImporter';
import { dbService } from '../services/database/indexedDB';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getOrCreateDeviceId } from '../utils/device';

interface BankImportViewProps {
  accounts: Account[];
  categories: Category[];
  currency: string;
  onImportComplete: () => void;
  onBack: () => void;
}

export const BankImportView: React.FC<BankImportViewProps> = ({
  accounts,
  categories,
  currency,
  onImportComplete,
  onBack,
}) => {
  const [bankFormat, setBankFormat] = useState<BankFormat>('ING');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [defaultCategoryId, setDefaultCategoryId] = useState(categories[0]?.id || '');
  const [rawCsv, setRawCsv] = useState('');
  const [parsedItems, setParsedItems] = useState<BankImportItem[]>([]);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRawCsv(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleParse = async () => {
    if (!rawCsv.trim() || !selectedAccountId) return;
    setIsProcessing(true);

    try {
      const items = await bankImporter.parseCSV(
        rawCsv,
        bankFormat,
        selectedAccountId,
        defaultCategoryId
      );
      setParsedItems(items);
      setStep('review');
    } catch (err) {
      alert('Error al analizar archivo CSV bancario');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemCategory = (id: string, newCatId: string) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, categoryId: newCatId } : item))
    );
  };

  const handleConfirmImport = async () => {
    const selected = parsedItems.filter((i) => i.selected);
    if (selected.length === 0) {
      alert('No has seleccionado ningún movimiento para importar.');
      return;
    }

    const deviceId = getOrCreateDeviceId();
    const config = await dbService.getConfig();
    const now = new Date().toISOString();

    for (const item of selected) {
      const movement: Movement = {
        id: item.id,
        date: item.date,
        amount: item.amount,
        type: item.type,
        description: item.description,
        categoryId: item.categoryId,
        accountId: item.accountId,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        createdByDeviceId: deviceId,
        createdByUserId: config.userId,
      };

      await dbService.putItem('movements', movement, true, 'CREATE');
    }

    alert(`¡Se han importado exitosamente ${selected.length} movimientos a tu dispositivo!`);
    onImportComplete();
    onBack();
  };

  const duplicatesCount = parsedItems.filter((i) => i.isDuplicate).length;
  const selectedCount = parsedItems.filter((i) => i.selected).length;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            Importación Bancaria (Offline-First)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compatible con ING, ABANCA, Revolut y CSV estándar con detección estricta de duplicados.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100"
        >
          Volver
        </button>
      </div>

      {step === 'upload' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Formato Bancario
              </label>
              <select
                value={bankFormat}
                onChange={(e) => setBankFormat(e.target.value as BankFormat)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold"
              >
                <option value="ING">ING Direct</option>
                <option value="ABANCA">ABANCA</option>
                <option value="REVOLUT">Revolut</option>
                <option value="GENERIC">CSV Genérico</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Cuenta de Destino
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Categoría por Defecto
              </label>
              <select
                value={defaultCategoryId}
                onChange={(e) => setDefaultCategoryId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
              Cargar Archivo CSV o Pegar Texto
            </label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
          </div>

          <div>
            <textarea
              rows={6}
              value={rawCsv}
              onChange={(e) => setRawCsv(e.target.value)}
              placeholder="O pega el contenido de tu extracto CSV aquí..."
              className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleParse}
              disabled={!rawCsv.trim() || isProcessing}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Analizar Movimientos</span>
            </button>
          </div>
        </div>
      ) : (
        /* Review Screen */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800">
                {parsedItems.length} movimientos detectados
              </span>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                <span>{selectedCount} seleccionados para importar</span>
                {duplicatesCount > 0 && (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    {duplicatesCount} duplicados detectados (desmarcados)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep('upload')}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Modificar CSV
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-40"
              >
                Confirmar e Importar {selectedCount}
              </button>
            </div>
          </div>

          {/* Table of Review Items */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] text-slate-400 uppercase font-bold">
                  <th className="py-2 px-2 w-8">Importar</th>
                  <th className="py-2 px-2">Fecha</th>
                  <th className="py-2 px-2">Concepto</th>
                  <th className="py-2 px-2 text-right">Importe</th>
                  <th className="py-2 px-2">Categoría</th>
                  <th className="py-2 px-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/70 transition ${
                      item.isDuplicate ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-2.5 px-2">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItemSelection(item.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-2 font-mono text-slate-600 whitespace-nowrap">
                      {formatDate(item.date)}
                    </td>
                    <td className="py-2.5 px-2 font-medium text-slate-800 max-w-xs truncate">
                      {item.description}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-black whitespace-nowrap ${
                        item.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {item.type === 'expense' ? '-' : '+'}
                      {formatCurrency(item.amount, currency)}
                    </td>
                    <td className="py-2.5 px-2">
                      <select
                        value={item.categoryId}
                        onChange={(e) => updateItemCategory(item.id, e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-1"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      {item.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Duplicado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Nuevo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
