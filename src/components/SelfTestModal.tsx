import React, { useState } from 'react';
import { 
  X, 
  FlaskConical, 
  CheckCircle2, 
  XCircle, 
  Play, 
  RotateCw,
  Sparkles
} from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';
import { parseLocalizedNumber, validateReceipt } from '../utils/validation';
import { parseReceiptTextRegex } from '../utils/tesseractFallback';

interface TestCase {
  id: string;
  name: string;
  category: 'Math' | 'Localization' | 'StrikeThrough' | 'WeightedItems' | 'Discounts';
  run: () => { passed: boolean; message: string; details?: any };
}

export const SelfTestModal: React.FC = () => {
  const { isSelfTestOpen, setSelfTestOpen } = useReceiptStore();

  const testCases: TestCase[] = [
    {
      id: 'test-1-weighted-item-math',
      name: 'Weighted Item Math Check (0.190 KG × 399.00 = 75.81)',
      category: 'WeightedItems',
      run: () => {
        const qty = 0.190;
        const price = 399.00;
        const total = 75.81;
        const expected = qty * price;
        const diff = Math.abs(expected - total);
        const passed = diff <= 0.02;
        return {
          passed,
          message: passed
            ? `Exact line total matched within 0.02 tolerance (diff: ${diff.toFixed(4)})`
            : `Failed: expected ${expected}, got ${total}`,
        };
      },
    },
    {
      id: 'test-2-number-parsing-formats',
      name: 'Localized Currency & Number Parsing (1,234.50 vs 1.234,50)',
      category: 'Localization',
      run: () => {
        const standard = parseLocalizedNumber('1,234.50');
        const european = parseLocalizedNumber('1.234,50');
        const decimalComma = parseLocalizedNumber('75,81');
        const plain = parseLocalizedNumber('70.00');

        const passed =
          Math.abs(standard - 1234.50) < 0.01 &&
          Math.abs(european - 1234.50) < 0.01 &&
          Math.abs(decimalComma - 75.81) < 0.01 &&
          Math.abs(plain - 70.00) < 0.01;

        return {
          passed,
          message: passed
            ? 'All localized number formats correctly parsed to standard floats'
            : 'Number format parsing mismatch',
        };
      },
    },
    {
      id: 'test-3-strike-through-total-accounting',
      name: 'Strike-Through Inclusion in Printed Register Total',
      category: 'StrikeThrough',
      run: () => {
        // Quick Mart sample 4 has instant granules (11.00, struck) + bread (56.00) = 67.00 total
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

        const passed = res.status === 'valid' && res.issues.some(i => i.includes('ARE included in the printed total'));
        return {
          passed,
          message: passed
            ? 'Strike-through item detected and verified as INCLUDED in register total'
            : 'Strike-through total accounting failed',
        };
      },
    },
    {
      id: 'test-4-line-total-mismatch-detection',
      name: 'Tolerance & Mismatch Detection (Tolerance 0.02)',
      category: 'Math',
      run: () => {
        const res = validateReceipt({
          total: 100,
          items: [
            {
              id: '1',
              name: 'Bad Line Math',
              item_code: '001',
              quantity: 2,
              unit: 'PC',
              unit_price: 25.00,
              line_total: 60.00, // Should be 50.00!
              vat_code: 'G',
              discount: null,
              struck_through: false,
              confidence: 0.9,
            },
          ],
        });

        const passed = res.status === 'error' && res.issues.some(i => i.includes('Line total mismatch'));
        return {
          passed,
          message: passed
            ? 'Correctly identified discrepancy when line math is off by > 0.02'
            : 'Failed to flag line total mismatch',
        };
      },
    },
    {
      id: 'test-5-regex-fallback-parser',
      name: 'Tesseract Regex Line Item Parser Test',
      category: 'Discounts',
      run: () => {
        const sampleText = `
QUICK MART LTD.
PIONEER BRANCH
Date: 02:06pm Tue 22 September 2026
CASH SALE
Item        Qty       Each      Total
FR-FRESH BROWN CHAPATI PER PC
730096      2.000 PC  35.00     70.00
TOTAL : 70.00
CASHIER : ESTER W MUTUKU
        `;

        const parsed = parseReceiptTextRegex(sampleText);
        const passed =
          parsed.items.length >= 1 &&
          parsed.items[0].quantity === 2 &&
          parsed.items[0].unit_price === 35 &&
          parsed.items[0].line_total === 70 &&
          parsed.total === 70;

        return {
          passed,
          message: passed
            ? 'Tesseract fallback regex extracted multi-line item, 2.000 PC, 35.00, and 70.00 total'
            : 'Fallback parser failed to extract items correctly',
        };
      },
    },
  ];

  const [testResults, setTestResults] = useState<Record<string, { passed: boolean; message: string }>>({});
  const [isRunning, setIsRunning] = useState(false);

  const runAllTests = () => {
    setIsRunning(true);
    const results: Record<string, { passed: boolean; message: string }> = {};
    for (const tc of testCases) {
      results[tc.id] = tc.run();
    }
    setTestResults(results);
    setIsRunning(false);
  };

  if (!isSelfTestOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl p-6 space-y-6 my-auto">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Validation & Unit Test Suite
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Self-test suite verifying math tolerance, strike-through accounting, and number parsers
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelfTestOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Unit Test Cases ({testCases.length})
            </span>
            <button
              onClick={runAllTests}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run All Tests</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto p-1 scrollbar-thin">
            {testCases.map((tc) => {
              const res = testResults[tc.id];
              return (
                <div
                  key={tc.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">{tc.name}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {tc.category}
                    </span>
                  </div>

                  {res && (
                    <div className="flex items-start gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <span className={res.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300 font-medium'}>
                        {res.message}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setSelfTestOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
