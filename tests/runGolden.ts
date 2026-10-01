import dotenv from 'dotenv';
import goldenReceipts from './golden.json';
import { validateReceipt } from '../src/utils/validation';

dotenv.config();

async function runGoldenCheck() {
  console.log('=============================================');
  console.log('   ReceiptLens Golden Test Suite Runner     ');
  console.log('=============================================\n');

  let passedCount = 0;

  for (const receipt of goldenReceipts) {
    const rctNum = receipt.receipt_number;
    console.log(`[Testing Golden Rct #${rctNum}] - ${receipt.merchant} (${receipt.date})`);
    
    // Run mathematical validation
    const validation = validateReceipt(receipt as any);
    const isValid = validation.status !== 'error';

    if (isValid) {
      console.log(`  ✓ Validation Passed: Status = ${validation.status.toUpperCase()}`);
      if (validation.issues.length > 0) {
        console.log(`    Notes: ${validation.issues.join('; ')}`);
      }
      passedCount++;
    } else {
      console.error(`  ✗ Validation FAILED:`);
      validation.issues.forEach(i => console.error(`    - ${i}`));
    }
    console.log('');
  }

  console.log('---------------------------------------------');
  console.log(`Result: ${passedCount} / ${goldenReceipts.length} Golden Receipts passed validation.`);
  console.log('---------------------------------------------\n');

  if (passedCount === goldenReceipts.length) {
    console.log('All golden test cases verified successfully!');
    process.exit(0);
  } else {
    console.error('Some golden receipts failed validation.');
    process.exit(1);
  }
}

runGoldenCheck().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
