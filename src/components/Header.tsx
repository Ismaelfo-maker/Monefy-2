import React from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Wallet, User as UserIcon } from 'lucide-react';
import { AppConfig, Account, User } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  config: AppConfig;
  accounts: Account[];
  selectedAccountId: string;
  currentUser?: User | null;
  onSelectAccount: (accountId: string) => void;
  onSync: () => void;
  onOpenConflicts: () => void;
  pendingCount: number;
  conflictsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  accounts,
  selectedAccountId,
  currentUser,
  onSelectAccount,
  onSync,
  onOpenConflicts,
  pendingCount,
  conflictsCount,
}) => {
  const getSyncBadge = () => {
    if (conflictsCount > 0 || config.syncStatus === 'conflict') {
      return (
        <button
          id="btn-sync-conflict-badge"
          onClick={onOpenConflicts}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition"
          title="Ver y resolver conflictos de sincronización"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
          <span>⚠ {conflictsCount} Conflicto{conflictsCount > 1 ? 's' : ''}</span>
        </button>
      );
    }

    if (config.syncStatus === 'syncing') {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>⟳ Sincronizando</span>
        </div>
      );
    }

    if (config.syncStatus === 'error') {
      return (
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 cursor-help"
          title={config.lastSyncError || 'Error de sincronización'}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>✕ Error</span>
        </div>
      );
    }

    if (pendingCount > 0 || config.syncStatus === 'pending') {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>○ {pendingCount} Pendiente{pendingCount > 1 ? 's' : ''}</span>
        </div>
      );
    }

    if (config.syncStatus === 'synced') {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>✓ Sincronizado</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-slate-500 bg-slate-100">
        <span>○ Local</span>
      </div>
    );
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Logo & Account Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Monefy PWA</h1>
              <p className="text-[10px] text-slate-500">Offline & Sheets</p>
            </div>
          </div>

          {/* Account Filter Dropdown */}
          <div className="relative">
            <select
              id="select-active-account"
              value={selectedAccountId}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/80 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Todas las Cuentas</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sync Controls & Install */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div
              id="header-user-badge"
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
              title={`Conectado con Google: ${currentUser.name} (${currentUser.email})`}
            >
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-4 h-4 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline max-w-[80px] truncate">{currentUser.name}</span>
            </div>
          ) : null}

          {getSyncBadge()}

          <button
            id="btn-header-sync"
            onClick={onSync}
            disabled={config.syncStatus === 'syncing'}
            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-slate-100 disabled:opacity-50 transition"
            title="Sincronizar ahora con Google Sheets"
          >
            <RefreshCw
              className={`w-4 h-4 ${config.syncStatus === 'syncing' ? 'animate-spin text-emerald-600' : ''}`}
            />
          </button>

          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
};
