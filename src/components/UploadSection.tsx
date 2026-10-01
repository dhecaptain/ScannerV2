import React, { useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  Camera, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  X, 
  RotateCw, 
  Crop, 
  Sparkles,
  AlertCircle,
  FileCheck,
  Plus,
  Trash2
} from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';
import { DocumentType } from '../types/receipt';

export const UploadSection: React.FC = () => {
  const {
    receipts,
    selectedReceiptId,
    setSelectedReceiptId,
    addUploadedFiles,
    removeReceipt,
    retryReceipt,
    openCropModal,
    documentType,
    setDocumentType,
    setCameraOpen,
    loadSampleReceipts,
    clearAllReceipts,
  } = useReceiptStore();

  const fileInputCameraRef = useRef<HTMLInputElement>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      await addUploadedFiles(acceptedFiles);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  });

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addUploadedFiles(Array.from(e.target.files));
    }
  };

  const docTypes: { label: string; value: DocumentType }[] = [
    { label: 'Receipt / Till Slip', value: 'receipt' },
    { label: 'Invoice', value: 'invoice' },
    { label: 'Price List', value: 'price_list' },
    { label: 'Table / Form', value: 'table' },
    { label: 'Auto Detect', value: 'auto' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 sm:p-4 transition-colors">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* Top bar: Upload zone + camera triggers */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3 items-center">
          {/* Drag & Drop Area */}
          <div
            {...getRootProps()}
            className={`md:col-span-8 border-2 border-dashed rounded-2xl p-3 sm:p-4 text-center cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 ${
              isDragActive
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500/70 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {isDragActive ? 'Drop images here...' : 'Upload receipt & document photos'}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Multiple files: JPG, PNG, WEBP, HEIC, PDF. Concurrency queue processes 3 at once.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all"
              >
                Browse Files
              </button>
            </div>
          </div>

          {/* Camera Buttons & Doc Type Selector */}
          <div className="md:col-span-4 flex flex-col sm:flex-row md:flex-col gap-2">
            <div className="flex items-center gap-2 w-full">
              {/* Native device capture */}
              <input
                ref={fileInputCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
              />
              <button
                onClick={() => fileInputCameraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
                title="Open native camera on mobile device"
              >
                <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Take Photo</span>
              </button>

              {/* Live Web Scanner with Framing Guide */}
              <button
                onClick={() => setCameraOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-300 dark:border-emerald-800 transition-colors"
                title="Live video scanner with receipt alignment guide"
              >
                <Crop className="w-4 h-4 text-emerald-600" />
                <span>Live Scanner</span>
              </button>
            </div>

            {/* Document Type Selector */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <span className="text-[11px] font-medium text-slate-500 px-2 shrink-0">Mode:</span>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                aria-label="Document Type"
                className="w-full bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {docTypes.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Thumbnail Carousel & Status Badges */}
        {receipts.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Your Uploaded Documents ({receipts.length})</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] hidden sm:inline">Click a thumbnail to inspect & edit</span>
                <button
                  onClick={clearAllReceipts}
                  className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Clear all uploaded documents"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory">
              {receipts.map((rec) => {
                const isSelected = rec.id === selectedReceiptId;
                const totalItems = rec.items.filter(i => !i.is_ignored).length;

                return (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedReceiptId(rec.id)}
                    className={`relative group shrink-0 w-38 sm:w-44 rounded-xl border p-2 cursor-pointer transition-all snap-start ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 mb-2">
                      <img
                        src={rec.image_url}
                        alt={rec.merchant}
                        className="w-full h-full object-cover"
                      />

                      {/* Engine Tag */}
                      {rec.engine === 'gemini' ? (
                        <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white backdrop-blur-xs">
                          {rec.model?.includes('pro') ? '2.5 Pro' : '2.5 Flash'}
                        </span>
                      ) : (
                        <span className="absolute bottom-1 left-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 shadow-sm">
                          Basic mode
                        </span>
                      )}

                      {/* Status Overlay Badge */}
                      <div className="absolute top-1 right-1">
                        {rec.status === 'queued' && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900/80 text-white">
                            <Clock className="w-2.5 h-2.5" /> Queued
                          </span>
                        )}
                        {rec.status === 'preprocessing' && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-600/90 text-white animate-pulse">
                            <Crop className="w-2.5 h-2.5" /> Prep
                          </span>
                        )}
                        {rec.status === 'extracting' && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-600/90 text-white animate-pulse">
                            <Sparkles className="w-2.5 h-2.5" /> AI Scan
                          </span>
                        )}
                        {rec.status === 'done' && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600/90 text-white shadow-xs">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Done
                          </span>
                        )}
                        {rec.status === 'needs_review' && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white shadow-xs">
                            <AlertTriangle className="w-2.5 h-2.5" /> Review
                          </span>
                        )}
                        {rec.status === 'failed' && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-600/90 text-white">
                            <AlertCircle className="w-2.5 h-2.5" /> Failed
                          </span>
                        )}
                      </div>

                      {/* Quick Action Overlay on Hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCropModal(rec.id);
                          }}
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 shadow"
                          title="Adjust crop corners & perspective"
                        >
                          <Crop className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            retryReceipt(rec.id);
                          }}
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 shadow"
                          title="Retry extraction"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeReceipt(rec.id);
                          }}
                          className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white shadow"
                          title="Remove receipt"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate" title={rec.merchant}>
                        {rec.merchant}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{totalItems} item{totalItems === 1 ? '' : 's'}</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {rec.currency} {rec.total.toFixed(2)}
                        </span>
                      </div>
                      {rec.progress_message && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 truncate animate-pulse font-mono">
                          {rec.progress_message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
