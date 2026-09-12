import React from 'react';
import {
  PieChart,
  Receipt,
  WalletCards,
  Target,
  Repeat,
  Settings,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'history' | 'accounts' | 'budgets' | 'recurring' | 'settings';

interface NavigationProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'dashboard' as NavTab, label: 'Principal', icon: PieChart },
    { id: 'history' as NavTab, label: 'Movimientos', icon: Receipt },
    { id: 'accounts' as NavTab, label: 'Cuentas', icon: WalletCards },
    { id: 'budgets' as NavTab, label: 'Presupuestos', icon: Target },
    { id: 'recurring' as NavTab, label: 'Recurrentes', icon: Repeat },
    { id: 'settings' as NavTab, label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg">
      <div className="max-w-xl mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              id={`nav-tab-${tab.id}`}
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all select-none ${
                isActive
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform ${
                  isActive ? 'bg-emerald-100/70 scale-105' : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[64px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
