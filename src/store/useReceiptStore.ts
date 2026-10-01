import { create } from 'zustand';
import { CustomFieldDef, DocumentType, Point, ReceiptData, ReceiptItem } from '../types/receipt';
import { SAMPLE_RECEIPTS } from '../data/sampleReceipts';
import { preprocessReceiptImage } from '../utils/imagePreprocessing';
import { runTesseractFallback } from '../utils/tesseractFallback';
import { validateReceipt } from '../utils/validation';

export const DEFAULT_PRESET_FIELDS: CustomFieldDef[] = [
  { id: 'f_cashier', name: 'Cashier', description: 'Name of the cashier who served the order', type: 'string', isPreset: true, enabled: true },
  { id: 'f_customer', name: 'Customer Name', description: 'Customer or buyer full name', type: 'string', isPreset: true, enabled: true },
  { id: 'f_payment_details', name: 'Payment Details', description: 'M-Pesa transaction code, till number, or card authorization', type: 'string', isPreset: true, enabled: true },
  { id: 'f_vat_breakdown', name: 'VAT Breakdown', description: 'Tax rate code and tax amount breakdown', type: 'string', isPreset: true, enabled: true },
  { id: 'f_discounts', name: 'Rewarded Discounts', description: 'Discount codes and deductions applied', type: 'string', isPreset: true, enabled: true },
  { id: 'f_loyalty', name: 'Loyalty Points', description: 'Points earned or balance if printed', type: 'string', isPreset: true, enabled: false },
  { id: 'f_item_codes', name: 'Item Codes / SKU', description: 'Product internal barcodes or SKU IDs', type: 'string', isPreset: true, enabled: true },
  { id: 'f_receipt_no', name: 'Receipt / Till / Session', description: 'POS session, till number, and receipt reference', type: 'string', isPreset: true, enabled: true },
];

interface ReceiptState {
  receipts: ReceiptData[];
  selectedReceiptId: string | null;
  activeTab: 'workspace' | 'all_items' | 'dashboard' | 'tests';
  
  // Settings & Toggles
  isHighAccuracy: boolean;
  autoCrop: boolean;
  documentType: DocumentType;
  customFields: CustomFieldDef[];
  theme: 'light' | 'dark';

  // Modal controls
  isCameraOpen: boolean;
  isCropModalOpen: boolean;
  cropTargetReceiptId: string | null;
  isExportModalOpen: boolean;
  isSelfTestOpen: boolean;

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveTab: (tab: 'workspace' | 'all_items' | 'dashboard' | 'tests') => void;
  setHighAccuracy: (val: boolean) => void;
  setAutoCrop: (val: boolean) => void;
  setDocumentType: (type: DocumentType) => void;
  setSelectedReceiptId: (id: string | null) => void;

  // Modals
  setCameraOpen: (open: boolean) => void;
  openCropModal: (receiptId: string) => void;
  closeCropModal: () => void;
  setExportModalOpen: (open: boolean) => void;
  setSelfTestOpen: (open: boolean) => void;

  // Receipts operations
  addUploadedFiles: (files: File[]) => Promise<void>;
  updateReceipt: (id: string, partial: Partial<ReceiptData>) => void;
  removeReceipt: (id: string) => void;
  reorderReceipts: (dragIndex: number, hoverIndex: number) => void;
  retryReceipt: (id: string) => void;
  loadSampleReceipts: () => void;
  clearAllReceipts: () => void;

  // Crop & Perspective Apply
  applyCropAndEnhance: (
    id: string,
    corners: [Point, Point, Point, Point],
    rotation: number
  ) => Promise<void>;

  // Line Items operations
  updateItem: (receiptId: string, itemId: string, partial: Partial<ReceiptItem>) => void;
  addItem: (receiptId: string) => void;
  deleteItem: (receiptId: string, itemId: string) => void;
  toggleIgnoreItem: (receiptId: string, itemId: string) => void;

  // Custom Fields
  toggleCustomField: (fieldId: string) => void;
  addCustomField: (field: Omit<CustomFieldDef, 'id' | 'isPreset'>) => void;
  removeCustomField: (fieldId: string) => void;

