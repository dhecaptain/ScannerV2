import { ReceiptData, ReceiptItem, ValidationStatus } from '../types/receipt';

export interface ValidationResult {
  status: ValidationStatus;
  issues: string[];
  itemIssues: Record<string, string[]>; // itemId -> issues
  lowConfidenceFields: Record<string, boolean>; // 'item_id.field' or 'field' -> true
}

/**
 * Parse strings with various decimal/thousand formats (e.g. "1,234.50" or "1.234,50")
 */
export function parseLocalizedNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  // If format is 1.234,50 (European comma decimal)
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      return parseFloat(str.replace(/,/g, '')) || 0;
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 3) {
      return parseFloat(parts[0] + '.' + parts[1]) || 0;
    }
    return parseFloat(str.replace(/,/g, '')) || 0;
  }

  return parseFloat(str) || 0;
}

/**
 * Validates receipt math according to Requirement D:
 * Check 1: quantity × unit_price ≈ line_total (tolerance 0.02)
 * Check 2: sum(line_totals) ≈ total (tolerance 0.02), counting struck-through items too (discounts are informational and NOT subtracted!)
 * Check 3: if VAT rows are present, pre-VAT + VAT ≈ total
 */
export function validateReceipt(receipt: Partial<ReceiptData>): ValidationResult {
  const issues: string[] = [];
  const itemIssues: Record<string, string[]> = {};
  const lowConfidenceFields: Record<string, boolean> = {};

  const items = receipt.items || [];
  let calculatedLineSum = 0;
  let hasStruckItems = false;

  items.forEach((item) => {
    const itemErrors: string[] = [];
    const expectedLineTotal = item.quantity * item.unit_price;
    const diff = Math.abs(expectedLineTotal - item.line_total);

    // Check 1: tolerance 0.02 (e.g. 0.190 * 399.00 = 75.81)
    if (item.quantity > 0 && item.unit_price > 0 && diff > 0.02) {
      const err = `Line total mismatch: ${item.quantity} × ${item.unit_price} = ${expectedLineTotal.toFixed(2)}, printed line total is ${item.line_total.toFixed(2)}`;
      itemErrors.push(err);
      issues.push(`Item "${item.name}": ${err}`);
    }

    if (item.confidence !== undefined && item.confidence < 0.8) {
      lowConfidenceFields[`${item.id}.confidence`] = true;
    }

    if (item.struck_through) {
      hasStruckItems = true;
    }

    if (!item.is_ignored) {
      // Struck-through items are still included in line total sum
      calculatedLineSum += item.line_total;
    }

    if (itemErrors.length > 0) {
      itemIssues[item.id] = itemErrors;
    }
  });

  const receiptTotal = receipt.total ?? 0;

  // Check 2: sum(line_totals) ≈ total (tolerance 0.02) - discounts are NOT subtracted
  if (receiptTotal > 0 && items.length > 0) {
    const diffTotal = Math.abs(calculatedLineSum - receiptTotal);

    if (diffTotal > 0.02) {
      issues.push(
        `Total mismatch: Sum of line items (${calculatedLineSum.toFixed(2)}) != printed total (${receiptTotal.toFixed(2)}) (diff: ${(calculatedLineSum - receiptTotal).toFixed(2)}).`
      );
    } else if (hasStruckItems) {
      issues.push('Notice: Struck-through items are included in the printed register total.');
    }
  }

  // Check 3: VAT consistency
  if (receipt.subtotal_pre_vat && receipt.vat_total && receiptTotal > 0) {
    const expectedSum = receipt.subtotal_pre_vat + receipt.vat_total;
    if (Math.abs(expectedSum - receiptTotal) > 0.05) {
      issues.push(
        `VAT check: Pre-VAT (${receipt.subtotal_pre_vat.toFixed(2)}) + VAT (${receipt.vat_total.toFixed(2)}) = ${expectedSum.toFixed(2)}, expected total ${receiptTotal.toFixed(2)}`
      );
    }
  }

  let status: ValidationStatus = 'valid';
  if (issues.length > 0) {
    const hasFatal = issues.some(
      (i) => i.includes('Line total mismatch') || i.includes('Total mismatch')
    );
    status = hasFatal ? 'error' : 'warning';
  }

  return {
    status,
    issues,
    itemIssues,
    lowConfidenceFields,
  };
}
