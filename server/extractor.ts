import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';

// Zod schema for structured output validation
export const ExtractedItemSchema = z.object({
  name: z.string().describe('Exact item description or name as printed on receipt'),
  item_code: z.string().nullable().optional().describe('SKU / barcode / code printed under or beside item'),
  quantity: z.number().describe('Item quantity, e.g. 1, 2, or 0.190 for weighted items'),
  unit: z.string().nullable().optional().describe('Unit symbol e.g. PC, KG, PA, SA, GM'),
  unit_price: z.number().describe('Price per single unit / each'),
  line_total: z.number().describe('Total price for this line item'),
  vat_code: z.string().nullable().optional().describe('VAT tax classification code e.g. A, G, E'),
  discount: z.number().nullable().optional().describe('Item specific discount if awarded or printed'),
  struck_through: z.boolean().default(false).describe('True if a pen line, marker, or strike-through is drawn across this item'),
  confidence: z.number().min(0).max(1).default(0.95).describe('Confidence score between 0.0 and 1.0'),
});

export const ExtractedReceiptSchema = z.object({
  merchant: z.string().describe('Store or merchant name'),
  branch: z.string().nullable().optional().describe('Branch name or location if printed'),
  date: z.string().nullable().optional().describe('Date in YYYY-MM-DD format if readable'),
  time: z.string().nullable().optional().describe('Time e.g. 12:23pm or 14:06:45'),
  receipt_number: z.string().nullable().optional().describe('Receipt number, invoice #, or Rct code'),
  currency: z.string().default('KES').describe('Currency ISO code or symbol, e.g. KES, USD, EUR, GBP'),
  customer_name: z.string().nullable().optional().describe('Customer name printed on the receipt or M-Pesa info'),
  cashier: z.string().nullable().optional().describe('Cashier name or ID'),
  payment_method: z.string().nullable().optional().describe('Payment method e.g. M-PESA, CASH, VISA, MASTERCARD'),
  items: z.array(ExtractedItemSchema).describe('List of all line items purchased'),
  subtotal_pre_vat: z.number().nullable().optional().describe('Pre-tax subtotal amount if present'),
  vat_total: z.number().nullable().optional().describe('Total VAT tax amount'),
  discount_total: z.number().nullable().optional().describe('Total discounts awarded'),
  total: z.number().describe('Final total payable amount as printed'),
  amount_paid: z.number().nullable().optional().describe('Amount tendered or paid by customer'),
  change: z.number().nullable().optional().describe('Change returned to customer'),
  warnings: z.array(z.string()).default([]).describe('Any warnings about cropped sections, strike-throughs, or ambiguities'),
  custom_fields: z.record(z.string(), z.any()).optional().describe('Any custom user-requested fields'),
});

export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;

// System prompt strictly adhering to Section 4
export const RECEIPT_SYSTEM_PROMPT = `
You are an expert OCR and financial document vision parser for "ReceiptLens".
Your job is to read images of receipts, invoices, or document tables with extreme precision and output strictly structured JSON.

CRITICAL PARSING RULES:
1. Extract ONLY what is physically printed or handwritten on the document. NEVER guess, hallucinate, or fabricate values. If a field is illegible or missing, set it to null and lower the confidence score.
2. Two-line line items: Items frequently span two lines!
   - Line 1 has the item name (e.g., "FR-FRESH PACKED SWEET POTATO PER KG" or "FD-INSTANT GRANULES STICK SATCHET 1.6G").
   - Line 2 has the item code underneath (e.g., "730087" or "686163"), followed horizontally by the Qty, Unit, Each price, and Line Total.
   - ALWAYS combine the name and code into the single corresponding item record!
3. Weighted & Decimal items: e.g. "0.190 KG × 399.00 = 75.81".
   - Quantity is 0.190 (keep decimal precision!).
   - Unit is "KG".
   - Unit price is 399.00.
   - Line total is 75.81.
4. Strike-throughs & Pen marks:
   - Detect hand-drawn pen lines, strike-throughs, checkmarks, or red/blue pen ink over any item.
   - Set struck_through=true for that item, BUT STILL EXTRACT ALL ITS DETAILS!
   - Add an explanation in warnings[] indicating whether the printed receipt total includes or excludes the struck item based on summing the line items.
5. Irrelevant text filtering:
   - Ignore general clutter unless specifically requested in custom fields: phone numbers, barcodes, QR codes, KRA/tax control unit numbers ("KRAMW...", "CU Inv"), "For home deliveries call...", marketing/loyalty promos.
   - However, DO capture customer name, cashier name, and payment method if printed.
6. Rewarded Discounts:
   - Thermal receipts often have a "REWARDED DISCOUNTS" section at the bottom listing discount amounts per item.
   - Match each rewarded discount to the corresponding item in the items list and set the item's discount field, and set discount_total to the total discount.
7. Cropped receipts:
   - If the receipt is cut off at the top (missing header/store name) or bottom (missing totals), gracefully set those fields to null and add a descriptive warning in warnings[].
8. Imperfections:
   - Reliably handle red ink stains, creases, faded thermal print, glare, rotated text, and low contrast.
9. Number and currency formatting:
   - Convert all prices to standard numbers (e.g. 75.81). Detect currency from the context (e.g., Kenyan Shillings "KES", USD, EUR, etc. Default to KES for East African receipts).
`;

