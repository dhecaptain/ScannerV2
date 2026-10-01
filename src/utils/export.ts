import * as XLSX from 'xlsx';
import { ReceiptData } from '../types/receipt';

export interface ExportColumn {
  key: string;
  label: string;
  defaultIncluded: boolean;
}

export const ALL_ITEM_COLUMNS: ExportColumn[] = [
  { key: 'receipt_number', label: 'Receipt #', defaultIncluded: true },
  { key: 'date', label: 'Date', defaultIncluded: true },
  { key: 'merchant', label: 'Merchant', defaultIncluded: true },
  { key: 'name', label: 'Item Description', defaultIncluded: true },
  { key: 'item_code', label: 'Item Code / SKU', defaultIncluded: true },
  { key: 'quantity', label: 'Qty', defaultIncluded: true },
  { key: 'unit', label: 'Unit', defaultIncluded: true },
  { key: 'unit_price', label: 'Unit Price', defaultIncluded: true },
  { key: 'line_total', label: 'Line Total', defaultIncluded: true },
  { key: 'discount', label: 'Discount', defaultIncluded: true },
  { key: 'vat_code', label: 'VAT Code', defaultIncluded: true },
  { key: 'struck_through', label: 'Struck Through', defaultIncluded: false },
  { key: 'currency', label: 'Currency', defaultIncluded: true },
  { key: 'cashier', label: 'Cashier', defaultIncluded: false },
  { key: 'customer_name', label: 'Customer', defaultIncluded: false },
];

/**
 * Builds item rows across one or multiple receipts
 */
export function buildExportItemRows(receipts: ReceiptData[], columns: string[] = ALL_ITEM_COLUMNS.map(c => c.key)) {
  const rows: Record<string, any>[] = [];

  receipts.forEach((r) => {
    r.items.forEach((item) => {
      if (item.is_ignored) return;

      const row: Record<string, any> = {};
      columns.forEach((col) => {
        switch (col) {
          case 'receipt_number':
            row[col] = r.receipt_number || 'N/A';
            break;
          case 'date':
            row[col] = r.date || 'N/A';
            break;
          case 'merchant':
            row[col] = r.merchant || 'Unknown';
            break;
          case 'name':
            row[col] = item.name;
            break;
          case 'item_code':
            row[col] = item.item_code || '';
            break;
          case 'quantity':
            row[col] = item.quantity;
            break;
          case 'unit':
            row[col] = item.unit || 'PC';
            break;
          case 'unit_price':
            row[col] = item.unit_price;
            break;
          case 'line_total':
            row[col] = item.line_total;
            break;
          case 'discount':
            row[col] = item.discount || 0;
            break;
          case 'vat_code':
            row[col] = item.vat_code || '';
            break;
          case 'struck_through':
            row[col] = item.struck_through ? 'YES' : 'NO';
            break;
          case 'currency':
            row[col] = r.currency || 'KES';
            break;
          case 'cashier':
            row[col] = r.cashier || '';
            break;
          case 'customer_name':
            row[col] = r.customer_name || '';
            break;
          default:
            // Custom fields
            row[col] = item.custom_fields?.[col] ?? r.custom_fields?.[col] ?? '';
        }
      });
      rows.push(row);
    });
  });

  return rows;
}

/**
 * Generates an Excel workbook with Sheet 1: Items and Sheet 2: Receipts
 */
