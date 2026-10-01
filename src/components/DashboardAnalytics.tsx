import React, { useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Receipt, 
  ShoppingBag, 
  Percent, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
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
    const dailySpendMap: Record<string, number> = {};

    receipts.forEach((r) => {
      grandTotal += r.total;
      if (r.subtotal_pre_vat) preVatTotal += r.subtotal_pre_vat;
      if (r.vat_total) vatTotal += r.vat_total;
      if (r.discount_total) discountTotal += r.discount_total;

      const dateKey = r.date || 'Unknown Date';
      dailySpendMap[dateKey] = (dailySpendMap[dateKey] || 0) + r.total;

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

    const topItemsChartData = Object.entries(itemFrequency)
      .map(([name, data]) => ({
        name: name.length > 22 ? name.slice(0, 20) + '...' : name,
        fullName: name,
        spend: parseFloat(data.spend.toFixed(2)),
        quantity: data.count,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6);

    const dailySpendChartData = Object.entries(dailySpendMap).map(([date, amount]) => ({
      date,
      amount: parseFloat(amount.toFixed(2)),
    }));

    const currency = receipts[0]?.currency || 'KES';

    return {
      grandTotal,
      preVatTotal,
      vatTotal,
      discountTotal,
      itemsCount,
      receiptsCount: receipts.length,
      topItemsChartData,
      dailySpendChartData,
      currency,
    };
  }, [receipts]);

  if (receipts.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
          <BarChart3 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          No analytics data available
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Upload or capture receipts to automatically generate spending summaries, tax metrics, and item timelines.
        </p>
      </div>
    );
  }

  const barColors = ['#10b981', '#059669', '#0d9488', '#0284c7', '#6366f1', '#8b5cf6'];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <span>ReceiptLens Analytics Dashboard</span>
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
          Financial summary, tax breakdown, and itemization charts across scanned receipts
        </p>
      </div>

      {/* 4 Key Metric Cards (2x2 on mobile, 4 in a row on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Spend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xs flex items-center gap-2.5 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider block font-semibold truncate">Total Spent</span>
            <span className="text-sm sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums truncate block">
              {metrics.currency} {metrics.grandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Scanned Receipts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xs flex items-center gap-2.5 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shrink-0">
            <Receipt className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider block font-semibold truncate">Receipts</span>
            <span className="text-sm sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums block">
              {metrics.receiptsCount}
            </span>
          </div>
        </div>

        {/* Total Line Items */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xs flex items-center gap-2.5 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
            <ShoppingBag className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider block font-semibold truncate">Items</span>
            <span className="text-sm sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums block">
              {metrics.itemsCount}
            </span>
          </div>
        </div>

        {/* Discounts Captured */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xs flex items-center gap-2.5 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
            <Percent className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider block font-semibold truncate">Discounts</span>
            <span className="text-sm sm:text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums truncate block">
              {metrics.currency} {metrics.discountTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Real Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Top Items Bar Chart */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              <span>Top Items by Total Spend</span>
            </h3>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">{metrics.currency}</span>
          </div>

          <div className="h-60 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topItemsChartData} layout="vertical" margin={{ left: -10, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={85} />
                <Tooltip
                  formatter={(val: any) => [`${metrics.currency} ${val}`, 'Total Spend']}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || _label}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                  {metrics.topItemsChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Spend Timeline Bar Chart */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Daily Spend Timeline</span>
            </h3>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">{metrics.currency}</span>
          </div>

          <div className="h-60 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.dailySpendChartData} margin={{ left: -20, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: any) => [`${metrics.currency} ${val}`, 'Spend']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
