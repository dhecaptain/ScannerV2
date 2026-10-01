import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { SplitViewWorkspace } from './components/SplitViewWorkspace';
import { AllItemsTable } from './components/AllItemsTable';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { LiveCameraModal } from './components/LiveCameraModal';
import { CropPerspectiveModal } from './components/CropPerspectiveModal';
import { ExportModal } from './components/ExportModal';
import { SelfTestModal } from './components/SelfTestModal';
import { useReceiptStore } from './store/useReceiptStore';
import { ShieldCheck, Lock, Receipt, Layers, BarChart3, Camera, Download } from 'lucide-react';

export default function App() {
  const { activeTab, setActiveTab, setCameraOpen, setExportModalOpen, theme, receipts } = useReceiptStore();

  // Initialize theme and service worker
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Register service worker for PWA offline capability
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration skipped:', err);
      });
    }
  }, [theme]);

  const totalReceipts = receipts.length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-16 md:pb-0">
      {/* App Header */}
      <Header />

      {/* Main Top Upload & Thumbnail Queue */}
      <UploadSection />

      {/* Tab Navigation Content */}
      <main className="flex-1">
        {activeTab === 'workspace' && <SplitViewWorkspace />}
        {activeTab === 'all_items' && <AllItemsTable />}
        {activeTab === 'dashboard' && <DashboardAnalytics />}
      </main>

      {/* Privacy & Compliance Banner Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mt-8 sm:mt-12 transition-colors mb-4 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Zero-Storage Privacy Guarantee:</strong> Images are processed in-memory only and never persisted on servers. EXIF GPS stripped automatically.
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>TLS / HTTPS Encrypted</span>
            </span>
            <span>•</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              ReceiptLens v2.5
            </span>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Navigation Bar (Hidden on md and up) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
            activeTab === 'workspace'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Workspace</span>
          {totalReceipts > 0 && (
            <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
              {totalReceipts}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all_items')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'all_items'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">All Items</span>
        </button>

        {/* Center Quick Snap Button */}
        <button
          onClick={() => setCameraOpen(true)}
          className="flex flex-col items-center justify-center -mt-4 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
          title="Quick Scan / Camera"
        >
          <Camera className="w-6 h-6" />
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'dashboard'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Analytics</span>
        </button>

        <button
          onClick={() => setExportModalOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-600"
        >
          <Download className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Export</span>
        </button>
      </nav>

      {/* Interactive Modals */}
      <LiveCameraModal />
      <CropPerspectiveModal />
      <ExportModal />
      <SelfTestModal />
    </div>
  );
}
