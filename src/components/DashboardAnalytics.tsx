import React, { useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Receipt, 
  ShoppingBag, 
  CheckCircle2, 
  Percent, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';

export const DashboardAnalytics: React.FC = () => {
  const { receipts } = useReceiptStore();

  const metrics = useMemo(() => {
    let grandTotal = 0;
    let preVatTotal = 0;
    let vatTotal = 0;
    let discountTotal = 0;
    let itemsCount = 0;
    const itemFrequency: Record<string, { count: number; spend: number }> = {};
    const dailySpend: Record<string, number> = {};
    const merchantSpend: Record<string, number> = {};

    receipts.forEach((r) => {
      grandTotal += r.total;
      if (r.subtotal_pre_vat) preVatTotal += r.subtotal_pre_vat;
      if (r.vat_total) vatTotal += r.vat_total;
      if (r.discount_total) discountTotal += r.discount_total;

      const dateKey = r.date || 'Unknown Date';
      dailySpend[dateKey] = (dailySpend[dateKey] || 0) + r.total;

      const merchantKey = r.merchant || 'Other';
      merchantSpend[merchantKey] = (merchantSpend[merchantKey] || 0) + r.total;

      r.items.forEach((item) => {
        if (!item.is_ignored) {
          itemsCount++;
          const name = item.name.trim();
          if (!itemFrequency[name]) {
            itemFrequency[name] = { count: 0, spend: 0 };
          }
          itemFrequency[name].count += item.quantity;
          itemFrequency[name].spend += item.line_total;
        }
      });
    });

    const topItems = Object.entries(itemFrequency)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    const currency = receipts[0]?.currency || 'KES';

    return {
      grandTotal,
      preVatTotal,
      vatTotal,
      discountTotal,
      itemsCount,
      receiptsCount: receipts.length,
      topItems,
      dailySpend,
      merchantSpend,
      currency,
    };
  }, [receipts]);

  // Max spend for bar normalization
  const maxDaySpend = Math.max(...Object.values(metrics.dailySpend), 1);
  const maxMerchantSpend = Math.max(...Object.values(metrics.merchantSpend), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <span>ReceiptLens Analytics Dashboard</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Financial summary, tax breakdown, and itemization across all scanned receipts
        </p>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Total Spent</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              {metrics.currency} {metrics.grandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Scanned Receipts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Receipts Scanned</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              {metrics.receiptsCount}
            </span>
          </div>
        </div>

        {/* Total Line Items */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Line Items Captured</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              {metrics.itemsCount}
            </span>
          </div>
        </div>

        {/* Discounts Captured */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block font-semibold">Discounts Captured</span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {metrics.currency} {metrics.discountTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 5 Purchased Items */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>Top Purchased Items by Value</span>
            </h3>
            <span className="text-[11px] text-slate-500">Highest line total</span>
          </div>

          <div className="space-y-3">
            {metrics.topItems.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[280px]">
                    {idx + 1}. {item.name}
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {metrics.currency} {item.spend.toFixed(2)}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (item.spend / (metrics.topItems[0]?.spend || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Spend Breakdown */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Spend Timeline</span>
            </h3>
            <span className="text-[11px] text-slate-500">By receipt date</span>
          </div>

          <div className="space-y-3">
            {Object.entries(metrics.dailySpend).map(([date, val], idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300 font-mono">
                    {date}
                  </span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">
                    {metrics.currency} {val.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (val / maxDaySpend) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
