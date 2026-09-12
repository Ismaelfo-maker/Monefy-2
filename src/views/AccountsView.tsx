import React, { useState } from 'react';
import {
  Plus,
  CreditCard,
  Building2,
  Trash2,
  Edit2,
  Wallet,
  ArrowRightLeft,
  DollarSign,
} from 'lucide-react';
import { Account, Card, Movement, Transfer } from '../types';
import { formatCurrency } from '../utils/formatters';
import { generateUUID } from '../utils/uuid';
import { getOrCreateDeviceId } from '../utils/device';
import { dbService } from '../services/database/indexedDB';

interface AccountsViewProps {
  accounts: Account[];
  cards: Card[];
  movements: Movement[];
  transfers: Transfer[];
  currency: string;
  onRefresh: () => void;
  onOpenTransferModal: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  cards,
  movements,
  transfers,
  currency,
  onRefresh,
  onOpenTransferModal,
}) => {
  // Modal states
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  // Account Form fields
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<Account['type']>('bank');
  const [accInitial, setAccInitial] = useState('0');
  const [accColor, setAccColor] = useState('#10b981');

  // Card Form fields
  const [cardName, setCardName] = useState('');
  const [cardType, setCardType] = useState<Card['type']>('debit');
  const [cardAccountId, setCardAccountId] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [cardLimit, setCardLimit] = useState('');

  // Dynamically calculate balances strictly according to mandate:
  // Saldo inicial + Ingresos - Gastos + Transferencias entrantes - Transferencias salientes
  const getAccountCalculatedBalance = (accountId: string, initialBalance: number = 0) => {
    const accMovements = movements.filter((m) => !m.isDeleted && m.accountId === accountId);

    const incomes = accMovements
      .filter((m) => m.type === 'income')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const expenses = accMovements
      .filter((m) => m.type === 'expense')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const inTransfers = transfers
      .filter((t) => !t.isDeleted && t.toAccountId === accountId)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const outTransfers = transfers
      .filter((t) => !t.isDeleted && t.fromAccountId === accountId)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return Number(initialBalance || 0) + incomes - expenses + inTransfers - outTransfers;
  };

  const handleOpenNewAccount = () => {
    setEditingAccount(null);
    setAccName('');
    setAccType('bank');
    setAccInitial('0');
    setAccColor('#10b981');
    setShowAccountModal(true);
  };

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccInitial(String(acc.initialBalance || 0));
    setAccColor(acc.color || '#10b981');
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    const deviceId = getOrCreateDeviceId();
    const config = await dbService.getConfig();
    const now = new Date().toISOString();

    const account: Account = {
      id: editingAccount?.id || generateUUID(),
      name: accName.trim(),
      type: accType,
      initialBalance: parseFloat(accInitial) || 0,
      currency: currency || 'EUR',
      color: accColor,
      createdAt: editingAccount?.createdAt || now,
      updatedAt: now,
      isDeleted: false,
      createdByDeviceId: editingAccount?.createdByDeviceId || deviceId,
      updatedByDeviceId: deviceId,
      createdByUserId: editingAccount?.createdByUserId || config.userId,
      updatedByUserId: config.userId,
    };

    await dbService.putItem('accounts', account, true, editingAccount ? 'UPDATE' : 'CREATE');
    setShowAccountModal(false);
    onRefresh();
  };

  const handleDeleteAccount = async (account: Account) => {
    if (!confirm(`¿Eliminar la cuenta "${account.name}"? Los movimientos asociados permanecerán.`))
      return;
    await dbService.softDeleteItem('accounts', account.id, true);
    onRefresh();
  };

  const handleOpenNewCard = () => {
    setEditingCard(null);
    setCardName('');
    setCardType('debit');
    setCardAccountId(accounts[0]?.id || '');
    setCardLast4('');
    setCardLimit('');
    setShowCardModal(true);
  };

  const handleOpenEditCard = (card: Card) => {
    setEditingCard(card);
    setCardName(card.name);
    setCardType(card.type);
    setCardAccountId(card.accountId);
    setCardLast4(card.last4 || '');
    setCardLimit(card.creditLimit ? String(card.creditLimit) : '');
    setShowCardModal(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || !cardAccountId) return;

    const deviceId = getOrCreateDeviceId();
    const config = await dbService.getConfig();
    const now = new Date().toISOString();

    const card: Card = {
      id: editingCard?.id || generateUUID(),
      name: cardName.trim(),
      type: cardType,
      accountId: cardAccountId,
      last4: cardLast4.trim().slice(-4) || '0000',
      creditLimit: cardLimit ? parseFloat(cardLimit) : undefined,
      color: '#3b82f6',
      createdAt: editingCard?.createdAt || now,
      updatedAt: now,
      isDeleted: false,
      createdByDeviceId: editingCard?.createdByDeviceId || deviceId,
      updatedByDeviceId: deviceId,
      createdByUserId: editingCard?.createdByUserId || config.userId,
      updatedByUserId: config.userId,
    };

    await dbService.putItem('cards', card, true, editingCard ? 'UPDATE' : 'CREATE');
    setShowCardModal(false);
    onRefresh();
  };

  const handleDeleteCard = async (card: Card) => {
    if (!confirm(`¿Eliminar la tarjeta "${card.name}"?`)) return;
    await dbService.softDeleteItem('cards', card.id, true);
    onRefresh();
  };

  const activeAccounts = accounts.filter((a) => !a.isDeleted);
  const activeCards = cards.filter((c) => !c.isDeleted);

  const totalCalculatedNetWorth = activeAccounts.reduce(
    (sum, a) => sum + getAccountCalculatedBalance(a.id, a.initialBalance),
    0
  );

  return (
    <div className="space-y-4 pb-24">
      {/* Net Worth Summary Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Patrimonio Neto Total (Saldos Calculados)
            </span>
            <h2 className="text-2xl font-black mt-1">
              {formatCurrency(totalCalculatedNetWorth, currency)}
            </h2>
            <p className="text-[10px] text-slate-400 mt-1">
              Recalculado dinámicamente según saldo inicial + ingresos - gastos ± transferencias
            </p>
          </div>
          <button
            onClick={onOpenTransferModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xs font-bold transition shadow-xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transferir</span>
          </button>
        </div>
      </div>

      {/* Accounts Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Cuentas ({activeAccounts.length})
            </h3>
          </div>
          <button
            id="btn-add-account"
            onClick={handleOpenNewAccount}
            className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Cuenta</span>
          </button>
        </div>

        {activeAccounts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No tienes ninguna cuenta creada. Pulsa "Nueva Cuenta" para comenzar.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeAccounts.map((acc) => {
              const currentBalance = getAccountCalculatedBalance(acc.id, acc.initialBalance);

              return (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: acc.color || '#10b981' }}
                      >
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{acc.name}</h4>
                        <span className="text-[10px] text-slate-500 capitalize">
                          {acc.type === 'bank'
                            ? 'Banco'
                            : acc.type === 'cash'
                            ? 'Efectivo'
                            : acc.type === 'savings'
                            ? 'Ahorro'
                            : 'Otro'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditAccount(acc)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                        title="Editar cuenta"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                        title="Eliminar cuenta"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Inicial: {formatCurrency(acc.initialBalance || 0, currency)}
                    </span>
                    <span
                      className={`text-sm font-black ${
                        currentBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(currentBalance, currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cards Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Tarjetas Vinculadas ({activeCards.length})
            </h3>
          </div>
          <button
            id="btn-add-card"
            onClick={handleOpenNewCard}
            disabled={activeAccounts.length === 0}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl transition disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Tarjeta</span>
          </button>
        </div>

        {activeCards.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No hay tarjetas registradas. Puedes añadir tarjetas de débito o crédito vinculadas a tus cuentas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeCards.map((card) => {
              const linkedAcc = accounts.find((a) => a.id === card.accountId);

              return (
                <div
                  key={card.id}
                  className="p-3.5 rounded-2xl border border-slate-200/80 bg-linear-to-r from-slate-900 to-slate-800 text-white flex flex-col justify-between shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-400" />
                        <h4 className="text-xs font-bold tracking-wide">{card.name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {card.type === 'credit' ? 'Tarjeta de Crédito' : 'Tarjeta de Débito'}
                        {card.creditLimit ? ` • Límite: ${formatCurrency(card.creditLimit, currency)}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditCard(card)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card)}
                        className="p-1 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-700 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-300">•••• {card.last4}</span>
                    <span className="text-[10px] text-slate-400">
                      Cuenta: <strong className="text-white">{linkedAcc?.name || 'N/A'}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
            </h3>
            <form onSubmit={handleSaveAccount} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Nombre de la Cuenta
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="p. ej. Cuenta Nómina ING"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Tipo
                  </label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
                  >
                    <option value="bank">Banco</option>
                    <option value="cash">Efectivo</option>
                    <option value="savings">Ahorro</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Saldo Inicial
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={accInitial}
                    onChange={(e) => setAccInitial(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Color Identificador
                </label>
                <div className="flex gap-2">
                  {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'].map(
                    (color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setAccColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition ${
                          accColor === color ? 'border-slate-900 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
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

      {/* Card Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {editingCard ? 'Editar Tarjeta' : 'Nueva Tarjeta'}
            </h3>
            <form onSubmit={handleSaveCard} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Nombre de la Tarjeta
                </label>
                <input
                  type="text"
                  required
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="p. ej. Débito Principal"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Cuenta Vinculada
                </label>
                <select
                  required
                  value={cardAccountId}
                  onChange={(e) => setCardAccountId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Tipo
                  </label>
                  <select
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
                  >
                    <option value="debit">Débito</option>
                    <option value="credit">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Últimos 4 dígitos
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={cardLast4}
                    onChange={(e) => setCardLast4(e.target.value)}
                    placeholder="1234"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              {cardType === 'credit' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Límite de Crédito (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cardLimit}
                    onChange={(e) => setCardLimit(e.target.value)}
                    placeholder="1500.00"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
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
