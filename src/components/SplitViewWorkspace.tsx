import React, { useState, useRef } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  EyeOff, 
  Eye, 
  Sliders, 
  Sparkles, 
  Send, 
  HelpCircle,
  Strikethrough,
  Tag,
  Check,
  Percent,
  Calendar,
  DollarSign,
  User,
  CreditCard,
  Building,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Camera,
  UploadCloud,
  FileSpreadsheet,
  Receipt as ReceiptIcon,
  Zap,
} from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';
import { ReceiptItem } from '../types/receipt';

export const SplitViewWorkspace: React.FC = () => {
  const {
    receipts,
    selectedReceiptId,
    updateReceipt,
    updateItem,
    addItem,
    deleteItem,
    toggleIgnoreItem,
    customFields,
    toggleCustomField,
    addCustomField,
    removeCustomField,
    askAboutDocument,
    setCameraOpen,
    addUploadedFiles,
    loadSampleReceipts,
  } = useReceiptStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const receipt = receipts.find(r => r.id === selectedReceiptId) || receipts[0];

  // Image viewer state (zoom, pan, rotation)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mobileView, setMobileView] = useState<'both' | 'photo' | 'table'>('table');

  // Custom fields & Ask AI drawer state
  const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState<boolean>(false);
  const [newFieldName, setNewFieldName] = useState<string>('');
  const [newFieldDesc, setNewFieldDesc] = useState<string>('');
  const [askQuery, setAskQuery] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [askResult, setAskResult] = useState<string | null>(null);

  if (!receipt) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-8">
        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addUploadedFiles(Array.from(e.target.files));
            }
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addUploadedFiles(Array.from(e.target.files));
            }
          }}
        />

        {/* Hero Illustration & Heading */}
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/10">
            <ReceiptIcon className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Scan Your Receipts & Documents
            </h2>
            <p className="max-w-xl mx-auto text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Upload photos or PDFs of receipts, grocery slips, or invoices. Gemini AI extracts line items, prices, VAT, and discounts with high accuracy, ready for clean Excel or CSV export.
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <UploadCloud className="w-5 h-5" />
            <span>Upload Document</span>
          </button>

          <button
            onClick={() => setCameraOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Camera className="w-5 h-5 text-emerald-500" />
            <span>Live Camera Scanner</span>
          </button>
        </div>

        {/* Optional Demo Link */}
        <div>
          <button
            onClick={loadSampleReceipts}
            className="text-xs text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium underline underline-offset-4 transition-colors"
          >
            Need to test first? Load 5 Quick Mart sample receipts
          </button>
        </div>

        {/* 3 Value Proposition Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center font-bold">
              <Check className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Precision Line Items</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Extracts 2-line names, SKUs, and weighted decimal units (e.g. 0.190 KG @ 399.00).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 flex items-center justify-center font-bold">
              <Check className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Math & Strike-Through Checks</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Verifies quantity × price = line total, checks VAT consistency, and detects pen strike-throughs.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Professional Excel & CSV</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Multi-sheet Excel with frozen header & SUM formulas, plus UTF-8 CSV with Excel BOM.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle zoom & pan
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(3.5, Math.max(0.5, prev + delta)));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  // Add custom field handler
  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    addCustomField({
      name: newFieldName.trim(),
      description: newFieldDesc.trim() || undefined,
      type: 'string',
      enabled: true,
    });
    setNewFieldName('');
    setNewFieldDesc('');
  };

  // Ask AI about document
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuery.trim() || isAsking) return;
    setIsAsking(true);
    setAskResult(null);
    try {
      const ans = await askAboutDocument(receipt.id, askQuery.trim());
      setAskResult(ans);
    } catch (err: any) {
      setAskResult(`Error: ${err.message || 'Could not query document'}`);
    } finally {
      setIsAsking(false);
    }
  };

  const activeItems = receipt.items.filter(i => !i.is_ignored);
  const itemsSum = activeItems.reduce((acc, it) => acc + it.line_total, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Receipt Summary Banner */}
      <div className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-base shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={receipt.merchant}
                  onChange={(e) => updateReceipt(receipt.id, { merchant: e.target.value })}
                  aria-label="Merchant Name"
                  className="font-bold text-base text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none transition-colors"
                />
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  receipt.validation_status === 'valid'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {receipt.validation_status === 'valid' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Review Needed</span>
                    </>
                  )}
                </span>
                {receipt.engine === 'tesseract' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm">
                    <Zap className="w-3 h-3" />
                    <span>Basic mode</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                    {receipt.model?.includes('pro') ? 'Gemini 2.5 Pro' : 'Gemini 2.5 Flash'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {receipt.branch || 'Main Branch'} {receipt.date ? `• ${receipt.date}` : ''} {receipt.receipt_number ? `• Rct #${receipt.receipt_number}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Total Amount</span>
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                {receipt.currency} {receipt.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Quality checks warning banner if blurry, dark, or small */}
        {receipt.quality_check && (receipt.quality_check.is_blurry || receipt.quality_check.is_dark || receipt.quality_check.is_small) && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Photo Quality Warning: </strong>
              {receipt.quality_check.is_blurry && 'Blur detected (low sharpness score). '}
              {receipt.quality_check.is_dark && 'Low illumination detected. '}
              {receipt.quality_check.is_small && 'Dimensions under 400px. '}
              {receipt.quality_check.message || 'Consider retaking photo with better lighting or holding the camera steady.'}
            </span>
          </div>
        )}

        {/* Validation warnings banner if discrepancies */}
        {receipt.validation_issues && receipt.validation_issues.length > 0 && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Discrepancy & Validation Checks:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1 font-mono">
              {receipt.validation_issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Receipt Level Warnings from Model */}
        {receipt.warnings && receipt.warnings.length > 0 && (
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono space-y-0.5">
            {receipt.warnings.map((w, i) => (
              <p key={i}>• {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Mobile View Switcher (Visible only on mobile/tablet screens < lg) */}
      <div className="lg:hidden flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mb-4 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
        <button
          onClick={() => setMobileView('table')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mobileView === 'table'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <ReceiptIcon className="w-3.5 h-3.5" />
          <span>Items & Totals</span>
        </button>

        <button
          onClick={() => setMobileView('photo')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mobileView === 'photo'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Receipt Photo</span>
        </button>

        <button
          onClick={() => setMobileView('both')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            mobileView === 'both'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Split Both</span>
        </button>
      </div>

      {/* Main Split View: 50% Image Viewer | 50% Editable Data Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Zoomable & Pan Receipt Viewer */}
        <div className={`${mobileView === 'table' ? 'hidden lg:flex' : 'flex'} lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg flex-col h-[360px] sm:h-[480px] lg:h-[650px] relative`}>
          {/* Viewer Toolbar */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-white text-xs">
            <span className="font-mono text-[11px] text-slate-300 truncate max-w-[140px]">
              {receipt.image_name}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleZoom(0.25)}
                className="p-1 rounded-lg hover:bg-white/20 text-slate-200"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleZoom(-0.25)}
                className="p-1 rounded-lg hover:bg-white/20 text-slate-200"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-1 rounded-lg hover:bg-white/20 text-slate-200"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetView}
                className="p-1 rounded-lg hover:bg-white/20 text-slate-200"
                title="Reset View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Canvas/Image Viewport */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 0.15s ease-out',
              }}
              className="max-w-full max-h-full p-6"
            >
              <img
                src={receipt.image_url}
                alt="Receipt scan"
                className="max-h-[580px] w-auto object-contain rounded-lg shadow-2xl pointer-events-none"
              />
            </div>
          </div>

          {/* Image info & instructions pill */}
          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-[11px] text-slate-400 bg-black/50 backdrop-blur-xs px-3 py-1 rounded-xl">
            <span>Scroll or drag to pan • Click table row to inspect</span>
            <span className="font-mono">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Editable Line Items Table & Metadata */}
        <div className={`${mobileView === 'photo' ? 'hidden lg:block' : 'block'} lg:col-span-7 space-y-4`}>
          {/* Metadata quick inputs (Cashier, Date, Customer, Payment) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">Date</label>
              <input
                type="text"
                value={receipt.date || ''}
                placeholder="YYYY-MM-DD"
                onChange={(e) => updateReceipt(receipt.id, { date: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">Customer</label>
              <input
                type="text"
                value={receipt.customer_name || ''}
                placeholder="Customer Name"
                onChange={(e) => updateReceipt(receipt.id, { customer_name: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">Cashier</label>
              <input
                type="text"
                value={receipt.cashier || ''}
                placeholder="Cashier Name"
                onChange={(e) => updateReceipt(receipt.id, { cashier: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">Payment</label>
              <input
                type="text"
                value={receipt.payment_method || ''}
                placeholder="M-PESA / Cash"
                onChange={(e) => updateReceipt(receipt.id, { payment_method: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Line Items ({receipt.items.length})
                </span>
                <span className="text-[10px] text-slate-400">
                  Yellow cells denote low confidence
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 sm:hidden">
                  ↔ Swipe sideways to view prices & actions
                </span>
              </div>
              <button
                onClick={() => addItem(receipt.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-x-auto max-h-[420px] scrollbar-thin">
              <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 w-20">Code</th>
                    <th className="py-2.5 px-2 w-16 text-right">Qty</th>
                    <th className="py-2.5 px-2 w-14">Unit</th>
                    <th className="py-2.5 px-2 w-20 text-right">Each</th>
                    <th className="py-2.5 px-2 w-24 text-right">Total</th>
                    <th className="py-2.5 px-2 w-14 text-center">VAT</th>
                    <th className="py-2.5 px-2 w-16 text-center">Struck</th>
                    <th className="py-2.5 px-2 w-12 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {receipt.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No items found on this receipt. Click "+ Add Item" to create one manually.
                      </td>
                    </tr>
                  ) : (
                    receipt.items.map((item) => {
                      const isLowConfidence = item.confidence < 0.8;
                      const hasMathMismatch =
                        item.quantity > 0 &&
                        item.unit_price > 0 &&
                        Math.abs(item.quantity * item.unit_price - item.line_total) > 0.02;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            item.is_ignored ? 'opacity-40 bg-slate-100/50 dark:bg-slate-800/20' : ''
                          } ${item.struck_through ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''}`}
                        >
                          {/* Name */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(receipt.id, item.id, { name: e.target.value })}
                              className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none py-0.5 font-medium ${
                                item.struck_through ? 'line-through text-slate-500' : 'text-slate-900 dark:text-slate-100'
                              } ${isLowConfidence ? 'bg-amber-100/70 dark:bg-amber-950/50 rounded px-1' : ''}`}
                            />
                            {item.discount ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-mono">
                                Rewarded Discount: -{item.discount.toFixed(2)}
                              </span>
                            ) : null}
                          </td>

                          {/* Code */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.item_code || ''}
                              placeholder="-"
                              onChange={(e) => updateItem(receipt.id, item.id, { item_code: e.target.value })}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none font-mono text-[11px] text-slate-600 dark:text-slate-300"
                            />
                          </td>

                          {/* Quantity */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => updateItem(receipt.id, item.id, { quantity: parseFloat(e.target.value) || 0 })}
                              className={`w-full text-right bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none font-mono tabular-nums text-slate-800 dark:text-slate-200 ${
                                isLowConfidence ? 'bg-amber-100/70 dark:bg-amber-950/50 rounded px-1' : ''
                              }`}
                            />
                          </td>

                          {/* Unit */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.unit || 'PC'}
                              onChange={(e) => updateItem(receipt.id, item.id, { unit: e.target.value.toUpperCase() })}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none text-[11px] font-mono text-slate-600 dark:text-slate-300"
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(receipt.id, item.id, { unit_price: parseFloat(e.target.value) || 0 })}
                              className="w-full text-right bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none font-mono tabular-nums text-slate-800 dark:text-slate-200"
                            />
                          </td>

                          {/* Line Total */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.line_total}
                              onChange={(e) => updateItem(receipt.id, item.id, { line_total: parseFloat(e.target.value) || 0 })}
                              className={`w-full text-right bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none font-mono font-bold tabular-nums ${
                                hasMathMismatch
                                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded px-1'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              } ${isLowConfidence ? 'bg-amber-100/70 dark:bg-amber-950/50 rounded px-1' : ''}`}
                            />
                          </td>

                          {/* VAT */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="text"
                              value={item.vat_code || ''}
                              onChange={(e) => updateItem(receipt.id, item.id, { vat_code: e.target.value.toUpperCase() })}
                              className="w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                            />
                          </td>

                          {/* Struck Through Toggle */}
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => updateItem(receipt.id, item.id, { struck_through: !item.struck_through })}
                              className={`p-1 rounded transition-colors ${
                                item.struck_through
                                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 font-bold'
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title={item.struck_through ? 'Item struck through by pen' : 'Mark as struck through'}
                            >
                              <Strikethrough className="w-3.5 h-3.5" />
                            </button>
                          </td>

                          {/* Actions: Ignore / Delete */}
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => toggleIgnoreItem(receipt.id, item.id)}
                                className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
                                  item.is_ignored ? 'text-amber-500' : 'text-slate-400'
                                }`}
                                title={item.is_ignored ? 'Include in totals' : 'Ignore this row in totals/export'}
                              >
                                {item.is_ignored ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => deleteItem(receipt.id, item.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                title="Delete item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block">Pre-VAT Subtotal</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {receipt.currency} {(receipt.subtotal_pre_vat || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">VAT Tax Total</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {receipt.currency} {(receipt.vat_total || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Total Discounts</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  -{receipt.currency} {(receipt.discount_total || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Printed Grand Total</span>
                <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                  {receipt.currency} {receipt.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 7: Flexible "Extract More" & Custom Fields Drawer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <button
              onClick={() => setIsCustomFieldsOpen(!isCustomFieldsOpen)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Extract More & Custom Fields ({customFields.filter(f => f.enabled).length} Active)
                </span>
              </div>
              {isCustomFieldsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isCustomFieldsOpen && (
              <div className="p-4 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                {/* Preset Toggles */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                    Preset Document Fields
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {customFields.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => toggleCustomField(f.id)}
                        className={`px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all ${
                          f.enabled
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {f.enabled && <Check className="w-3 h-3" />}
                        <span>{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Custom Field Form */}
                <form onSubmit={handleAddCustomField} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="New Field Name (e.g. Loyalty Points, Tax PIN)"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newFieldDesc}
                    onChange={(e) => setNewFieldDesc(e.target.value)}
                    placeholder="Optional Description"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-colors shrink-0"
                  >
                    Add Field
                  </button>
                </form>

                {/* Free-text Ask About this Document */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ask about this document</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Query the Gemini vision model directly on this image (e.g., "What was the till number?" or "Is there a promo barcode?").
                  </p>

                  <form onSubmit={handleAskAI} className="flex gap-2">
                    <input
                      type="text"
                      value={askQuery}
                      onChange={(e) => setAskQuery(e.target.value)}
                      placeholder='Ask anything (e.g. "Extract all items over 100 KES")'
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isAsking || !askQuery.trim()}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      {isAsking ? (
                        <span>Analyzing...</span>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Ask</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Ask Result Answer Box */}
                  {askResult && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-bold">Answer: </span>
                        <span>{askResult}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
