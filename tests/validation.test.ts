import { describe, it, expect } from 'vitest';
import { parseLocalizedNumber, validateReceipt } from '../src/utils/validation';
import { buildExportItemRows } from '../src/utils/export';
import { ExtractedReceiptSchema } from '../server/extractor';
import goldenReceipts from './golden.json';

describe('1. Localized Number Parsing', () => {
  it('parses standard US format with commas and dot decimal', () => {
    expect(parseLocalizedNumber('1,234.50')).toBe(1234.50);
    expect(parseLocalizedNumber('75.81')).toBe(75.81);
    expect(parseLocalizedNumber('399.00')).toBe(399.00);
  });

  it('parses European format with dot thousands and comma decimal', () => {
    expect(parseLocalizedNumber('1.234,50')).toBe(1234.50);
    expect(parseLocalizedNumber('75,81')).toBe(75.81);
    expect(parseLocalizedNumber('10.450,00')).toBe(10450.00);
  });

  it('handles null, undefined, empty, and numeric types safely', () => {
    expect(parseLocalizedNumber(null)).toBe(0);
    expect(parseLocalizedNumber(undefined)).toBe(0);
    expect(parseLocalizedNumber('')).toBe(0);
    expect(parseLocalizedNumber(120.45)).toBe(120.45);
  });
});

describe('2. Math Validation & Rewarded Discounts Logic (Requirement D)', () => {
  it('passes Check 1 with 0.02 tolerance on weighted item (0.190 KG × 399.00 = 75.81)', () => {
    const res = validateReceipt({
      total: 75.81,
      items: [
        {
          id: '1',
          name: 'Sweet potato',
          item_code: '730087',
          quantity: 0.190,
          unit: 'KG',
          unit_price: 399.00,
          line_total: 75.81,
          vat_code: 'G',
          discount: null,
          struck_through: false,
          confidence: 0.99,
        },
      ],
    });
    expect(res.status).toBe('valid');
    expect(res.issues.length).toBe(0);
  });

  it('verifies that Rewarded Discounts are INFORMATIONAL and NOT subtracted from printed total', () => {
    // Quick Mart Rct 182: 4 items sum to 208.00, printed total is 208.00, Rewarded Discount is 19.00
    const res = validateReceipt({
      total: 208.00,
      discount_total: 19.00,
      items: [
        {
          id: '1',
          name: 'Techpak Glass',
          item_code: '210423',
          quantity: 1,
          unit: 'PA',
          unit_price: 50.00,
          line_total: 50.00,
          vat_code: 'G',
          discount: 19.00,
          struck_through: false,
          confidence: 0.95,
        },
        {
          id: '2',
          name: 'Drinking Chocolate',
          item_code: '390056',
          quantity: 1,
          unit: 'PC',
          unit_price: 43.00,
          line_total: 43.00,
          vat_code: 'G',
          discount: null,
          struck_through: false,
          confidence: 0.95,
        },
        {
          id: '3',
          name: 'Nescafe',
          item_code: '408529',
          quantity: 2,
          unit: 'PC',
          unit_price: 25.00,
          line_total: 50.00,
          vat_code: 'G',
          discount: null,
          struck_through: false,
          confidence: 0.95,
        },
        {
          id: '4',
          name: 'Mahamri',
          item_code: '775777',
          quantity: 1,
          unit: 'PC',
          unit_price: 65.00,
          line_total: 65.00,
          vat_code: 'G',
          discount: null,
          struck_through: false,
          confidence: 0.95,
        },
      ],
    });
    expect(res.status).toBe('valid');
    expect(res.issues.some((i) => i.includes('mismatch'))).toBe(false);
  });

  it('flags fatal error when line math is off by > 0.02', () => {
    const res = validateReceipt({
      total: 60.00,
      items: [
        {
          id: '1',
          name: 'Bad calculation',
          item_code: '001',
          quantity: 2,
          unit: 'PC',
          unit_price: 20.00, // Should be 40.00
          line_total: 60.00,
          vat_code: 'G',
          discount: null,
          struck_through: false,
          confidence: 0.9,
        },
      ],
    });
    expect(res.status).toBe('error');
    expect(res.issues.some((i) => i.includes('Line total mismatch'))).toBe(true);
  });
});

describe('3. Strike-Through Items Accounting', () => {
  it('counts struck-through items as part of printed total (Rct 132: 11.00 struck + 56.00 = 67.00)', () => {
    const res = validateReceipt({
      total: 67.00,
      discount_total: 2.00,
      items: [
        {
          id: '1',
          name: 'FD-INSTANT GRANULES',
          item_code: '686163',
          quantity: 1,
          unit: 'SA',
          unit_price: 11.00,
          line_total: 11.00,
          vat_code: 'G',
          discount: 2.00,
          struck_through: true,
          confidence: 0.95,
        },
        {
          id: '2',
          name: 'FR-FRESH BUDGET BREAD',
          item_code: '0013.12.02',
          quantity: 1,
          unit: 'PC',
          unit_price: 56.00,
          line_total: 56.00,
          vat_code: 'A',
          discount: null,
          struck_through: false,
          confidence: 0.98,
        },
      ],
    });
    expect(res.status).toBe('warning');
    expect(res.issues.some((i) => i.includes('Struck-through items are included'))).toBe(true);
  });
});

describe('4. CSV and Export Privacy Handling', () => {
  it('strips sensitive payment hashes and transaction IDs unless user opts in', () => {
    const mockReceipt = {
      id: 'r1',
      image_name: 'test.jpg',
      image_url: '',
      status: 'done' as const,
      engine: 'gemini' as const,
      merchant: 'Quick Mart',
      branch: 'Pioneer',
      date: '2026-09-24',
      time: '12:23pm',
      receipt_number: '293',
      currency: 'KES',
      customer_name: 'Catherine',
      cashier: 'Serenoi',
      payment_method: 'M-PESA',
      items: [
        {
          id: 'it1',
          name: 'Sweet potato',
          item_code: '730087',
          quantity: 1,
          unit: 'PC',
          unit_price: 75.81,
          line_total: 75.81,
          vat_code: 'G',
          discount: null,
          struck_through: false,
          confidence: 0.99,
        },
      ],
      subtotal_pre_vat: 65.35,
      vat_total: 10.46,
      discount_total: null,
      total: 75.81,
      amount_paid: 76.00,
      change: 0.19,
      warnings: [],
      validation_status: 'valid' as const,
      validation_issues: [],
      custom_fields: {
        'M-Pesa Trn ID': 'UI05K7VLGG',
      },
    };

    // Default: sensitive info excluded
    const defaultExport = buildExportItemRows([mockReceipt], ['name', 'transaction_id'], false);
    expect(defaultExport.columns).not.toContain('transaction_id');

    // Opt-in: sensitive info included
    const optInExport = buildExportItemRows([mockReceipt], ['name', 'transaction_id'], true);
    expect(optInExport.columns).toContain('transaction_id');
    expect(optInExport.rows[0].transaction_id).toBe('UI05K7VLGG');
  });
});

describe('5. Gemini Response Zod Schema', () => {
  it('validates golden receipt schema successfully', () => {
    for (const g of goldenReceipts) {
      const parsed = ExtractedReceiptSchema.safeParse(g);
      expect(parsed.success).toBe(true);
    }
  });
});

describe('6. Golden Test Cases Math Checks', () => {
  it('all 7 golden receipts pass math validation without fatal error', () => {
    for (const g of goldenReceipts) {
      const res = validateReceipt(g as any);
      expect(res.status).not.toBe('error');
    }
  });
});
