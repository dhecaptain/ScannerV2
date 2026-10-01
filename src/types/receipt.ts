export interface ReceiptItem {
  id: string;
  name: string;
  item_code: string | null;
  quantity: number;
  unit: string | null; // e.g. PC, KG, PA, SA, GM, etc.
  unit_price: number;
  line_total: number;
  vat_code: string | null;
  discount: number | null;
  struck_through: boolean;
  confidence: number; // 0 to 1
  is_ignored?: boolean;
  notes?: string;
  custom_fields?: Record<string, string | number | boolean | null>;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type ProcessingStatus =
  | 'queued'
  | 'preprocessing'
  | 'extracting'
  | 'done'
  | 'needs_review'
  | 'failed';

export type ValidationStatus = 'valid' | 'warning' | 'error';

export interface ReceiptData {
  id: string;
  image_name: string;
  image_url: string; // Object URL or data URL
  thumbnail_url?: string;
  status: ProcessingStatus;
  progress_message?: string;
  error?: string;
  engine: 'gemini' | 'tesseract';
  model?: string;
  
  // Header details
  merchant: string;
  branch: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm or 12:23pm
  receipt_number: string | null;
  currency: string; // e.g. KES, USD, EUR, etc.
  customer_name: string | null;
  cashier: string | null;
  payment_method: string | null;

  // Items
  items: ReceiptItem[];

  // Totals & taxes
  subtotal_pre_vat: number | null;
  vat_total: number | null;
  discount_total: number | null;
  total: number;
  amount_paid: number | null;
  change: number | null;

  // Diagnostics & Warnings
  warnings: string[];
  validation_status: ValidationStatus;
  validation_issues: string[];

  // Custom user fields
  custom_fields?: Record<string, string | number | boolean | null>;

  // Preprocessing metadata
  original_file?: File;
  quality_check?: {
    is_blurry: boolean;
    is_dark: boolean;
    is_small: boolean;
    blur_score?: number;
    brightness_score?: number;
    width?: number;
    height?: number;
    message?: string;
  };
  crop_corners?: [Point, Point, Point, Point]; // top-left, top-right, bottom-right, bottom-left
  rotation_angle?: number;
}

export interface Point {
  x: number;
  y: number;
}

export type DocumentType = 'receipt' | 'invoice' | 'price_list' | 'table' | 'auto';

export interface CustomFieldDef {
  id: string;
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean';
  isPreset?: boolean;
  enabled: boolean;
}

export interface AskQuestionResult {
  question: string;
  answer: string;
  suggested_field_name: string;
  structured_data?: any;
}