export function buildGeminiResponseSchema(customFields?: Array<{ name: string; description?: string; type: string }>) {
  const baseItemProperties: Record<string, any> = {
    name: { type: Type.STRING, description: 'Item name / description' },
    item_code: { type: Type.STRING, description: 'Item code, SKU, or barcode if printed' },
    quantity: { type: Type.NUMBER, description: 'Item quantity (e.g. 1, 2.0, or 0.190)' },
    unit: { type: Type.STRING, description: 'Unit abbreviation e.g. PC, KG, PA, SA, GM' },
    unit_price: { type: Type.NUMBER, description: 'Unit price / each price' },
    line_total: { type: Type.NUMBER, description: 'Line total amount' },
    vat_code: { type: Type.STRING, description: 'VAT classification code e.g. A, G, E' },
    discount: { type: Type.NUMBER, description: 'Discount applied to this item' },
    struck_through: { type: Type.BOOLEAN, description: 'True if hand-drawn strike-through or pen mark across this item' },
    confidence: { type: Type.NUMBER, description: 'Extraction confidence 0.0 to 1.0' },
  };

  const receiptProperties: Record<string, any> = {
    merchant: { type: Type.STRING, description: 'Store or company name' },
    branch: { type: Type.STRING, description: 'Branch or location' },
    date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format if readable' },
    time: { type: Type.STRING, description: 'Time printed on receipt' },
    receipt_number: { type: Type.STRING, description: 'Receipt number or Rct code' },
    currency: { type: Type.STRING, description: 'Currency code, default KES' },
    customer_name: { type: Type.STRING, description: 'Customer name' },
    cashier: { type: Type.STRING, description: 'Cashier name or ID' },
    payment_method: { type: Type.STRING, description: 'Payment method: M-PESA, CASH, CARD, etc.' },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: baseItemProperties,
        required: ['name', 'quantity', 'unit_price', 'line_total', 'struck_through', 'confidence'],
      },
    },
    subtotal_pre_vat: { type: Type.NUMBER, description: 'Subtotal before tax' },
    vat_total: { type: Type.NUMBER, description: 'Total VAT tax amount' },
    discount_total: { type: Type.NUMBER, description: 'Total discount amount' },
    total: { type: Type.NUMBER, description: 'Final total amount printed' },
    amount_paid: { type: Type.NUMBER, description: 'Amount paid / cash paid / mpesa pay' },
    change: { type: Type.NUMBER, description: 'Change given' },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Warnings regarding strike-throughs, math inconsistencies, or illegible text',
    },
  };

  // If user requested custom fields, add them to schema
  if (customFields && customFields.length > 0) {
    const customProps: Record<string, any> = {};
    for (const f of customFields) {
      customProps[f.name] = {
        type: f.type === 'number' ? Type.NUMBER : f.type === 'boolean' ? Type.BOOLEAN : Type.STRING,
        description: f.description || `Custom extracted field: ${f.name}`,
      };
    }
    receiptProperties.custom_fields = {
      type: Type.OBJECT,
      properties: customProps,
    };
  }

  return {
    type: Type.OBJECT,
    properties: receiptProperties,
    required: ['merchant', 'items', 'total', 'warnings'],
  };
}

/**
 * Executes receipt extraction with Gemini API, validation, and auto-verification pass
 */
