import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Layers, 
  ExternalLink, 
  Download, 
  FileSpreadsheet, 
  Filter, 
  EyeOff,
  Strikethrough
} from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';

export const AllItemsTable: React.FC = () => {
  const { receipts, setSelectedReceiptId, setActiveTab, setExportModalOpen } = useReceiptStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('all');

  // Extract unique merchants
  const uniqueMerchants = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach(r => {
      if (r.merchant) set.add(r.merchant);
    });
    return Array.from(set);
  }, [receipts]);

  // Aggregate all items across all receipts
  const allRows = useMemo(() => {
    const list: any[] = [];
    receipts.forEach(r => {
      r.items.forEach(item => {
        list.push({
          receiptId: r.id,
          receiptNumber: r.receipt_number || 'N/A',
          merchant: r.merchant,
          date: r.date || 'N/A',
          currency: r.currency || 'KES',
          ...item,
        });
      });
    });
    return list;
  }, [receipts]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      const matchSearch =
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (row.item_code && row.item_code.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchMerchant = merchantFilter === 'all' || row.merchant === merchantFilter;
      return matchSearch && matchMerchant;
    });
  }, [allRows, searchTerm, merchantFilter]);

  const totalSum = filteredRows
    .filter(r => !r.is_ignored)
    .reduce((sum, r) => sum + r.line_total, 0);

  if (receipts.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          No line items to display yet
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Upload or photograph your receipts to automatically consolidate all line items, quantities, and prices here.
        </p>
        <button
          onClick={() => setActiveTab('workspace')}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors"
        >
          Go to Upload
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* Top Banner & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <span>Combined Master Line Items</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            {filteredRows.length} items across {receipts.length} receipts • Total value: {receipts[0]?.currency || 'KES'} {totalSum.toFixed(2)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-56 min-w-[140px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items, SKU, or merchant..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Merchant filter */}
          <select
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
            aria-label="Filter by merchant"
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none shrink-0"
          >
            <option value="all">All Stores</option>
            {uniqueMerchants.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors shrink-0 ml-auto sm:ml-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 sm:hidden border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span>↔ Swipe table horizontally to see all data</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full min-w-[720px] text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Item Description</th>
                <th className="py-3 px-2">Source Receipt</th>
                <th className="py-3 px-2">Date</th>
                <th className="py-3 px-2">Item Code</th>
                <th className="py-3 px-2 text-right">Qty</th>
                <th className="py-3 px-2">Unit</th>
                <th className="py-3 px-2 text-right">Each Price</th>
                <th className="py-3 px-2 text-right">Line Total</th>
                <th className="py-3 px-2 text-center">VAT</th>
                <th className="py-3 px-2 text-center">Discount</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No matching items found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr
                    key={`${row.receiptId}_${row.id}_${idx}`}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      row.is_ignored ? 'opacity-40' : ''
                    } ${row.struck_through ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''}`}
                  >
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${row.struck_through ? 'line-through text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                        {row.name}
                      </span>
                      {row.struck_through && (
                        <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          Struck
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <button
                        onClick={() => {
                          setSelectedReceiptId(row.receiptId);
                          setActiveTab('workspace');
                        }}
                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
                        title="Jump to this receipt in Workspace"
                      >
                        <span className="truncate max-w-[120px]">{row.merchant}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500">{row.date}</td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500">{row.item_code || '-'}</td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {row.quantity}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500">{row.unit || 'PC'}</td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {row.currency} {row.unit_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {row.currency} {row.line_total.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-500">
                      {row.vat_code || 'G'}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                      {row.discount ? `-${row.discount.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedReceiptId(row.receiptId);
                          setActiveTab('workspace');
                        }}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700"
                        title="View Receipt"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
