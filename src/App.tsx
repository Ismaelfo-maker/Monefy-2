/**
 * Monefy PWA - Main Application Component
 * Offline-first Personal Finance with Google Sheets & Drive synchronization
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Account,
  Card,
  Category,
  Movement,
  Transfer,
  Recurring,
  Budget,
  AppConfig,
  MovementType,
  SyncConflict,
  User,
} from './types';
import { dbService } from './services/database/indexedDB';
import { syncEngine } from './services/sync/syncEngine';
import { googleAuthService } from './services/google/googleAuthService';
import { recurringService } from './services/recurring/recurringService';
import { DEFAULT_CATEGORIES } from './utils/categoryIcons';
import { generateUUID } from './utils/uuid';
import { getOrCreateDeviceId } from './utils/device';

import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { Navigation, NavTab } from './components/Navigation';
import { MovementModal } from './components/MovementModal';
import { ConflictResolverModal } from './components/ConflictResolverModal';

import { DashboardView } from './views/DashboardView';
import { HistoryView } from './views/HistoryView';
import { AccountsView } from './views/AccountsView';
import { BudgetsView } from './views/BudgetsView';
import { RecurringView } from './views/RecurringView';
import { SettingsView } from './views/SettingsView';
import { BankImportView } from './views/BankImportView';
import { SystemTestsView } from './views/SystemTestsView';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [subView, setSubView] = useState<'none' | 'tests' | 'bank-import'>('none');

  // Core Data
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [recurringRules, setRecurringRules] = useState<Recurring[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [conflictsCount, setConflictsCount] = useState(0);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  // Filters & Selection
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Modals
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [modalType, setModalType] = useState<MovementType | 'transfer'>('expense');
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Load all data from IndexedDB
  const refreshData = useCallback(async () => {
    try {
      const [cfg, activeUser] = await Promise.all([
        dbService.getConfig(),
        dbService.getActiveUser(),
      ]);
      setConfig(cfg);
      setCurrentUser(activeUser);

      const [accs, crds, cats, movs, trfs, recs, bdgs, pendingQueue, conflicts] =
        await Promise.all([
          dbService.getAll<Account>('accounts'),
          dbService.getAll<Card>('cards'),
          dbService.getAll<Category>('categories'),
          dbService.getAll<Movement>('movements'),
          dbService.getAll<Transfer>('transfers'),
          dbService.getAll<Recurring>('recurring'),
          dbService.getAll<Budget>('budgets'),
          dbService.getPendingQueueItems(),
          dbService.getConflicts(),
        ]);

      setAccounts(accs);
      setCards(crds);
      setCategories(cats);
      setMovements(movs);
      setTransfers(trfs);
      setRecurringRules(recs);
      setBudgets(bdgs);
      setPendingQueueCount(pendingQueue.length);
      setConflictsCount(conflicts.length);
    } catch (err) {
      console.error('Error loading data from IndexedDB:', err);
    }
  }, []);

  // Initial Boot
  useEffect(() => {
    refreshData().then(async () => {
      // Process recurring movements on startup
      await recurringService.processRecurringMovements();
      await refreshData();

      // Trigger auto-sync if online and configured
      if (navigator.onLine) {
        syncEngine.sync().then(() => refreshData());
      }
    });

    // Subscribe to Sync status updates
    const unsubscribeSync = syncEngine.subscribe(() => {
      refreshData();
    });

    // Subscribe to Google Auth changes
    const unsubscribeAuth = googleAuthService.subscribe((state) => {
      setCurrentUser(state.user);
      refreshData();
    });

    // Listen to network online event for automatic sync
    const handleOnline = () => {
      syncEngine.sync().then(() => refreshData());
    };
    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribeSync();
      unsubscribeAuth();
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshData]);

  // Handle Default Setup for first turn
  const handleInitializeDefaults = async () => {
    const deviceId = getOrCreateDeviceId();
    const now = new Date().toISOString();

    // 1. Create Default Accounts
    const defaultAcc1: Account = {
      id: generateUUID(),
      name: 'Efectivo',
      type: 'cash',
      initialBalance: 150,
      currency: 'EUR',
      color: '#10b981',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      createdByDeviceId: deviceId,
    };

    const defaultAcc2: Account = {
      id: generateUUID(),
      name: 'Banco Principal',
      type: 'bank',
      initialBalance: 1200,
      currency: 'EUR',
      color: '#3b82f6',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      createdByDeviceId: deviceId,
    };

    await dbService.putItem('accounts', defaultAcc1, true, 'CREATE');
    await dbService.putItem('accounts', defaultAcc2, true, 'CREATE');

    // 2. Create Default Categories
    for (const cat of DEFAULT_CATEGORIES) {
      const newCat: Category = {
        id: generateUUID(),
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        type: cat.type,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        createdByDeviceId: deviceId,
      };
      await dbService.putItem('categories', newCat, true, 'CREATE');
    }

    await refreshData();
  };

  // Optional Sample Data (Requirement 38)
  const handleLoadSampleData = async () => {
    if (!confirm('¿Cargar datos de ejemplo para demostración?')) return;
    await handleInitializeDefaults();
    const loadedAccounts = await dbService.getAll<Account>('accounts');
    const loadedCategories = await dbService.getAll<Category>('categories');

    const foodCat = loadedCategories.find((c) => c.name === 'Alimentación');
    const salaryCat = loadedCategories.find((c) => c.name === 'Nómina / Salario');
    const transCat = loadedCategories.find((c) => c.name === 'Transporte');
    const acc = loadedAccounts[0] || loadedAccounts[1];

    if (acc) {
      const now = new Date().toISOString();
      const today = now.substring(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

      // Income
      if (salaryCat) {
        await dbService.putItem(
          'movements',
          {
            id: generateUUID(),
            date: today,
            amount: 2150,
            type: 'income',
            description: 'Nómina mensual',
            categoryId: salaryCat.id,
            accountId: acc.id,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
          },
          true,
          'CREATE'
        );
      }

      // Expenses
      if (foodCat) {
        await dbService.putItem(
          'movements',
          {
            id: generateUUID(),
            date: today,
            amount: 54.3,
            type: 'expense',
            description: 'Supermercado semanal',
            categoryId: foodCat.id,
            accountId: acc.id,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
          },
          true,
          'CREATE'
        );
      }

      if (transCat) {
        await dbService.putItem(
          'movements',
          {
            id: generateUUID(),
            date: yesterday,
            amount: 32.0,
            type: 'expense',
            description: 'Abono transporte',
            categoryId: transCat.id,
            accountId: acc.id,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
          },
          true,
          'CREATE'
        );
      }
    }

    await refreshData();
    alert('Datos de ejemplo cargados con éxito');
  };

  const handleOpenMovementModal = (type: MovementType | 'transfer', category?: Category | null) => {
    setModalType(type);
    setModalCategory(category || null);
    setEditingMovement(null);
    setEditingTransfer(null);
    setIsMovementModalOpen(true);
  };

  const handleEditMovement = (mov: Movement) => {
    setEditingMovement(mov);
    setEditingTransfer(null);
    setModalType(mov.type);
    setIsMovementModalOpen(true);
  };

  const handleEditTransfer = (t: Transfer) => {
    setEditingTransfer(t);
    setEditingMovement(null);
    setModalType('transfer');
    setIsMovementModalOpen(true);
  };

  const handleManualSync = async () => {
    const res = await syncEngine.sync();
    await refreshData();
    if (!res.success) {
      alert(res.message);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <div className="w-4 h-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          <span>Iniciando base de datos IndexedDB...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col antialiased selection:bg-emerald-100">
      <OfflineBanner />

      <Header
        config={config}
        currentUser={currentUser}
        accounts={accounts.filter((a) => !a.isDeleted)}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        onSync={handleManualSync}
        onOpenConflicts={() => setIsConflictModalOpen(true)}
        pendingCount={pendingQueueCount}
        conflictsCount={conflictsCount}
      />

      <main className="flex-1 max-w-2xl w-full mx-auto p-3 sm:p-4">
        {subView === 'tests' ? (
          <SystemTestsView onBack={() => setSubView('none')} />
        ) : subView === 'bank-import' ? (
          <BankImportView
            accounts={accounts.filter((a) => !a.isDeleted)}
            categories={categories.filter((c) => !c.isDeleted)}
            currency={config.currency}
            onImportComplete={refreshData}
            onBack={() => setSubView('none')}
          />
        ) : activeTab === 'dashboard' ? (
          <DashboardView
            accounts={accounts}
            cards={cards}
            categories={categories}
            movements={movements}
            transfers={transfers}
            selectedAccountId={selectedAccountId}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            onOpenMovementModal={handleOpenMovementModal}
            onEditMovement={handleEditMovement}
            onNavigateToTab={setActiveTab}
            onInitializeDefaults={handleInitializeDefaults}
            currency={config.currency}
          />
        ) : activeTab === 'history' ? (
          <HistoryView
            movements={movements}
            transfers={transfers}
            accounts={accounts}
            cards={cards}
            categories={categories}
            currency={config.currency}
            onEditMovement={handleEditMovement}
            onEditTransfer={handleEditTransfer}
            onRefresh={refreshData}
          />
        ) : activeTab === 'accounts' ? (
          <AccountsView
            accounts={accounts}
            cards={cards}
            movements={movements}
            transfers={transfers}
            currency={config.currency}
            onRefresh={refreshData}
            onOpenTransferModal={() => handleOpenMovementModal('transfer')}
          />
        ) : activeTab === 'budgets' ? (
          <BudgetsView
            budgets={budgets}
            categories={categories}
            movements={movements}
            currency={config.currency}
            onRefresh={refreshData}
          />
        ) : activeTab === 'recurring' ? (
          <RecurringView
            recurringRules={recurringRules}
            accounts={accounts.filter((a) => !a.isDeleted)}
            categories={categories.filter((c) => !c.isDeleted)}
            currency={config.currency}
            onRefresh={refreshData}
          />
        ) : (
          <SettingsView
            config={config}
            currentUser={currentUser}
            onUpdateConfig={setConfig}
            onNavigateToTests={() => setSubView('tests')}
            onNavigateToBankImport={() => setSubView('bank-import')}
            onLoadSampleData={handleLoadSampleData}
            onRefresh={refreshData}
          />
        )}
      </main>

      <Navigation
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setSubView('none');
          setActiveTab(tab);
        }}
      />

      {/* Movement & Transfer Modal */}
      <MovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSaved={refreshData}
        initialType={modalType}
        initialCategory={modalCategory}
        accounts={accounts.filter((a) => !a.isDeleted)}
        cards={cards.filter((c) => !c.isDeleted)}
        categories={categories.filter((c) => !c.isDeleted)}
        editingMovement={editingMovement}
        editingTransfer={editingTransfer}
      />

      {/* Conflict Resolver Modal */}
      <ConflictResolverModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onResolved={refreshData}
      />
    </div>
  );
}