export function exportToExcel(
  receipts: ReceiptData[],
  selectedColumnKeys: string[] = ALL_ITEM_COLUMNS.map(c => c.key),
  filename = 'receiptlens_export.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Items
  const itemRows = buildExportItemRows(receipts, selectedColumnKeys);
  const itemsWs = XLSX.utils.json_to_sheet(itemRows);

  // Add SUM Formula row to Line Total column if items exist
  if (itemRows.length > 0) {
    const totalRowIndex = itemRows.length + 2; // +1 for 0-index, +1 for header
    const totalColIndex = selectedColumnKeys.indexOf('line_total');
    if (totalColIndex !== -1) {
      const colLetter = XLSX.utils.encode_col(totalColIndex);
      const sumFormula = `SUM(${colLetter}2:${colLetter}${totalRowIndex - 1})`;
      XLSX.utils.sheet_add_aoa(itemsWs, [['TOTAL:', { f: sumFormula }]], {
        origin: { r: totalRowIndex - 1, c: Math.max(0, totalColIndex - 1) },
      });
    }
  }

  // Auto-fit column widths
  const itemColWidths = selectedColumnKeys.map((k) => {
    const maxLen = Math.max(
      k.length,
      ...itemRows.map((r) => String(r[k] || '').length)
    );
    return { wch: Math.min(45, Math.max(10, maxLen + 3)) };
  });
  itemsWs['!cols'] = itemColWidths;

  XLSX.utils.book_append_sheet(wb, itemsWs, 'Items');

  // 2. Sheet 2: Receipts Summary
  const receiptSummaryRows = receipts.map((r) => ({
    'Receipt #': r.receipt_number || 'N/A',
    'Date': r.date || 'N/A',
    'Merchant': r.merchant,
    'Branch': r.branch || '',
    'Customer': r.customer_name || '',
    'Cashier': r.cashier || '',
    'Payment Method': r.payment_method || '',
    'Items Count': r.items.filter(i => !i.is_ignored).length,
    'Currency': r.currency,
    'Pre-VAT Subtotal': r.subtotal_pre_vat ?? '',
    'VAT Total': r.vat_total ?? '',
    'Discount Total': r.discount_total ?? 0,
    'Grand Total': r.total,
    'Validation Status': r.validation_status.toUpperCase(),
    'Extraction Engine': r.engine === 'gemini' ? 'Gemini AI' : 'Tesseract (Basic)',
  }));

  const receiptsWs = XLSX.utils.json_to_sheet(receiptSummaryRows);

  // Auto-fit receipts sheet
  receiptsWs['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 25 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, receiptsWs, 'Receipts');

  // Write and download
  XLSX.writeFile(wb, filename);
}

/**
 * Generates UTF-8 CSV with Byte Order Mark (\uFEFF) for Excel compatibility
 */
export function exportToCSV(
  receipts: ReceiptData[],
  selectedColumnKeys: string[] = ALL_ITEM_COLUMNS.map(c => c.key),
  filename = 'receiptlens_export.csv'
) {
  const rows = buildExportItemRows(receipts, selectedColumnKeys);
  if (rows.length === 0) return;

  const headers = selectedColumnKeys.map((k) => {
    const found = ALL_ITEM_COLUMNS.find((c) => c.key === k);
    return found ? found.label : k;
  });

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCSVField).join(','));

  rows.forEach((row) => {
    const line = selectedColumnKeys.map((col) => escapeCSVField(row[col])).join(',');
    csvLines.push(line);
  });

  // UTF-8 BOM (\uFEFF)
  const bom = '\uFEFF';
  const csvBlob = new Blob([bom + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(csvBlob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates TSV (Tab-Separated Values) and copies directly to clipboard
 */
export async function copyToClipboardTSV(
  receipts: ReceiptData[],
  selectedColumnKeys: string[] = ALL_ITEM_COLUMNS.map(c => c.key)
): Promise<void> {
  const rows = buildExportItemRows(receipts, selectedColumnKeys);
  const headers = selectedColumnKeys.map((k) => {
    const found = ALL_ITEM_COLUMNS.find((c) => c.key === k);
    return found ? found.label : k;
  });

  const lines: string[] = [];
  lines.push(headers.join('\t'));

  rows.forEach((row) => {
    const line = selectedColumnKeys.map((col) => {
      const val = row[col];
      return val === null || val === undefined ? '' : String(val).replace(/\t|\r|\n/g, ' ');
    }).join('\t');
    lines.push(line);
  });

  const tsvText = lines.join('\n');
  await navigator.clipboard.writeText(tsvText);
}

function escapeCSVField(field: any): string {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}
