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
import { ShieldCheck, Lock, Sparkles, Heart } from 'lucide-react';

export default function App() {
  const { activeTab, theme } = useReceiptStore();

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
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
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mt-12 transition-colors">
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

      {/* Interactive Modals */}
      <LiveCameraModal />
      <CropPerspectiveModal />
      <ExportModal />
      <SelfTestModal />
    </div>
  );
}
