import React, { useState } from 'react';
import { Target, Plus, AlertCircle, CheckCircle, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { Budget, Category, Movement } from '../types';
import { formatCurrency } from '../utils/formatters';
import { generateUUID } from '../utils/uuid';
import { getOrCreateDeviceId } from '../utils/device';
import { dbService } from '../services/database/indexedDB';
import { getCategoryIcon } from '../utils/categoryIcons';

interface BudgetsViewProps {
  budgets: Budget[];
  categories: Category[];
  movements: Movement[];
  currency: string;
  onRefresh: () => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgets,
  categories,
  movements,
  currency,
  onRefresh,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Form state
  const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const [budgetMonth, setBudgetMonth] = useState(currentMonthStr);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');

  // Calculate current month expenses
  const activeCategories = categories.filter((c) => !c.isDeleted && c.type === 'expense');

  // Compute expenses for the selected month by category
  const monthlyExpenses = movements.filter((m) => {
    if (m.isDeleted || m.type !== 'expense') return false;
    return m.date.startsWith(budgetMonth);
  });

  const categoryExpenses: Record<string, number> = {};
  monthlyExpenses.forEach((m) => {
    categoryExpenses[m.categoryId] = (categoryExpenses[m.categoryId] || 0) + (Number(m.amount) || 0);
  });

  const totalSpentMonth = monthlyExpenses.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  // Filter budgets for the selected month
  const activeBudgets = budgets.filter((b) => !b.isDeleted && b.periodMonth === budgetMonth);
  const totalBudgeted = activeBudgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const globalProgress = totalBudgeted > 0 ? (totalSpentMonth / totalBudgeted) * 100 : 0;

  const handleOpenNew = () => {
    setEditingBudget(null);
    setCategoryId(activeCategories[0]?.id || '');
    setAmount('');
    setShowModal(true);
  };

  const handleOpenEdit = (b: Budget) => {
    setEditingBudget(b);
    setCategoryId(b.categoryId);
    setAmount(String(b.amount));
    setBudgetMonth(b.periodMonth);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!categoryId || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const deviceId = getOrCreateDeviceId();
    const config = await dbService.getConfig();
    const now = new Date().toISOString();

    const budget: Budget = {
      id: editingBudget?.id || generateUUID(),
      categoryId,
      amount: parsedAmount,
      periodMonth: budgetMonth,
      createdAt: editingBudget?.createdAt || now,
      updatedAt: now,
      isDeleted: false,
      createdByDeviceId: editingBudget?.createdByDeviceId || deviceId,
      updatedByDeviceId: deviceId,
      createdByUserId: editingBudget?.createdByUserId || config.userId,
      updatedByUserId: config.userId,
    };

    await dbService.putItem('budgets', budget, true, editingBudget ? 'UPDATE' : 'CREATE');
    setShowModal(false);
    onRefresh();
  };

  const handleDelete = async (b: Budget) => {
    if (!confirm('¿Eliminar este presupuesto?')) return;
    await dbService.softDeleteItem('budgets', b.id, true);
    onRefresh();
  };

  const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-4 pb-24">
      {/* Month Selector & Global Target */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Control de Presupuestos
            </span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="month"
                value={budgetMonth}
                onChange={(e) => setBudgetMonth(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
              />
            </div>
          </div>
          <button
            id="btn-new-budget"
            onClick={handleOpenNew}
            disabled={activeCategories.length === 0}
            className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Fijar Presupuesto</span>
          </button>
        </div>

        {/* Global Progress Bar */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700">Total Gastado vs Total Presupuestado</span>
            <span
              className={
                globalProgress > 100
                  ? 'text-rose-600'
                  : globalProgress >= 80
                  ? 'text-amber-600'
                  : 'text-emerald-700'
              }
            >
              {globalProgress.toFixed(1)}%
            </span>
          </div>

          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                globalProgress > 100
                  ? 'bg-rose-500'
                  : globalProgress >= 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, globalProgress)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Gastado: {formatCurrency(totalSpentMonth, currency)}</span>
            <span>Límite: {formatCurrency(totalBudgeted, currency)}</span>
          </div>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider px-1">
          Presupuestos por Categoría ({activeBudgets.length})
        </h3>

        {activeBudgets.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            No has asignado presupuestos para este mes. Pulsa "Fijar Presupuesto" para comenzar.
          </div>
        ) : (
          <div className="space-y-3">
            {activeBudgets.map((b) => {
              const cat = catMap.get(b.categoryId);
              const spent = categoryExpenses[b.categoryId] || 0;
              const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
              const remaining = b.amount - spent;
              const Icon = cat ? getCategoryIcon(cat.icon) : Target;

              let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
              let barColor = 'bg-emerald-500';
              let StatusIcon = CheckCircle;
              let statusText = 'Normal (< 80%)';

              if (percent > 100) {
                statusColor = 'text-rose-800 bg-rose-50 border-rose-200';
                barColor = 'bg-rose-500';
                StatusIcon = AlertCircle;
                statusText = 'Excedido (> 100%)';
              } else if (percent >= 80) {
                statusColor = 'text-amber-800 bg-amber-50 border-amber-200';
                barColor = 'bg-amber-500';
                StatusIcon = AlertTriangle;
                statusText = 'Precaución (80% - 100%)';
              }

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: cat?.color || '#10b981' }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{cat?.name || 'Categoría'}</h4>
                        <div
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${statusColor}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusText}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>
                      Gastado: <strong>{formatCurrency(spent, currency)}</strong> de{' '}
                      {formatCurrency(b.amount, currency)}
                    </span>
                    <span className={remaining < 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                      {remaining < 0
                        ? `Sobrepasado en ${formatCurrency(Math.abs(remaining), currency)}`
                        : `Disponible: ${formatCurrency(remaining, currency)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingBudget ? 'Editar Presupuesto' : 'Fijar Presupuesto'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Mes
                </label>
                <input
                  type="month"
                  required
                  value={budgetMonth}
                  onChange={(e) => setBudgetMonth(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                />
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

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Límite Máximo Mensual (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="300.00"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
