import React from 'react';
import { Category } from '../types';
import { getCategoryIcon } from '../utils/categoryIcons';
import { formatCurrency } from '../utils/formatters';

interface CategoryRingProps {
  categories: Category[];
  categoryTotals: Record<string, number>;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onQuickAdd: (category: Category) => void;
  currency: string;
}

export const CategoryRing: React.FC<CategoryRingProps> = ({
  categories,
  categoryTotals,
  selectedCategoryId,
  onSelectCategory,
  onQuickAdd,
  currency,
}) => {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-xl mx-auto px-2 py-3">
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
        {categories.map((cat) => {
          const IconComponent = getCategoryIcon(cat.icon);
          const total = categoryTotals[cat.id] || 0;
          const isSelected = selectedCategoryId === cat.id;

          return (
            <div
              key={cat.id}
              className={`group relative flex flex-col items-center p-2 rounded-2xl transition-all cursor-pointer select-none border ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 shadow-xs'
              }`}
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
            >
              {/* Icon Circle */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105"
                style={{ backgroundColor: cat.color || '#10b981' }}
              >
                <IconComponent className="w-5 h-5" />
              </div>

              {/* Name */}
              <span
                className={`mt-1.5 text-[11px] font-semibold text-center truncate max-w-full ${
                  isSelected ? 'text-white' : 'text-slate-700'
                }`}
              >
                {cat.name}
              </span>

              {/* Amount */}
              <span
                className={`text-[10px] font-mono mt-0.5 ${
                  total > 0
                    ? isSelected
                      ? 'text-emerald-300 font-bold'
                      : 'text-slate-600 font-semibold'
                    : isSelected
                    ? 'text-slate-400'
                    : 'text-slate-400'
                }`}
              >
                {total > 0 ? formatCurrency(total, currency) : '0 €'}
              </span>

              {/* Quick Add Button on Hover / Selection */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAdd(cat);
                }}
                className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold transition shadow-xs ${
                  isSelected
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : 'opacity-0 group-hover:opacity-100 bg-slate-800 hover:bg-emerald-600'
                }`}
                title={`Añadir gasto en ${cat.name}`}
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
