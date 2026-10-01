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

  // If format is 1.234,50 (comma decimal)
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // European format 1.234,50 -> 1234.50
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // Standard format 1,234.50 -> 1234.50
      return parseFloat(str.replace(/,/g, '')) || 0;
    }
  } else if (str.includes(',')) {
    // Check if comma is used as decimal: e.g. "75,81" vs "1,000"
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 3) {
      return parseFloat(parts[0] + '.' + parts[1]) || 0;
    }
    return parseFloat(str.replace(/,/g, '')) || 0;
  }

  return parseFloat(str) || 0;
}

/**
 * Validates receipt math:
 * 1. item.quantity * item.unit_price ≈ item.line_total (tolerance 0.02)
 * 2. sum(line_totals) - (discount_total or item_discounts) ≈ total
 * 3. checks whether struck_through items are included or excluded from total
 * 4. VAT math consistency
 */
export function validateReceipt(receipt: Partial<ReceiptData>): ValidationResult {
  const issues: string[] = [];
  const itemIssues: Record<string, string[]> = {};
  const lowConfidenceFields: Record<string, boolean> = {};

  const items = receipt.items || [];
  const activeItems = items.filter(it => !it.is_ignored);

  let calculatedItemsTotal = 0;
  let struckThroughTotal = 0;
  let activeItemsWithoutStruckTotal = 0;
  let calculatedDiscounts = 0;

  items.forEach((item) => {
    const itemErrors: string[] = [];
    const expectedLineTotal = item.quantity * item.unit_price;
    const diff = Math.abs(expectedLineTotal - item.line_total);

    // Tolerance of 0.02 to handle standard rounding
    if (item.quantity > 0 && item.unit_price > 0 && diff > 0.02) {
      const err = `Line total mismatch: ${item.quantity} × ${item.unit_price} = ${expectedLineTotal.toFixed(2)}, but printed is ${item.line_total.toFixed(2)}`;
      itemErrors.push(err);
      issues.push(`Item "${item.name}": ${err}`);
    }

    if (item.confidence !== undefined && item.confidence < 0.8) {
      lowConfidenceFields[`${item.id}.confidence`] = true;
    }

    if (item.discount) {
      calculatedDiscounts += item.discount;
    }

    if (!item.is_ignored) {
      calculatedItemsTotal += item.line_total;
      if (item.struck_through) {
        struckThroughTotal += item.line_total;
      } else {
        activeItemsWithoutStruckTotal += item.line_total;
      }
    }

    if (itemErrors.length > 0) {
      itemIssues[item.id] = itemErrors;
    }
  });

  const receiptTotal = receipt.total ?? 0;
  const discountTotal = receipt.discount_total || calculatedDiscounts || 0;
  const expectedTotalWithAll = calculatedItemsTotal - discountTotal;
  const expectedTotalWithoutStruck = activeItemsWithoutStruckTotal - discountTotal;

  // Total check
  if (receiptTotal > 0 && activeItems.length > 0) {
    const diffWithAll = Math.abs(expectedTotalWithAll - receiptTotal);
    const diffWithoutStruck = Math.abs(expectedTotalWithoutStruck - receiptTotal);

    if (diffWithAll <= 0.05) {
      // Matches with all items included
      if (struckThroughTotal > 0) {
        issues.push(`Note: Struck-through item(s) (${struckThroughTotal.toFixed(2)}) ARE included in the printed total (${receiptTotal.toFixed(2)}).`);
      }
    } else if (diffWithoutStruck <= 0.05 && struckThroughTotal > 0) {
      // Matches without struck-through items
      issues.push(`Note: Struck-through item(s) (${struckThroughTotal.toFixed(2)}) ARE EXCLUDED from the printed total (${receiptTotal.toFixed(2)}).`);
    } else if (diffWithAll > 0.05) {
      issues.push(
        `Total mismatch: Sum of active lines (${calculatedItemsTotal.toFixed(2)}) ${discountTotal > 0 ? `- discounts (${discountTotal.toFixed(2)})` : ''} = ${expectedTotalWithAll.toFixed(2)}, but printed total is ${receiptTotal.toFixed(2)} (diff: ${(expectedTotalWithAll - receiptTotal).toFixed(2)})`
      );
    }
  }

  // Pre-VAT + VAT check if both present
  if (receipt.subtotal_pre_vat && receipt.vat_total && receiptTotal > 0) {
    const expectedSum = receipt.subtotal_pre_vat + receipt.vat_total;
    if (Math.abs(expectedSum - receiptTotal) > 0.05) {
      issues.push(`VAT sum mismatch: Pre-VAT (${receipt.subtotal_pre_vat.toFixed(2)}) + VAT (${receipt.vat_total.toFixed(2)}) = ${expectedSum.toFixed(2)}, expected ${receiptTotal.toFixed(2)}`);
    }
  }

  let status: ValidationStatus = 'valid';
  if (issues.length > 0) {
    // If it's just notes about strike-throughs or minor difference, set warning
    const hasFatal = issues.some(i => i.startsWith('Line total mismatch') || i.startsWith('Total mismatch'));
    status = hasFatal ? 'error' : 'warning';
  }

  return {
    status,
    issues,
    itemIssues,
    lowConfidenceFields,
  };
}
