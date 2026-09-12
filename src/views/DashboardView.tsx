import React from 'react';
import { Plus, Minus, ArrowRightLeft, Camera, Layers, Calendar, ChevronRight } from 'lucide-react';
import {
  Account,
  Card,
  Category,
  Movement,
  Transfer,
  MovementType,
} from '../types';
import { DonutChart, CategoryExpense } from '../components/DonutChart';
import { CategoryRing } from '../components/CategoryRing';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getCategoryIcon } from '../utils/categoryIcons';

interface DashboardViewProps {
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  movements: Movement[];
  transfers: Transfer[];
  selectedAccountId: string;
  selectedCategoryId: string | null;
  onSelectCategory: (catId: string | null) => void;
  onOpenMovementModal: (type: MovementType | 'transfer', category?: Category | null) => void;
  onEditMovement: (m: Movement) => void;
  onNavigateToTab: (tab: any) => void;
  onInitializeDefaults: () => void;
  currency: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  accounts,
  cards,
  categories,
  movements,
  transfers,
  selectedAccountId,
  selectedCategoryId,
  onSelectCategory,
  onOpenMovementModal,
  onEditMovement,
  onNavigateToTab,
  onInitializeDefaults,
  currency,
}) => {
  // Filter by selected account if not ALL
  const filteredMovements = movements.filter((m) => {
    if (m.isDeleted) return false;
    if (selectedAccountId !== 'ALL' && m.accountId !== selectedAccountId) return false;
    return true;
  });

  const filteredTransfers = transfers.filter((t) => {
    if (t.isDeleted) return false;
    if (
      selectedAccountId !== 'ALL' &&
      t.fromAccountId !== selectedAccountId &&
      t.toAccountId !== selectedAccountId
    )
      return false;
    return true;
  });

  // Calculate totals
  const totalIncome = filteredMovements
    .filter((m) => m.type === 'income')
    .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);

  const totalExpense = filteredMovements
    .filter((m) => m.type === 'expense')
    .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);

  // Initial balance of filtered accounts
  const initialBalanceSum = accounts
    .filter((a) => selectedAccountId === 'ALL' || a.id === selectedAccountId)
    .reduce((acc, a) => acc + (Number(a.initialBalance) || 0), 0);

  // Note: Transfers affect account balances, but when ALL accounts are selected, internal transfers cancel out
  let transferDelta = 0;
  if (selectedAccountId !== 'ALL') {
    filteredTransfers.forEach((t) => {
      if (t.toAccountId === selectedAccountId) transferDelta += Number(t.amount) || 0;
      if (t.fromAccountId === selectedAccountId) transferDelta -= Number(t.amount) || 0;
    });
  }

  const netBalance = initialBalanceSum + totalIncome - totalExpense + transferDelta;

  // Compute expenses by category
  const categoryTotals: Record<string, number> = {};
  filteredMovements.forEach((m) => {
    if (m.type === 'expense') {
      categoryTotals[m.categoryId] = (categoryTotals[m.categoryId] || 0) + (Number(m.amount) || 0);
    }
  });

  const expensesByCategory: CategoryExpense[] = categories
    .filter((c) => c.type === 'expense' && (categoryTotals[c.id] || 0) > 0)
    .map((c) => {
      const total = categoryTotals[c.id] || 0;
      const percentage = totalExpense > 0 ? (total / totalExpense) * 100 : 0;
      return {
        categoryId: c.id,
        categoryName: c.name,
        color: c.color || '#10b981',
        icon: c.icon,
        total,
        percentage,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Movements filtered by category if selected, or top 5 recent
  const displayedMovements = selectedCategoryId
    ? filteredMovements.filter((m) => m.categoryId === selectedCategoryId)
    : filteredMovements.slice(0, 6);

  const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const accMap = new Map<string, Account>(accounts.map((a) => [a.id, a]));

  const activeCategoryObj = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="space-y-4 pb-24">
      {/* If brand new and completely empty, offer friendly initialization */}
      {accounts.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">¡Bienvenido a Monefy PWA!</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
              Tu aplicación funciona 100% offline. Para comenzar, puedes inicializar una cuenta y categorías recomendadas o crearlas manualmente.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={onInitializeDefaults}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              Inicializar cuenta y categorías
            </button>
            <button
              onClick={() => onNavigateToTab('accounts')}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
            >
              Crear cuenta manual
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Row: INGRESOS | GASTOS | DISPONIBLE */}
      <div className="grid grid-cols-3 gap-2 px-1">
        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center text-center">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            Ingresos
          </span>
          <span className="text-sm sm:text-base font-extrabold text-emerald-800 mt-0.5">
            +{formatCurrency(totalIncome, currency)}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center text-center">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            Gastos
          </span>
          <span className="text-sm sm:text-base font-extrabold text-rose-800 mt-0.5">
            -{formatCurrency(totalExpense, currency)}
          </span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center text-center">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            Disponible
          </span>
          <span
            className={`text-sm sm:text-base font-extrabold mt-0.5 ${
              netBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {formatCurrency(netBalance, currency)}
          </span>
        </div>
      </div>

      {/* Donut Chart with Centered Metric */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-3">
        <DonutChart
          expensesByCategory={expensesByCategory}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          netBalance={netBalance}
          currency={currency}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
        />
      </div>

      {/* Interactive Category Icons (Monefy Ring) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-3">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-bold text-slate-800">Categorías de Gastos</span>
          {selectedCategoryId && (
            <button
              onClick={() => onSelectCategory(null)}
              className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Ver todas
            </button>
          )}
        </div>
        <CategoryRing
          categories={categories.filter((c) => c.type === 'expense' && !c.isDeleted)}
          categoryTotals={categoryTotals}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onQuickAdd={(cat) => onOpenMovementModal('expense', cat)}
          currency={currency}
        />
      </div>

      {/* Quick Action Floating Bar */}
      <div className="grid grid-cols-3 gap-2 px-1">
        <button
          id="btn-quick-expense"
          onClick={() => onOpenMovementModal('expense')}
          className="flex items-center justify-center gap-1.5 py-3 px-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold text-xs shadow-sm transition active:scale-95"
        >
          <Minus className="w-4 h-4" />
          <span>Gasto</span>
        </button>

        <button
          id="btn-quick-income"
          onClick={() => onOpenMovementModal('income')}
          className="flex items-center justify-center gap-1.5 py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Ingreso</span>
        </button>

        <button
          id="btn-quick-transfer"
          onClick={() => onOpenMovementModal('transfer')}
          className="flex items-center justify-center gap-1.5 py-3 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-sm transition active:scale-95"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Transferencia</span>
        </button>
      </div>

      {/* Filtered / Recent Movements list */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {activeCategoryObj ? `Movimientos en ${activeCategoryObj.name}` : 'Movimientos Recientes'}
            </h3>
            {selectedCategoryId && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                {displayedMovements.length}
              </span>
            )}
          </div>
          <button
            onClick={() => onNavigateToTab('history')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
          >
            <span>Ver historial</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {displayedMovements.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No hay movimientos registrados en este período.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedMovements.map((mov) => {
              const cat = catMap.get(mov.categoryId);
              const acc = accMap.get(mov.accountId);
              const Icon = cat ? getCategoryIcon(cat.icon) : Layers;

              return (
                <div
                  key={mov.id}
                  onClick={() => onEditMovement(mov)}
                  className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 px-1 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: cat?.color || '#10b981' }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {mov.description || (mov.type === 'expense' ? 'Gasto' : 'Ingreso')}
                      </p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>{formatDate(mov.date)}</span>
                        <span>•</span>
                        <span>{acc?.name || 'Cuenta'}</span>
                        {mov.ticketId && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600 flex items-center gap-0.5">
                              <Camera className="w-2.5 h-2.5" /> Ticket
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-black ${
                        mov.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {mov.type === 'expense' ? '-' : '+'}
                      {formatCurrency(mov.amount, currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
