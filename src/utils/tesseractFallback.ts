import { createWorker } from 'tesseract.js';
import { ReceiptData, ReceiptItem } from '../types/receipt';
import { parseLocalizedNumber, validateReceipt } from './validation';

export async function runTesseractFallback(
  imageBlobOrUrl: Blob | string,
  onProgress?: (progress: number, status: string) => void
): Promise<ReceiptData> {
  onProgress?.(10, 'Initializing local OCR engine...');
  const worker = await createWorker('eng');

  try {
    onProgress?.(30, 'Recognizing text via Tesseract.js...');
    const ret = await worker.recognize(imageBlobOrUrl);
    const text = ret.data.text;
    onProgress?.(80, 'Parsing extracted text lines...');

    const receipt = parseReceiptTextRegex(text);
    onProgress?.(100, 'Complete (Basic mode)');
    return receipt;
  } finally {
    await worker.terminate();
  }
}

/**
 * Regex-based receipt parser tuned for POS thermal receipts
 */
export function parseReceiptTextRegex(rawText: string): ReceiptData {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let merchant = 'Unknown Merchant';
  let branch: string | null = null;
  let date: string | null = null;
  let time: string | null = null;
  let receiptNumber: string | null = null;
  let currency = 'KES';
  let customerName: string | null = null;
  let cashier: string | null = null;
  let paymentMethod: string | null = null;

  let total = 0;
  let subtotalPreVat: number | null = null;
  let vatTotal: number | null = null;
  let discountTotal: number | null = null;
  let amountPaid: number | null = null;
  let change: number | null = null;

  const items: ReceiptItem[] = [];
  const warnings: string[] = ['Extracted via client-side Tesseract.js OCR (Basic mode)'];

  // Look for merchant in top lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].toUpperCase();
    if (line.includes('QUICK MART') || line.includes('NAIVAS') || line.includes('CARREFOUR') || line.includes('SUPERMARKET') || line.includes('LTD') || line.includes('STORE')) {
      merchant = lines[i];
      if (i + 1 < lines.length && lines[i + 1].toUpperCase().includes('BRANCH')) {
        branch = lines[i + 1];
      }
      break;
    }
  }

  // Iterate lines for metadata & line items
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // Date & Time match
    // e.g. "Date: 12:23pm Thu 24 September 2026" or "24/09/2026"
    if (upper.includes('DATE:') || upper.includes('DATE :')) {
      const dateMatch = line.match(/\d{1,2}[:.]\d{2}(?:am|pm)?\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
      if (dateMatch) {
        date = dateMatch[1];
      }
      const timeMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeMatch) {
        time = timeMatch[1];
      }
    }

    // Receipt number / Rct
    if (upper.includes('RCT:') || upper.includes('RCT :') || upper.includes('RECEIPT')) {
      const rctMatch = line.match(/(?:RCT[: ]+|RECEIPT\s*#?[: ]+)([A-Z0-9-]+)/i);
      if (rctMatch) {
        receiptNumber = rctMatch[1];
      }
    }

    // Customer
    if (upper.includes('CUSTOMER') || upper.startsWith('NAME :') || upper.startsWith('NAME:')) {
      const custMatch = line.match(/(?:CUSTOMER|NAME)\s*[: ]+([A-Za-z\s]+)/i);
      if (custMatch) {
        customerName = custMatch[1].trim();
      }
    }

    // Cashier
    if (upper.includes('CASHIER')) {
      const cashMatch = line.match(/CASHIER\s*[: ]+([A-Za-z\s]+)/i);
      if (cashMatch) {
        cashier = cashMatch[1].trim();
      }
    }

    // M-Pesa / Cash / Payment
    if (upper.includes('MPESA') || upper.includes('M-PESA')) {
      paymentMethod = 'M-PESA';
    } else if (upper.includes('CASH PAID') && !paymentMethod) {
      paymentMethod = 'CASH';
    }

    // Total line
    if (/^TOTAL\s*[: ]+/i.test(line) || /^TOTAL\s*$/i.test(line)) {
      const numMatch = line.match(/([\d,]+(?:\.\d{2})?)$/);
      if (numMatch) {
        total = parseLocalizedNumber(numMatch[1]);
      } else if (i + 1 < lines.length) {
        const nextNum = lines[i + 1].match(/([\d,]+(?:\.\d{2})?)/);
        if (nextNum) total = parseLocalizedNumber(nextNum[1]);
      }
    }

    // Change
    if (upper.includes('CHANGE')) {
      const chMatch = line.match(/([\d,]+(?:\.\d{2})?)$/);
      if (chMatch) change = parseLocalizedNumber(chMatch[1]);
    }

    // Cash Paid / MPESA PAY
    if (upper.includes('MPESA PAY') || upper.includes('CASH PAID')) {
      const pdMatch = line.match(/([\d,]+(?:\.\d{2})?)$/);
      if (pdMatch) amountPaid = parseLocalizedNumber(pdMatch[1]);
    }

    // VAT
    if (upper.includes('PRE-VAT') || upper.includes('PRE VAT')) {
      const nums = line.match(/([\d,]+(?:\.\d{2})?)/g);
      if (nums && nums.length >= 1) subtotalPreVat = parseLocalizedNumber(nums[0]);
    }
    if (upper.includes('TOTALS') && upper.includes('VAT')) {
      const nums = line.match(/([\d,]+(?:\.\d{2})?)/g);
      if (nums && nums.length >= 2) vatTotal = parseLocalizedNumber(nums[1]);
    }

    // Discount
    if (upper.includes('TOTAL DISCOUNT') || upper.includes('REWARDED DISCOUNT')) {
      const discMatch = line.match(/([\d,]+(?:\.\d{2})?)$/);
      if (discMatch) discountTotal = parseLocalizedNumber(discMatch[1]);
    }

    // Line items detection
    // e.g.: "730087   0.190 KG   399.00   75.81"
    // or: "2.000 PC 35.00 70.00"
    const lineItemPattern = /(?:(\d{4,8})\s+)?(\d+(?:\.\d{1,3})?)\s*(PC|KG|PA|SA|PK|GM|LT|LTR|UNITS)?\s+([\d,]+(?:\.\d{2})?)\s+([\d,]+(?:\.\d{2})?)/i;
    const match = line.match(lineItemPattern);

    if (match) {
      const code = match[1] || null;
      const qty = parseFloat(match[2]) || 1;
      const unit = match[3] || 'PC';
      const unitPrice = parseLocalizedNumber(match[4]);
      const lineTotal = parseLocalizedNumber(match[5]);

      // Previous line is typically item description
      let itemName = `Item ${items.length + 1}`;
      if (i > 0 && !lines[i - 1].toUpperCase().includes('ITEM') && !lines[i - 1].toUpperCase().includes('QTY')) {
        itemName = lines[i - 1];
      }

      items.push({
        id: `item_${Date.now()}_${items.length}`,
        name: itemName,
        item_code: code,
        quantity: qty,
        unit,
        unit_price: unitPrice,
        line_total: lineTotal,
        vat_code: 'G',
        discount: null,
        struck_through: false,
        confidence: 0.75, // Tesseract base confidence
      });
    }
  }

  // If no total found from regex, sum items
  if (total === 0 && items.length > 0) {
    total = items.reduce((acc, it) => acc + it.line_total, 0) - (discountTotal || 0);
  }

  const receiptData: ReceiptData = {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    image_name: 'Document',
    image_url: '',
    status: 'needs_review',
    engine: 'tesseract',
    model: 'Tesseract.js OCR v5',
    merchant: merchant || 'Unknown Merchant',
    branch,
    date,
    time,
    receipt_number: receiptNumber,
    currency,
    customer_name: customerName,
    cashier,
    payment_method: paymentMethod,
    items,
    subtotal_pre_vat: subtotalPreVat,
    vat_total: vatTotal,
    discount_total: discountTotal,
    total,
    amount_paid: amountPaid,
    change,
    warnings,
    validation_status: 'warning',
    validation_issues: [],
    custom_fields: {},
  };

  const validation = validateReceipt(receiptData);
  receiptData.validation_status = validation.status;
  receiptData.validation_issues = validation.issues;

  return receiptData;
}
