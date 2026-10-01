import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  FileText, 
  Clipboard, 
  Check, 
  Download, 
  Sliders, 
  Sparkles,
  Layers,
  Receipt
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useReceiptStore } from '../store/useReceiptStore';
import { ALL_ITEM_COLUMNS, exportToCSV, exportToExcel, copyToClipboardTSV } from '../utils/export';

export const ExportModal: React.FC = () => {
  const {
    isExportModalOpen,
    setExportModalOpen,
    receipts,
    selectedReceiptId,
  } = useReceiptStore();

  const [exportScope, setExportScope] = useState<'current' | 'all'>('all');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    ALL_ITEM_COLUMNS.filter(c => c.defaultIncluded).map(c => c.key)
  );
  const [copied, setCopied] = useState<boolean>(false);

  if (!isExportModalOpen) return null;

  const currentReceipt = receipts.find(r => r.id === selectedReceiptId) || receipts[0];
  const targetReceipts = exportScope === 'current' && currentReceipt ? [currentReceipt] : receipts;

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const fireConfetti = () => {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const handleDownloadExcel = () => {
    const filename = `ReceiptLens_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportToExcel(targetReceipts, selectedColumns, filename);
    fireConfetti();
    setExportModalOpen(false);
  };

  const handleDownloadCSV = () => {
    const filename = `ReceiptLens_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCSV(targetReceipts, selectedColumns, filename);
    fireConfetti();
    setExportModalOpen(false);
  };

  const handleCopyTSV = async () => {
    await copyToClipboardTSV(targetReceipts, selectedColumns);
    setCopied(true);
    fireConfetti();
    setTimeout(() => {
      setCopied(false);
      setExportModalOpen(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl p-6 space-y-6 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Export Receipt Data
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose format, scope, and customize columns for Excel or CSV
              </p>
            </div>
          </div>
          <button
            onClick={() => setExportModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope selector: Current Receipt vs All Receipts */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Export Scope
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setExportScope('all')}
              className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center gap-2 ${
                exportScope === 'all'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <div>
                <span>All Receipts</span>
                <span className="block text-[10px] text-slate-400">{receipts.length} total receipts</span>
              </div>
            </button>

            <button
              onClick={() => setExportScope('current')}
              className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center gap-2 ${
                exportScope === 'current'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <Receipt className="w-4 h-4 text-emerald-600" />
              <div>
                <span>Selected Receipt Only</span>
                <span className="block text-[10px] text-slate-400 truncate max-w-[140px]">
                  {currentReceipt?.merchant || 'Current'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Column Customizer */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Select Columns ({selectedColumns.length} of {ALL_ITEM_COLUMNS.length})</span>
            <button
              onClick={() => setSelectedColumns(ALL_ITEM_COLUMNS.map(c => c.key))}
              className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Select All
            </button>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 scrollbar-thin">
            {ALL_ITEM_COLUMNS.map((col) => {
              const checked = selectedColumns.includes(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => toggleColumn(col.key)}
                  className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-medium transition-colors flex items-center justify-between ${
                    checked
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate">{col.label}</span>
                  {checked && <Check className="w-3 h-3 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Export Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Choose Export Format
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Excel */}
            <button
              onClick={handleDownloadExcel}
              className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex flex-col items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>Download Excel (.xlsx)</span>
              <span className="text-[10px] text-emerald-200 font-normal">2 Sheets + Formulas</span>
            </button>

            {/* CSV */}
            <button
              onClick={handleDownloadCSV}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs flex flex-col items-center justify-center gap-1.5 shadow-xs transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileText className="w-5 h-5" />
              <span>Download CSV</span>
              <span className="text-[10px] text-slate-400 font-normal">UTF-8 with BOM</span>
            </button>

            {/* TSV Clipboard */}
            <button
              onClick={handleCopyTSV}
              className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs flex flex-col items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Clipboard className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
              <span className="text-[10px] text-slate-500 font-normal">Direct Sheets Paste</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
