import React from 'react';
import { 
  Receipt, 
  Sparkles, 
  Crop, 
  Download, 
  Sun, 
  Moon, 
  FileSpreadsheet, 
  BarChart3, 
  CheckCircle2, 
  RefreshCw,
  Layers,
  FlaskConical,
  Zap,
  Trash2
} from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';

export const Header: React.FC = () => {
  const {
    receipts,
    activeTab,
    setActiveTab,
    isHighAccuracy,
    setHighAccuracy,
    autoCrop,
    setAutoCrop,
    theme,
    setTheme,
    setExportModalOpen,
    loadSampleReceipts,
    clearAllReceipts,
    setSelfTestOpen,
  } = useReceiptStore();

  const totalReceipts = receipts.length;
  const verifiedCount = receipts.filter(r => r.validation_status === 'valid').length;

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-emerald-800 to-emerald-600 dark:from-white dark:via-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                  ReceiptLens
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  AI OCR
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Precision Receipt & POS Slip Parser to Excel/CSV
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'workspace'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Workspace</span>
              {totalReceipts > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600">
                  {totalReceipts}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('all_items')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'all_items'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Items</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>
          </nav>

          {/* Session Reconciliation Status (Desktop) */}
          {totalReceipts > 0 && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{verifiedCount}/{totalReceipts} Reconciled</span>
            </div>
          )}

          {/* Controls & Tools */}
          <div className="flex items-center gap-2">
            {/* High Accuracy Toggle (Gemini 2.5 Pro vs Flash) */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setHighAccuracy(!isHighAccuracy)}
                title={isHighAccuracy ? 'Gemini 2.5 Pro (Deep reasoning & mathematical precision enabled)' : 'Gemini 2.5 Flash (Super fast OCR vision)'}
                className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                  isHighAccuracy
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                {isHighAccuracy ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span className="hidden sm:inline">2.5 Pro (Max Precision)</span>
                    <span className="sm:hidden">Pro</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="hidden sm:inline">2.5 Flash (Fast)</span>
                    <span className="sm:hidden">Flash</span>
                  </>
                )}
              </button>
            </div>

            {/* Auto Crop Toggle */}
            <button
              onClick={() => setAutoCrop(!autoCrop)}
              title={autoCrop ? 'Auto Perspective: ON' : 'Manual Crop Review: ON'}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                autoCrop
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>{autoCrop ? 'Auto Crop' : 'Review Crop'}</span>
            </button>

            {/* Dynamic Clear All or Load Demo */}
            {totalReceipts > 0 ? (
              <button
                onClick={clearAllReceipts}
                title="Clear all documents from current session"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            ) : (
              <button
                onClick={loadSampleReceipts}
                title="Load 5 demo receipt test cases to explore features"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Demo</span>
              </button>
            )}

            {/* Unit Tests Button */}
            <button
              onClick={() => setSelfTestOpen(true)}
              title="Run OCR and Math Unit Tests"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Export Action Button */}
            <button
              onClick={() => setExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs shadow-sm shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
