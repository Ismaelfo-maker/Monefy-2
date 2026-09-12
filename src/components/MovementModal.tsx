import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Trash2, ArrowRightLeft, Plus, Minus, Image as ImageIcon } from 'lucide-react';
import {
  Movement,
  Transfer,
  Account,
  Card,
  Category,
  MovementType,
  Ticket,
} from '../types';
import { generateUUID } from '../utils/uuid';
import { getOrCreateDeviceId } from '../utils/device';
import { getTodayDateString } from '../utils/formatters';
import { dbService } from '../services/database/indexedDB';
import { getCategoryIcon } from '../utils/categoryIcons';

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialType?: MovementType | 'transfer';
  initialCategory?: Category | null;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  editingMovement?: Movement | null;
  editingTransfer?: Transfer | null;
}

export const MovementModal: React.FC<MovementModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialType = 'expense',
  initialCategory = null,
  accounts,
  cards,
  categories,
  editingMovement = null,
  editingTransfer = null,
}) => {
  const [modalMode, setModalMode] = useState<MovementType | 'transfer'>(
    editingTransfer ? 'transfer' : editingMovement ? editingMovement.type : initialType
  );

  // Form State
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [ticketImageBase64, setTicketImageBase64] = useState<string | null>(null);
  const [ticketFileName, setTicketFileName] = useState<string>('');
  const [ticketId, setTicketId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset state on open/edit change
  useEffect(() => {
    if (editingTransfer) {
      setModalMode('transfer');
      setAmount(String(editingTransfer.amount));
      setDate(editingTransfer.date);
      setDescription(editingTransfer.description || '');
      setAccountId(editingTransfer.fromAccountId);
      setToAccountId(editingTransfer.toAccountId);
      setTicketImageBase64(null);
    } else if (editingMovement) {
      setModalMode(editingMovement.type);
      setAmount(String(editingMovement.amount));
      setDate(editingMovement.date);
      setDescription(editingMovement.description || '');
      setNotes(editingMovement.notes || '');
      setAccountId(editingMovement.accountId);
      setCardId(editingMovement.cardId || '');
      setCategoryId(editingMovement.categoryId);
      setTicketId(editingMovement.ticketId);

      // Fetch ticket if attached
      if (editingMovement.ticketId) {
        dbService.getById<Ticket>('tickets', editingMovement.ticketId).then((t) => {
          if (t && t.dataBase64) {
            setTicketImageBase64(t.dataBase64);
            setTicketFileName(t.fileName);
          }
        });
      } else {
        setTicketImageBase64(null);
      }
    } else {
      setModalMode(initialType);
      setAmount('');
      setDate(getTodayDateString());
      setDescription('');
      setNotes('');
      setAccountId(accounts[0]?.id || '');
      setToAccountId(accounts[1]?.id || '');
      setCardId('');
      setCategoryId(initialCategory?.id || categories[0]?.id || '');
      setTicketImageBase64(null);
      setTicketId(undefined);
    }
    setError(null);
  }, [isOpen, editingMovement, editingTransfer, initialType, initialCategory, accounts, categories]);

  if (!isOpen) return null;

  // Filter cards for selected account
  const availableCards = cards.filter((c) => c.accountId === accountId);
  const activeCategories = categories.filter(
    (c) => !c.isDeleted && (modalMode === 'transfer' ? true : c.type === modalMode)
  );

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to reasonable size (e.g. 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen es demasiado grande. Elige una de menos de 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setTicketImageBase64(base64);
      setTicketFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Introduce un importe válido mayor que 0');
      return;
    }

    if (!accountId) {
      setError('Selecciona una cuenta');
      return;
    }

    const deviceId = getOrCreateDeviceId();
    const config = await dbService.getConfig();
    const now = new Date().toISOString();

    try {
      if (modalMode === 'transfer') {
        if (!toAccountId) {
          setError('Selecciona la cuenta de destino');
          return;
        }
        if (accountId === toAccountId) {
          setError('La cuenta de origen y destino no pueden ser la misma');
          return;
        }

        const transfer: Transfer = {
          id: editingTransfer?.id || generateUUID(),
          fromAccountId: accountId,
          toAccountId: toAccountId,
          amount: parsedAmount,
          date,
          description: description.trim() || 'Transferencia entre cuentas',
          createdAt: editingTransfer?.createdAt || now,
          updatedAt: now,
          isDeleted: false,
          createdByDeviceId: editingTransfer?.createdByDeviceId || deviceId,
          updatedByDeviceId: deviceId,
          createdByUserId: editingTransfer?.createdByUserId || config.userId,
          updatedByUserId: config.userId,
        };

        await dbService.putItem(
          'transfers',
          transfer,
          true,
          editingTransfer ? 'UPDATE' : 'CREATE'
        );
      } else {
        // Expense or Income
        if (!categoryId) {
          setError('Selecciona una categoría');
          return;
        }

        let assignedTicketId = ticketId;

        // Process ticket if photo uploaded
        if (ticketImageBase64 && !ticketId) {
          assignedTicketId = generateUUID();
          const ticket: Ticket = {
            id: assignedTicketId,
            fileName: ticketFileName || `ticket_${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
            dataBase64: ticketImageBase64,
            fileSize: ticketImageBase64.length,
            status: 'pending_upload',
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            createdByDeviceId: deviceId,
            createdByUserId: config.userId,
          };
          await dbService.putItem('tickets', ticket, true, 'CREATE');
        }

        const movement: Movement = {
          id: editingMovement?.id || generateUUID(),
          date,
          amount: parsedAmount,
          type: modalMode,
          description: description.trim() || (modalMode === 'expense' ? 'Gasto' : 'Ingreso'),
          categoryId,
          accountId,
          cardId: cardId || undefined,
          notes: notes.trim() || undefined,
          ticketId: assignedTicketId,
          createdAt: editingMovement?.createdAt || now,
          updatedAt: now,
          isDeleted: false,
          createdByDeviceId: editingMovement?.createdByDeviceId || deviceId,
          updatedByDeviceId: deviceId,
          createdByUserId: editingMovement?.createdByUserId || config.userId,
          updatedByUserId: config.userId,
        };

        await dbService.putItem(
          'movements',
          movement,
          true,
          editingMovement ? 'UPDATE' : 'CREATE'
        );
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(`Error al guardar: ${err.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              {editingTransfer
                ? 'Editar Transferencia'
                : editingMovement
                ? `Editar ${editingMovement.type === 'expense' ? 'Gasto' : 'Ingreso'}`
                : 'Nuevo Registro'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (only when not editing an existing record) */}
        {!editingMovement && !editingTransfer && (
          <div className="px-5 pt-3 pb-1">
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setModalMode('expense')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition ${
                  modalMode === 'expense'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Gasto</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMode('income')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition ${
                  modalMode === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ingreso</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMode('transfer')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition ${
                  modalMode === 'transfer'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transferencia</span>
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="px-5 py-3 space-y-3.5 overflow-y-auto flex-1">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Amount input prominent */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Importe (€)
            </label>
            <div className="relative">
              <input
                id="input-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full text-2xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>
          </div>

          {/* Date and Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Fecha
              </label>
              <input
                id="input-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Descripción / Concepto
              </label>
              <input
                id="input-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={modalMode === 'transfer' ? 'p. ej. Traspaso a ahorros' : 'p. ej. Compra supermercado'}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Accounts & Cards section */}
          {modalMode === 'transfer' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Desde Cuenta (Origen)
                </label>
                <select
                  id="select-from-account"
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona cuenta</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Hacia Cuenta (Destino)
                </label>
                <select
                  id="select-to-account"
                  required
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona cuenta</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Cuenta
                </label>
                <select
                  id="select-account"
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Tarjeta (Opcional)
                </label>
                <select
                  id="select-card"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Sin tarjeta (Efectivo / Cuenta)</option>
                  {availableCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} (•••• {card.last4})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Categories Grid (for Movements) */}
          {modalMode !== 'transfer' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Categoría
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-50/50 rounded-2xl border border-slate-100">
                {activeCategories.map((cat) => {
                  const Icon = getCategoryIcon(cat.icon);
                  const isSelected = categoryId === cat.id;

                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setCategoryId(cat.id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-bold shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: cat.color || '#10b981' }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] truncate">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ticket Receipt Photo Upload (Offline ready) */}
          {modalMode !== 'transfer' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Foto de Ticket / Recibo (Offline)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              {ticketImageBase64 ? (
                <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0">
                    <img
                      src={ticketImageBase64}
                      alt="Ticket"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {ticketFileName || 'Ticket adjunto'}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-medium">
                      Guardado localmente. Se subirá a Drive al sincronizar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketImageBase64(null);
                      setTicketFileName('');
                      setTicketId(undefined);
                    }}
                    className="text-rose-500 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 transition"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl border border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30 text-slate-600 hover:text-emerald-700 text-xs font-semibold transition"
                >
                  <Camera className="w-4 h-4" />
                  <span>Hacer foto con la cámara o seleccionar recibo</span>
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          {modalMode !== 'transfer' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Notas adicionales
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles opcionales..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition active:scale-95 ${
                modalMode === 'expense'
                  ? 'bg-rose-500 hover:bg-rose-600'
                  : modalMode === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Guardar {modalMode === 'transfer' ? 'Transferencia' : modalMode === 'expense' ? 'Gasto' : 'Ingreso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