  // Ask AI about document
  askAboutDocument: (receiptId: string, question: string) => Promise<string>;
}

// Concurrency Queue Manager (limit 3)
let activeWorkers = 0;
const CONCURRENCY_LIMIT = 3;
const queue: string[] = [];

export const useReceiptStore = create<ReceiptState>((set, get) => {
  // Load saved custom fields & theme from localStorage
  const savedFieldsJson = typeof window !== 'undefined' ? localStorage.getItem('receiptlens_custom_fields') : null;
  const initialCustomFields: CustomFieldDef[] = savedFieldsJson
    ? JSON.parse(savedFieldsJson)
    : DEFAULT_PRESET_FIELDS;

  const savedTheme = typeof window !== 'undefined' && localStorage.getItem('receiptlens_theme') === 'dark' ? 'dark' : 'light';

  // Helper to trigger concurrent queue runner
  const triggerQueue = () => {
    while (activeWorkers < CONCURRENCY_LIMIT && queue.length > 0) {
      const nextId = queue.shift();
      if (nextId) {
        activeWorkers++;
        processReceiptItem(nextId).finally(() => {
          activeWorkers--;
          triggerQueue();
        });
      }
    }
  };

  const processReceiptItem = async (receiptId: string) => {
    const { receipts, isHighAccuracy, customFields, documentType, autoCrop } = get();
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt || !receipt.original_file) return;

    // 1. Update status to Preprocessing
    set(state => ({
      receipts: state.receipts.map(r =>
        r.id === receiptId
          ? { ...r, status: 'preprocessing', progress_message: 'Enhancing lighting & detecting edges...' }
          : r
      ),
    }));

    let processedBlob: Blob;
    let processedDataUrl: string;
    let qualityReport: any;
    let detectedCorners: [Point, Point, Point, Point];

    try {
      const prepResult = await preprocessReceiptImage(receipt.original_file, {
        autoPerspective: autoCrop,
        rotation: receipt.rotation_angle || 0,
      });

      processedBlob = prepResult.processedBlob;
      processedDataUrl = prepResult.processedDataUrl;
      qualityReport = prepResult.quality;
      detectedCorners = prepResult.detectedCorners;

      // Update receipt with preview
      set(state => ({
        receipts: state.receipts.map(r =>
          r.id === receiptId
            ? {
                ...r,
                image_url: processedDataUrl,
                quality_check: qualityReport,
                crop_corners: detectedCorners,
                status: 'extracting',
                progress_message: 'Calling Gemini Vision model (structured parsing)...',
              }
            : r
        ),
      }));
    } catch (e: any) {
      console.warn('Preprocessing failed, using raw file:', e);
      processedBlob = receipt.original_file;
      processedDataUrl = receipt.image_url;
    }

    // 2. Extract with Gemini API
    const targetModel = isHighAccuracy ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const enabledFields = customFields
      .filter(f => f.enabled)
      .map(f => ({ name: f.name, description: f.description, type: f.type }));

    // Convert blob to base64
    const base64Data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const b64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(processedBlob);
    });

    // Exponential backoff retry logic (up to 2 retries)
    let extractedData: any = null;
    let lastError: any = null;
    let usedFallback = false;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Data,
            mimeType: 'image/jpeg',
            model: targetModel,
            customFields: enabledFields,
            documentType,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned ${response.status}`);
        }

        const json = await response.json();
        extractedData = json.data;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Extraction attempt ${attempt} failed:`, err);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, attempt * 1200));
        }
      }
    }

    // If Gemini API fails or is offline, invoke Tesseract.js client fallback
    if (!extractedData) {
      console.info('Switching to local Tesseract.js fallback engine...');
      usedFallback = true;
      try {
        set(state => ({
          receipts: state.receipts.map(r =>
            r.id === receiptId
              ? { ...r, progress_message: 'Running local OCR fallback (Tesseract.js)...' }
              : r
          ),
        }));

        extractedData = await runTesseractFallback(processedBlob, (_pct, msg) => {
          set(state => ({
            receipts: state.receipts.map(r =>
              r.id === receiptId ? { ...r, progress_message: msg } : r
            ),
          }));
        });
      } catch (tessErr: any) {
        set(state => ({
          receipts: state.receipts.map(r =>
            r.id === receiptId
              ? {
                  ...r,
                  status: 'failed',
                  error: `Extraction failed: ${lastError?.message || tessErr?.message}`,
                  progress_message: undefined,
                }
              : r
          ),
        }));
        return;
      }
    }

    // Assign IDs to items
    const rawItems: ReceiptItem[] = (extractedData.items || []).map((it: any, idx: number) => ({
      id: `item_${receiptId}_${idx}_${Date.now()}`,
      name: it.name || `Item ${idx + 1}`,
      item_code: it.item_code || null,
      quantity: Number(it.quantity) || 1,
      unit: it.unit || 'PC',
      unit_price: Number(it.unit_price) || 0,
      line_total: Number(it.line_total) || 0,
      vat_code: it.vat_code || 'G',
      discount: it.discount !== undefined && it.discount !== null ? Number(it.discount) : null,
      struck_through: Boolean(it.struck_through),
      confidence: it.confidence !== undefined ? Number(it.confidence) : 0.95,
      is_ignored: false,
    }));

    // Math validation
    const tempReceipt: Partial<ReceiptData> = {
      ...extractedData,
      items: rawItems,
    };
    const validation = validateReceipt(tempReceipt);

    set(state => ({
      receipts: state.receipts.map(r => {
        if (r.id !== receiptId) return r;
        return {
          ...r,
          status: validation.status === 'valid' ? 'done' : 'needs_review',
          progress_message: undefined,
          engine: usedFallback ? 'tesseract' : 'gemini',
          model: usedFallback ? 'Tesseract.js OCR v5' : targetModel,
          merchant: extractedData.merchant || 'Unknown Merchant',
          branch: extractedData.branch || null,
          date: extractedData.date || null,
          time: extractedData.time || null,
          receipt_number: extractedData.receipt_number || null,
          currency: extractedData.currency || 'KES',
          customer_name: extractedData.customer_name || null,
          cashier: extractedData.cashier || null,
          payment_method: extractedData.payment_method || null,
          items: rawItems,
          subtotal_pre_vat: extractedData.subtotal_pre_vat ?? null,
          vat_total: extractedData.vat_total ?? null,
          discount_total: extractedData.discount_total ?? null,
          total: Number(extractedData.total) || 0,
          amount_paid: extractedData.amount_paid ?? null,
          change: extractedData.change ?? null,
          warnings: [
            ...(extractedData.warnings || []),
            ...(usedFallback ? ['Extracted using client-side Tesseract.js (Basic mode)'] : []),
          ],
          validation_status: validation.status,
          validation_issues: validation.issues,
          custom_fields: extractedData.custom_fields || {},
        };
      }),
    }));
  };

  return {
    receipts: [],
    selectedReceiptId: null,
    activeTab: 'workspace',
    isHighAccuracy: false,
    autoCrop: true,
    documentType: 'receipt',
    customFields: initialCustomFields,
    theme: savedTheme,

    isCameraOpen: false,
    isCropModalOpen: false,
    cropTargetReceiptId: null,
    isExportModalOpen: false,
    isSelfTestOpen: false,

    setTheme: (theme) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('receiptlens_theme', theme);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      set({ theme });
    },

    setActiveTab: (activeTab) => set({ activeTab }),
    setHighAccuracy: (isHighAccuracy) => set({ isHighAccuracy }),
    setAutoCrop: (autoCrop) => set({ autoCrop }),
    setDocumentType: (documentType) => set({ documentType }),
    setSelectedReceiptId: (selectedReceiptId) => set({ selectedReceiptId }),

    setCameraOpen: (isCameraOpen) => set({ isCameraOpen }),
    openCropModal: (cropTargetReceiptId) => set({ isCropModalOpen: true, cropTargetReceiptId }),
    closeCropModal: () => set({ isCropModalOpen: false, cropTargetReceiptId: null }),
    setExportModalOpen: (isExportModalOpen) => set({ isExportModalOpen }),
    setSelfTestOpen: (isSelfTestOpen) => set({ isSelfTestOpen }),

    addUploadedFiles: async (files: File[]) => {
      const newItems: ReceiptData[] = [];

      for (const file of files) {
        const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const objUrl = URL.createObjectURL(file);

        newItems.push({
          id,
          image_name: file.name,
          image_url: objUrl,
          thumbnail_url: objUrl,
          status: 'queued',
          engine: 'gemini',
          merchant: 'Processing...',
          branch: null,
          date: null,
          time: null,
          receipt_number: null,
          currency: 'KES',
          customer_name: null,
          cashier: null,
          payment_method: null,
          items: [],
          subtotal_pre_vat: null,
          vat_total: null,
          discount_total: null,
          total: 0,
          amount_paid: null,
          change: null,
          warnings: [],
          validation_status: 'valid',
          validation_issues: [],
          original_file: file,
        });

        queue.push(id);
      }

      set(state => ({
        receipts: [...state.receipts, ...newItems],
        selectedReceiptId: state.selectedReceiptId || newItems[0]?.id || null,
      }));

      triggerQueue();
    },

    updateReceipt: (id, partial) => {
      set(state => ({
        receipts: state.receipts.map(r => {
          if (r.id !== id) return r;
          const updated = { ...r, ...partial };
          const validation = validateReceipt(updated);
          return {
            ...updated,
            validation_status: validation.status,
            validation_issues: validation.issues,
          };
        }),
      }));
    },

    removeReceipt: (id) => {
      set(state => {
        const next = state.receipts.filter(r => r.id !== id);
        return {
          receipts: next,
          selectedReceiptId: state.selectedReceiptId === id ? (next[0]?.id || null) : state.selectedReceiptId,
        };
      });
    },

    reorderReceipts: (dragIndex, hoverIndex) => {
      set(state => {
        const list = [...state.receipts];
        const [removed] = list.splice(dragIndex, 1);
        list.splice(hoverIndex, 0, removed);
        return { receipts: list };
      });
    },

    retryReceipt: (id) => {
      queue.push(id);
      set(state => ({
        receipts: state.receipts.map(r =>
          r.id === id ? { ...r, status: 'queued', error: undefined, progress_message: 'Queued for retry...' } : r
        ),
      }));
      triggerQueue();
    },

    loadSampleReceipts: () => {
      set({
        receipts: SAMPLE_RECEIPTS,
        selectedReceiptId: SAMPLE_RECEIPTS[0].id,
      });
    },

    clearAllReceipts: () => {
      set({ receipts: [], selectedReceiptId: null });
    },

    applyCropAndEnhance: async (id, corners, rotation) => {
      const { receipts } = get();
      const receipt = receipts.find(r => r.id === id);
      if (!receipt) return;

      const fileSource = receipt.original_file || receipt.image_url;
      const prepResult = await preprocessReceiptImage(fileSource, {
        autoPerspective: true,
        customCorners: corners,
        rotation,
      });

      set(state => ({
        receipts: state.receipts.map(r =>
          r.id === id
            ? {
                ...r,
                image_url: prepResult.processedDataUrl,
                crop_corners: corners,
                rotation_angle: rotation,
                status: 'queued',
              }
            : r
        ),
        isCropModalOpen: false,
        cropTargetReceiptId: null,
      }));

      // Re-trigger extraction on rectified image
      queue.push(id);
      triggerQueue();
    },

    updateItem: (receiptId, itemId, partial) => {
      set(state => ({
        receipts: state.receipts.map(r => {
          if (r.id !== receiptId) return r;
          const nextItems = r.items.map(it => {
            if (it.id !== itemId) return it;
            const updated = { ...it, ...partial };
            // If qty or unit price updated, auto calculate line total
            if (partial.quantity !== undefined || partial.unit_price !== undefined) {
              updated.line_total = parseFloat((updated.quantity * updated.unit_price).toFixed(2));
            }
            return updated;
          });

          // Recalculate total if needed
          const newTotal = nextItems
            .filter(i => !i.is_ignored)
            .reduce((sum, i) => sum + i.line_total, 0) - (r.discount_total || 0);

          const updatedReceipt = {
            ...r,
            items: nextItems,
            total: Math.max(0, parseFloat(newTotal.toFixed(2))),
          };
          const validation = validateReceipt(updatedReceipt);
          return {
            ...updatedReceipt,
            validation_status: validation.status,
            validation_issues: validation.issues,
          };
        }),
      }));
    },

    addItem: (receiptId) => {
      set(state => ({
        receipts: state.receipts.map(r => {
          if (r.id !== receiptId) return r;
          const newItem: ReceiptItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: 'New Line Item',
            item_code: null,
            quantity: 1,
            unit: 'PC',
            unit_price: 0,
            line_total: 0,
            vat_code: 'G',
            discount: null,
            struck_through: false,
            confidence: 1.0,
          };
          const nextItems = [...r.items, newItem];
          return {
            ...r,
            items: nextItems,
          };
        }),
      }));
    },

    deleteItem: (receiptId, itemId) => {
      set(state => ({
        receipts: state.receipts.map(r => {
          if (r.id !== receiptId) return r;
          const nextItems = r.items.filter(it => it.id !== itemId);
          const updatedReceipt = { ...r, items: nextItems };
          const validation = validateReceipt(updatedReceipt);
          return {
            ...updatedReceipt,
            validation_status: validation.status,
            validation_issues: validation.issues,
          };
        }),
      }));
    },

    toggleIgnoreItem: (receiptId, itemId) => {
      set(state => ({
        receipts: state.receipts.map(r => {
          if (r.id !== receiptId) return r;
          const nextItems = r.items.map(it =>
            it.id === itemId ? { ...it, is_ignored: !it.is_ignored } : it
          );
          const updatedReceipt = { ...r, items: nextItems };
          const validation = validateReceipt(updatedReceipt);
          return {
            ...updatedReceipt,
            validation_status: validation.status,
            validation_issues: validation.issues,
          };
        }),
      }));
    },

    toggleCustomField: (fieldId) => {
      set(state => {
        const next = state.customFields.map(f =>
          f.id === fieldId ? { ...f, enabled: !f.enabled } : f
        );
        if (typeof window !== 'undefined') {
          localStorage.setItem('receiptlens_custom_fields', JSON.stringify(next));
        }
        return { customFields: next };
      });
    },

    addCustomField: (field) => {
      set(state => {
        const newField: CustomFieldDef = {
          id: `custom_${Date.now()}`,
          name: field.name.trim(),
          description: field.description?.trim(),
          type: field.type || 'string',
          isPreset: false,
          enabled: true,
        };
        const next = [...state.customFields, newField];
        if (typeof window !== 'undefined') {
          localStorage.setItem('receiptlens_custom_fields', JSON.stringify(next));
        }
        return { customFields: next };
      });
    },

    removeCustomField: (fieldId) => {
      set(state => {
        const next = state.customFields.filter(f => f.id !== fieldId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('receiptlens_custom_fields', JSON.stringify(next));
        }
        return { customFields: next };
      });
    },

    askAboutDocument: async (receiptId: string, question: string) => {
      const { receipts, isHighAccuracy } = get();
      const receipt = receipts.find(r => r.id === receiptId);
      if (!receipt) throw new Error('Receipt not found');

      const targetModel = isHighAccuracy ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: receipt.image_url,
          model: targetModel,
          askPrompt: question,
        }),
      });

      if (!resp.ok) {
        throw new Error('Failed to query document.');
      }

      const json = await resp.json();
      const customVal = json.data?.custom_fields?.[question] || json.data?.warnings?.[0] || 'Processed';

      // Attach to receipt's custom fields
      set(state => ({
        receipts: state.receipts.map(r =>
          r.id === receiptId
            ? {
                ...r,
                custom_fields: {
                  ...(r.custom_fields || {}),
                  [question]: customVal,
                },
              }
            : r
        ),
      }));

      return String(customVal);
    },
  };
});
