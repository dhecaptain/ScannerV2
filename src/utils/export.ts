import ExcelJS from 'exceljs';
import { ReceiptData } from '../types/receipt';

export interface ExportColumn {
  key: string;
  label: string;
  defaultIncluded: boolean;
  isSensitive?: boolean; // Payment hashes, transaction IDs, phone numbers
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
  { key: 'discount', label: 'Rewarded Discount', defaultIncluded: true },
  { key: 'vat_code', label: 'VAT Code', defaultIncluded: true },
  { key: 'struck_through', label: 'Struck Through', defaultIncluded: false },
  { key: 'currency', label: 'Currency', defaultIncluded: true },
  { key: 'cashier', label: 'Cashier', defaultIncluded: false },
  { key: 'customer_name', label: 'Customer', defaultIncluded: false },
  { key: 'payment_method', label: 'Payment Method', defaultIncluded: false },
  { key: 'transaction_id', label: 'M-Pesa / Trn ID', defaultIncluded: false, isSensitive: true },
];

/**
 * Builds item rows across one or multiple receipts
 */
export function buildExportItemRows(
  receipts: ReceiptData[],
  columns: string[] = ALL_ITEM_COLUMNS.filter(c => c.defaultIncluded).map(c => c.key),
  includeSensitivePaymentInfo = false
) {
  const rows: Record<string, any>[] = [];

  // Filter out sensitive fields unless explicitly opted in
  const safeColumns = columns.filter((col) => {
    const colDef = ALL_ITEM_COLUMNS.find((c) => c.key === col);
    if (colDef?.isSensitive && !includeSensitivePaymentInfo) return false;
    return true;
  });

  receipts.forEach((r) => {
    r.items.forEach((item) => {
      if (item.is_ignored) return;

      const row: Record<string, any> = {};
      safeColumns.forEach((col) => {
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
          case 'payment_method':
            row[col] = r.payment_method || '';
            break;
          case 'transaction_id':
            row[col] = includeSensitivePaymentInfo ? (r.custom_fields?.['M-Pesa Trn ID'] || '') : '';
            break;
          default:
            row[col] = item.custom_fields?.[col] ?? r.custom_fields?.[col] ?? '';
        }
      });
      rows.push(row);
    });
  });

  return { rows, columns: safeColumns };
}

/**
 * Requirement E: Generates professional styled Excel workbook using exceljs
 * - Bold frozen header row
 * - Auto-fit column widths
 * - Currency formatting (#,##0.00)
 * - SUM formula in totals row
 * - Sheet 1 "Items", Sheet 2 "Receipts"
 */
