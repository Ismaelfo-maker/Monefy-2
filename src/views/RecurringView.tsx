import React, { useState } from 'react';
import { Repeat, Plus, Calendar, Play, Trash2, Edit2, CheckCircle2 } from 'lucide-react';
import { Recurring, Account, Category, MovementType } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { generateUUID } from '../utils/uuid';
import { getOrCreateDeviceId } from '../utils/device';
import { dbService } from '../services/database/indexedDB';
import { recurringService } from '../services/recurring/recurringService';
import { getCategoryIcon } from '../utils/categoryIcons';

interface RecurringViewProps {
  recurringRules: Recurring[];
  accounts: Account[];
  categories: Category[];
  currency: string;
  onRefresh: () => void;
}

export const RecurringView: React.FC<RecurringViewProps> = ({
  recurringRules,
  accounts,
  categories,
  currency,
  onRefresh,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Recurring | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<MovementType>('expense');
  const [frequency, setFrequency] = useState<Recurring['frequency']>('monthly');
  const [intervalDays, setIntervalDays] = useState('30');
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');

  const activeRules = recurringRules.filter((r) => !r.isDeleted);
  const activeCategories = categories.filter((c) => !c.isDeleted && c.type === type);

  const handleOpenNew = () => {
    setEditingRule(null);
    setName('');
    setAmount('');
    setType('expense');
    setFrequency('monthly');
    setIntervalDays('30');
    setStartDate(new Date().toISOString().substring(0, 10));
    setAccountId(accounts[0]?.id || '');
    setCategoryId(categories.find((c) => c.type === 'expense')?.id || '');
    setShowModal(true);
  };

  const handleOpenEdit = (rule: Recurring) => {
    setEditingRule(rule);
    setName(rule.name);
    setAmount(String(rule.amount));
    setType(rule.type);
    setFrequency(rule.frequency);
    setIntervalDays(String(rule.intervalDays || 30));
    setStartDate(rule.startDate);
    setAccountId(rule.accountId);
    setCategoryId(rule.categoryId);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!name.trim() || isNaN(parsedAmount) || parsedAmount <= 0 || !accountId || !categoryId)
      return;

    const deviceId = getOrCreateDeviceId();
    const config = await dbService.getConfig();
    const now = new Date().toISOString();

    const rule: Recurring = {
      id: editingRule?.id || generateUUID(),
      name: name.trim(),
      amount: parsedAmount,
      type,
      frequency,
      intervalDays: frequency === 'custom' ? parseInt(intervalDays) || 30 : undefined,
      startDate,
      nextDueDate: editingRule?.nextDueDate || startDate,
      accountId,
      categoryId,
      occurrencesGenerated: editingRule?.occurrencesGenerated || [],
      lastGeneratedDate: editingRule?.lastGeneratedDate,
      createdAt: editingRule?.createdAt || now,
      updatedAt: now,
      isDeleted: false,
      createdByDeviceId: editingRule?.createdByDeviceId || deviceId,
      updatedByDeviceId: deviceId,
      createdByUserId: editingRule?.createdByUserId || config.userId,
      updatedByUserId: config.userId,
    };

    await dbService.putItem('recurring', rule, true, editingRule ? 'UPDATE' : 'CREATE');
    setShowModal(false);

    // Run generation immediately to catch any past or today occurrences
    await recurringService.processRecurringMovements();
    onRefresh();
  };

  const handleDelete = async (rule: Recurring) => {
    if (!confirm(`¿Eliminar la regla recurrente "${rule.name}"?`)) return;
    await dbService.softDeleteItem('recurring', rule.id, true);
    onRefresh();
  };

  const handleRunNow = async () => {
    setProcessingStatus('Comprobando y generando movimientos pendientes...');
    const res = await recurringService.processRecurringMovements();
    if (res.generatedCount > 0) {
      setProcessingStatus(`¡Se han generado ${res.generatedCount} nuevos movimientos pendientes!`);
    } else {
      setProcessingStatus('Al día: no hay ocurrencias pendientes que generar.');
    }
    setTimeout(() => setProcessingStatus(null), 4000);
    onRefresh();
  };

  const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const accMap = new Map<string, Account>(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-4 pb-24">
      {/* Action Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Repeat className="w-5 h-5 text-emerald-600" />
            Gastos e Ingresos Recurrentes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generación automática con claves únicas (ID + fecha) para evitar duplicados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunNow}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-semibold transition"
            title="Generar pendientes ahora"
          >
            <Play className="w-3.5 h-3.5 text-emerald-600" />
            <span>Generar Ahora</span>
          </button>

          <button
            onClick={handleOpenNew}
            disabled={accounts.length === 0}
            className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-xs transition disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Regla</span>
          </button>
        </div>
      </div>

      {processingStatus && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{processingStatus}</span>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider px-1">
          Reglas Activas ({activeRules.length})
        </h3>

        {activeRules.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No tienes pagos ni cobros periódicos configurados (alquiler, nómina, suscripciones, etc.).
          </div>
        ) : (
          <div className="space-y-3">
            {activeRules.map((rule) => {
              const cat = catMap.get(rule.categoryId);
              const acc = accMap.get(rule.accountId);
              const Icon = cat ? getCategoryIcon(cat.icon) : Repeat;

              return (
                <div
                  key={rule.id}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: cat?.color || '#10b981' }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{rule.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {rule.frequency === 'weekly'
                          ? 'Semanal'
                          : rule.frequency === 'monthly'
                          ? 'Mensual'
                          : rule.frequency === 'yearly'
                          ? 'Anual'
                          : `Cada ${rule.intervalDays} días`}
                        {' • '}
                        {cat?.name || 'Categoría'} • {acc?.name || 'Cuenta'}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                        Próxima fecha: <strong>{formatDate(rule.nextDueDate || rule.startDate)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-black ${
                        rule.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {rule.type === 'expense' ? '-' : '+'}
                      {formatCurrency(rule.amount, currency)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(rule)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingRule ? 'Editar Recurrente' : 'Nuevo Recurrente'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="p. ej. Alquiler, Spotify, Nómina"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const newType = e.target.value as MovementType;
                      setType(newType);
                      setCategoryId(categories.find((c) => c.type === newType)?.id || '');
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Importe (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Frecuencia
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
                  >
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                    <option value="yearly">Anual</option>
                    <option value="custom">Personalizada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              {frequency === 'custom' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Intervalo en días
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Cuenta
                  </label>
                  <select
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
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
                    Categoría
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
