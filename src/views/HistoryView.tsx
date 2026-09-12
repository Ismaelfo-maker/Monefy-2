import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  Camera,
  Calendar,
  Layers,
  ArrowRightLeft,
  Download,
  X,
} from 'lucide-react';
import {
  Movement,
  Transfer,
  Account,
  Card,
  Category,
  MovementType,
} from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getCategoryIcon } from '../utils/categoryIcons';
import { dbService } from '../services/database/indexedDB';
import { backupService } from '../services/export/backupService';

interface HistoryViewProps {
  movements: Movement[];
  transfers: Transfer[];
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  currency: string;
  onEditMovement: (m: Movement) => void;
  onEditTransfer: (t: Transfer) => void;
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  movements,
  transfers,
  accounts,
  cards,
  categories,
  currency,
  onEditMovement,
  onEditTransfer,
  onRefresh,
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Maps
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  // Date range calculation
  const today = new Date();
  const dateThresholds = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setMonth(now.getMonth() - 1);

    const yearAgo = new Date();
    yearAgo.setFullYear(now.getFullYear() - 1);

    return {
      week: weekAgo.toISOString().substring(0, 10),
      month: monthAgo.toISOString().substring(0, 10),
      year: yearAgo.toISOString().substring(0, 10),
    };
  }, []);

  // Filtered List
  const filteredItems = useMemo(() => {
    // Combine movements and transfers with tags
    const movItems = movements
      .filter((m) => !m.isDeleted)
      .map((m) => ({ ...m, itemKind: 'movement' as const }));

    const transferItems = transfers
      .filter((t) => !t.isDeleted)
      .map((t) => ({ ...t, itemKind: 'transfer' as const }));

    let combined: Array<any> = [];

    if (typeFilter === 'all') {
      combined = [...movItems, ...transferItems];
    } else if (typeFilter === 'transfer') {
      combined = transferItems;
    } else {
      combined = movItems.filter((m) => m.type === typeFilter);
    }

    return combined
      .filter((item) => {
        // Date Period
        if (periodFilter === 'week' && item.date < dateThresholds.week) return false;
        if (periodFilter === 'month' && item.date < dateThresholds.month) return false;
        if (periodFilter === 'year' && item.date < dateThresholds.year) return false;
        if (periodFilter === 'custom') {
          if (startDate && item.date < startDate) return false;
          if (endDate && item.date > endDate) return false;
        }

        // Account
        if (accountFilter !== 'all') {
          if (item.itemKind === 'movement' && item.accountId !== accountFilter) return false;
          if (
            item.itemKind === 'transfer' &&
            item.fromAccountId !== accountFilter &&
            item.toAccountId !== accountFilter
          )
            return false;
        }

        // Category
        if (categoryFilter !== 'all') {
          if (item.itemKind !== 'movement' || item.categoryId !== categoryFilter) return false;
        }

        // Card
        if (cardFilter !== 'all') {
          if (item.itemKind !== 'movement' || item.cardId !== cardFilter) return false;
        }

        // Amount range
        if (minAmount && item.amount < parseFloat(minAmount)) return false;
        if (maxAmount && item.amount > parseFloat(maxAmount)) return false;

        // Search text
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const notes = (item.notes || '').toLowerCase();
          const catName = (catMap.get(item.categoryId)?.name || '').toLowerCase();
          if (!desc.includes(q) && !notes.includes(q) && !catName.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    movements,
    transfers,
    periodFilter,
    typeFilter,
    categoryFilter,
    accountFilter,
    cardFilter,
    minAmount,
    maxAmount,
    searchTerm,
    startDate,
    endDate,
    dateThresholds,
    catMap,
  ]);

  const handleDelete = async (item: any) => {
    if (!confirm('¿Seguro que deseas eliminar este movimiento?')) return;

    if (item.itemKind === 'transfer') {
      await dbService.softDeleteItem('transfers', item.id, true);
    } else {
      await dbService.softDeleteItem('movements', item.id, true);
    }
    onRefresh();
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Search and Period Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-history-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por concepto, notas..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              showAdvancedFilters
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="Filtros avanzados"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
          </button>

          <button
            onClick={() => backupService.downloadMovementsCsv()}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs font-semibold flex items-center gap-1 transition"
            title="Exportar a CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        {/* Period Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'month', label: 'Este Mes' },
            { id: 'week', label: 'Última Semana' },
            { id: 'year', label: 'Este Año' },
            { id: 'all', label: 'Todo' },
            { id: 'custom', label: 'Personalizado' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodFilter(p.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                periodFilter === p.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range if active */}
        {periodFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                Desde
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                Hasta
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>
          </div>
        )}

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Tipo
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5"
              >
                <option value="all">Todos</option>
                <option value="expense">Solo Gastos</option>
                <option value="income">Solo Ingresos</option>
                <option value="transfer">Solo Transferencias</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Categoría
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Cuenta
              </label>
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5"
              >
                <option value="all">Todas las cuentas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Tarjeta
              </label>
              <select
                value={cardFilter}
                onChange={(e) => setCardFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5"
              >
                <option value="all">Cualquiera</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (•••• {c.last4})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Movement List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {filteredItems.length} Registros Encontrados
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No se encontraron movimientos con los filtros seleccionados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              if (item.itemKind === 'transfer') {
                const fromAcc = accMap.get(item.fromAccountId);
                const toAcc = accMap.get(item.toAccountId);

                return (
                  <div
                    key={item.id}
                    className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-2xl transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {item.description || 'Transferencia'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {formatDate(item.date)} • {fromAcc?.name || 'Origen'} → {toAcc?.name || 'Destino'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-black text-blue-600">
                        ⇄ {formatCurrency(item.amount, currency)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditTransfer(item)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Normal Movement
              const cat = catMap.get(item.categoryId);
              const acc = accMap.get(item.accountId);
              const card = cardMap.get(item.cardId);
              const Icon = cat ? getCategoryIcon(cat.icon) : Layers;

              return (
                <div
                  key={item.id}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-2xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: cat?.color || '#10b981' }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {item.description || (item.type === 'expense' ? 'Gasto' : 'Ingreso')}
                      </p>
                      <p className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span>{formatDate(item.date)}</span>
                        <span>•</span>
                        <span>{cat?.name || 'Categoría'}</span>
                        <span>•</span>
                        <span>{acc?.name || 'Cuenta'}</span>
                        {card && <span>({card.name})</span>}
                        {item.ticketId && (
                          <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                            <Camera className="w-2.5 h-2.5" /> Ticket
                          </span>
                        )}
                        {item.notes && <span className="italic">"{item.notes}"</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-black ${
                        item.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {item.type === 'expense' ? '-' : '+'}
                      {formatCurrency(item.amount, currency)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditMovement(item)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Eliminar"
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
    </div>
  );
};
