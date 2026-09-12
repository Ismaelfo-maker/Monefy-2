import React from 'react';
import { formatCurrency } from '../utils/formatters';

export interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string;
  total: number;
  percentage: number;
}

interface DonutChartProps {
  expensesByCategory: CategoryExpense[];
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  currency: string;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  expensesByCategory,
  totalIncome,
  totalExpense,
  netBalance,
  currency,
  selectedCategoryId,
  onSelectCategory,
}) => {
  const size = 260;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercentage = 0;

  const selectedCategory = expensesByCategory.find((c) => c.categoryId === selectedCategoryId);

  return (
    <div className="relative flex flex-col items-center justify-center py-3">
      <div className="relative w-[260px] h-[260px] flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {/* Background Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {expensesByCategory.length > 0 ? (
            expensesByCategory.map((cat) => {
              const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((cumulativePercentage / 100) * circumference);
              cumulativePercentage += cat.percentage;

              const isSelected = selectedCategoryId === cat.categoryId;

              return (
                <circle
                  key={cat.categoryId}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={cat.color || '#10b981'}
                  strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 cursor-pointer hover:opacity-85"
                  onClick={() => onSelectCategory(isSelected ? null : cat.categoryId)}
                />
              );
            })
          ) : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
            />
          )}
        </svg>

        {/* Center Display */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 cursor-pointer"
          onClick={() => onSelectCategory(null)}
        >
          {selectedCategory ? (
            <>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-0.5 text-white"
                style={{ backgroundColor: selectedCategory.color }}
              >
                {selectedCategory.categoryName}
              </span>
              <span className="text-xl font-extrabold text-slate-900">
                {formatCurrency(selectedCategory.total, currency)}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {selectedCategory.percentage.toFixed(1)}% del gasto
              </span>
              <span className="text-[10px] text-emerald-600 font-medium mt-1">Toca para resetear</span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Disponible
              </span>
              <span
                className={`text-2xl font-black tracking-tight ${
                  netBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                {formatCurrency(netBalance, currency)}
              </span>
              <div className="flex items-center gap-2 mt-1 text-[11px]">
                <span className="text-emerald-700 font-medium">+{formatCurrency(totalIncome, currency)}</span>
                <span className="text-slate-300">|</span>
                <span className="text-rose-700 font-medium">-{formatCurrency(totalExpense, currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