export async function exportToExcel(
  receipts: ReceiptData[],
  selectedColumnKeys: string[] = ALL_ITEM_COLUMNS.filter(c => c.defaultIncluded).map(c => c.key),
  filename = 'receiptlens_export.xlsx',
  includeSensitive = false
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ReceiptLens';
  wb.created = new Date();

  const { rows, columns } = buildExportItemRows(receipts, selectedColumnKeys, includeSensitive);

  // 1. SHEET 1: ITEMS
  const itemsSheet = wb.addWorksheet('Items', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  // Headers
  const itemHeaders = columns.map((colKey) => {
    const found = ALL_ITEM_COLUMNS.find((c) => c.key === colKey);
    return {
      header: found ? found.label : colKey,
      key: colKey,
      width: 15,
    };
  });
  itemsSheet.columns = itemHeaders;

  // Header row styling
  const headerRow = itemsSheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' }, // Emerald-600
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Add item rows
  rows.forEach((r) => {
    itemsSheet.addRow(r);
  });

  // Format currency and number columns
  const numericKeys = ['quantity', 'unit_price', 'line_total', 'discount'];
  columns.forEach((key, colIndex) => {
    const colNumber = colIndex + 1;
    if (numericKeys.includes(key)) {
      itemsSheet.getColumn(colNumber).numFmt = key === 'quantity' ? '#,##0.000' : '#,##0.00';
      itemsSheet.getColumn(colNumber).alignment = { horizontal: 'right' };
    }
  });

  // Add SUM Formula row at the bottom
  if (rows.length > 0) {
    const totalRowIndex = rows.length + 2;
    const totalsRow = itemsSheet.getRow(totalRowIndex);
    totalsRow.font = { bold: true };

    const lineTotalColIndex = columns.indexOf('line_total') + 1;
    if (lineTotalColIndex > 0) {
      const colLetter = itemsSheet.getColumn(lineTotalColIndex).letter;
      const cell = totalsRow.getCell(lineTotalColIndex);
      cell.value = {
        formula: `SUM(${colLetter}2:${colLetter}${totalRowIndex - 1})`,
      };
      cell.numFmt = '#,##0.00';

      const prevCell = totalsRow.getCell(lineTotalColIndex - 1);
      prevCell.value = 'TOTAL:';
      prevCell.alignment = { horizontal: 'right' };
    }
  }

  // Auto-fit column widths
  itemsSheet.columns.forEach((col) => {
    let maxLen = col.header ? String(col.header).length : 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const valStr = cell.value ? String(cell.value) : '';
      if (valStr.length > maxLen) maxLen = valStr.length;
    });
    col.width = Math.min(45, Math.max(12, maxLen + 3));
  });

  // 2. SHEET 2: RECEIPTS SUMMARY
  const receiptsSheet = wb.addWorksheet('Receipts', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  const receiptHeaders = [
    { header: 'Receipt #', key: 'receipt_number', width: 14 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Merchant', key: 'merchant', width: 25 },
    { header: 'Branch', key: 'branch', width: 22 },
    { header: 'Customer', key: 'customer', width: 18 },
    { header: 'Cashier', key: 'cashier', width: 18 },
    { header: 'Payment Method', key: 'payment_method', width: 16 },
    { header: 'Items Count', key: 'items_count', width: 12 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Pre-VAT Subtotal', key: 'subtotal_pre_vat', width: 16 },
    { header: 'VAT Total', key: 'vat_total', width: 14 },
    { header: 'Grand Total', key: 'total', width: 16 },
    { header: 'Validation Status', key: 'status', width: 18 },
  ];
  receiptsSheet.columns = receiptHeaders;

  const rHeaderRow = receiptsSheet.getRow(1);
  rHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate-900
  };
  rHeaderRow.height = 24;

  receipts.forEach((r) => {
    receiptsSheet.addRow({
      receipt_number: r.receipt_number || 'N/A',
      date: r.date || 'N/A',
      merchant: r.merchant,
      branch: r.branch || '',
      customer: r.customer_name || '',
      cashier: r.cashier || '',
      payment_method: r.payment_method || '',
      items_count: r.items.filter((i) => !i.is_ignored).length,
      currency: r.currency || 'KES',
      subtotal_pre_vat: r.subtotal_pre_vat ?? '',
      vat_total: r.vat_total ?? '',
      total: r.total,
      status: r.validation_status.toUpperCase(),
    });
  });

  ['subtotal_pre_vat', 'vat_total', 'total'].forEach((key) => {
    const colIndex = receiptHeaders.findIndex((h) => h.key === key) + 1;
    if (colIndex > 0) {
      receiptsSheet.getColumn(colIndex).numFmt = '#,##0.00';
      receiptsSheet.getColumn(colIndex).alignment = { horizontal: 'right' };
    }
  });

  // Write buffer and trigger browser download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerFileDownload(blob, filename);
}

/**
 * Requirement E: Generates UTF-8 CSV with Byte Order Mark (\uFEFF)
 */
export function exportToCSV(
  receipts: ReceiptData[],
  selectedColumnKeys: string[] = ALL_ITEM_COLUMNS.filter(c => c.defaultIncluded).map(c => c.key),
  filename = 'receiptlens_export.csv',
  includeSensitive = false
) {
  const { rows, columns } = buildExportItemRows(receipts, selectedColumnKeys, includeSensitive);
  if (rows.length === 0) return;

  const headers = columns.map((k) => {
    const found = ALL_ITEM_COLUMNS.find((c) => c.key === k);
    return found ? found.label : k;
  });

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCSVField).join(','));

  rows.forEach((row) => {
    const line = columns.map((col) => escapeCSVField(row[col])).join(',');
    csvLines.push(line);
  });

  // UTF-8 BOM (\uFEFF)
  const bom = '\uFEFF';
  const csvBlob = new Blob([bom + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerFileDownload(csvBlob, filename);
}

/**
 * Generates TSV (Tab-Separated Values) and copies directly to clipboard
 */
export async function copyToClipboardTSV(
  receipts: ReceiptData[],
  selectedColumnKeys: string[] = ALL_ITEM_COLUMNS.filter(c => c.defaultIncluded).map(c => c.key),
  includeSensitive = false
): Promise<void> {
  const { rows, columns } = buildExportItemRows(receipts, selectedColumnKeys, includeSensitive);
  const headers = columns.map((k) => {
    const found = ALL_ITEM_COLUMNS.find((c) => c.key === k);
    return found ? found.label : k;
  });

  const lines: string[] = [];
  lines.push(headers.join('\t'));

  rows.forEach((row) => {
    const line = columns
      .map((col) => {
        const val = row[col];
        return val === null || val === undefined ? '' : String(val).replace(/\t|\r|\n/g, ' ');
      })
      .join('\t');
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

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