export async function extractReceiptWithGemini(params: {
  imageBase64: string;
  mimeType: string;
  modelName?: string;
  customFields?: Array<{ name: string; description?: string; type: string }>;
  documentType?: string;
  askPrompt?: string;
}): Promise<ExtractedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }

  // Model selection: allow user choice of 'gemini-2.5-flash' or 'gemini-2.5-pro', or fallback to 'gemini-3.8-flash'
  let targetModel = params.modelName || 'gemini-2.5-flash';
  if (targetModel.includes('pro')) {
    targetModel = 'gemini-2.5-pro';
  } else if (!targetModel.includes('flash') && !targetModel.includes('pro')) {
    targetModel = 'gemini-2.5-flash';
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const responseSchema = buildGeminiResponseSchema(params.customFields);

  let promptText = `
Document Type: ${params.documentType || 'Receipt / POS Slip'}.
Analyze this document photo with extreme care. Extract the merchant, branch, date, receipt number, currency, customer, cashier, payment method, all line items (with item code, quantity, unit, price, line total, VAT code, and discount), subtotal, VAT, total, and change.
Inspect carefully for strike-throughs or handwritten pen markings over any items, and note whether the total includes or excludes them.
`;

  if (params.askPrompt) {
    promptText += `\nSPECIAL USER INQUIRY: "${params.askPrompt}". Extract the precise answer and place it in the custom_fields object.\n`;
  }

  const imagePart = {
    inlineData: {
      mimeType: params.mimeType || 'image/jpeg',
      data: params.imageBase64,
    },
  };

  // Primary OCR call
  let responseText: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: {
        parts: [imagePart, { text: promptText }],
      },
      config: {
        systemInstruction: RECEIPT_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1,
      },
    });
    responseText = response.text;
  } catch (err: any) {
    // If the chosen model is temporarily unavailable or throttled, try flash fallback
    if (targetModel !== 'gemini-3.8-flash' && targetModel !== 'gemini-2.5-flash') {
      const fallbackResp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [imagePart, { text: promptText }],
        },
        config: {
          systemInstruction: RECEIPT_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.1,
        },
      });
      responseText = fallbackResp.text;
    } else {
      throw err;
    }
  }

  if (!responseText) {
    throw new Error('Gemini API returned an empty response.');
  }

  // Parse JSON
  let rawJson: any;
  try {
    rawJson = JSON.parse(responseText.trim());
  } catch (parseErr) {
    // Section 5: Retry once with a repair prompt
    const repairPrompt = `The previous response produced invalid JSON: "${responseText.slice(0, 300)}...".
Please output ONLY valid strictly formatted JSON matching the required schema.`;
    const repairResp = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [imagePart, { text: repairPrompt }],
      },
      config: {
        systemInstruction: RECEIPT_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });
    rawJson = JSON.parse((repairResp.text || '{}').trim());
  }

  // Validate with Zod
  const validated = ExtractedReceiptSchema.parse(rawJson);

  // Section 5: Math checks & Verification pass
  // Check if quantity * unit_price ≈ line_total (tolerance 0.02)
  // Check if sum of line_totals - discount_total ≈ total
  let hasInconsistency = false;
  const inconsistentLines: string[] = [];

  let itemsSum = 0;
  for (const item of validated.items) {
    const expected = item.quantity * item.unit_price;
    if (item.quantity > 0 && item.unit_price > 0 && Math.abs(expected - item.line_total) > 0.02) {
      hasInconsistency = true;
      inconsistentLines.push(`Item "${item.name}": ${item.quantity} × ${item.unit_price} = ${expected.toFixed(2)}, but line_total is ${item.line_total}`);
    }
    itemsSum += item.line_total;
  }

  const discount = validated.discount_total || 0;
  if (validated.total > 0 && Math.abs((itemsSum - discount) - validated.total) > 0.05) {
    hasInconsistency = true;
    inconsistentLines.push(`Total sum mismatch: sum(${itemsSum.toFixed(2)}) - discount(${discount.toFixed(2)}) = ${(itemsSum - discount).toFixed(2)}, but receipt total is ${validated.total}`);
  }

  // If an inconsistency was flagged, automatically do a second "verification pass"
  if (hasInconsistency && inconsistentLines.length > 0) {
    try {
      const verificationPrompt = `
You previously parsed this receipt, but mathematical verification detected these potential discrepancies:
${inconsistentLines.join('\n')}

Previous extraction:
${JSON.stringify(validated, null, 2)}

Re-examine the photo carefully. Verify whether:
1. An item code was confused with price or quantity
2. An item had a quantity like "2.000 PC" or decimal weight "0.190 KG"
3. A discount was deducted from total or line items
4. A pen strike-through caused an item to be excluded or included in the final printed total

Return the corrected and verified final JSON matching the schema.
`;
      const verifyResp = await ai.models.generateContent({
        model: targetModel,
        contents: {
          parts: [imagePart, { text: verificationPrompt }],
        },
        config: {
          systemInstruction: RECEIPT_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.0,
        },
      });

      if (verifyResp.text) {
        const verifyJson = JSON.parse(verifyResp.text.trim());
        const revalidated = ExtractedReceiptSchema.parse(verifyJson);
        revalidated.warnings = [
          ...revalidated.warnings,
          'Auto-verified via secondary mathematical consistency check.',
        ];
        return revalidated;
      }
    } catch (vErr) {
      // If verification pass fails, fall back to initial validated result with warning
      validated.warnings.push(`Mathematical check notice: ${inconsistentLines.join('; ')}`);
    }
  }

  return validated;
}
