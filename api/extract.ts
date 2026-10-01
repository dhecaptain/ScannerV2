import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractReceiptWithGemini } from '../server/extractor.ts';
import { checkRateLimit, getClientIp } from '../server/ratelimit.ts';
import { ExtractRequestBodySchema } from '../server/schemas.ts';

export const maxDuration = 60;
export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // 1. IP extraction & Rate limiting
  const clientIp = getClientIp(req.headers as any, req.socket?.remoteAddress);
  const rateLimitResult = await checkRateLimit(clientIp);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      error: rateLimitResult.reason || 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  }

  // 2. Strict Zod body validation
  const parseResult = ExtractRequestBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request payload: ' + parseResult.error.issues.map(i => i.message).join(', '),
      code: 'INVALID_PAYLOAD',
    });
  }

  const { image, mimeType, model, customFields, documentType, askPrompt } = parseResult.data;

  // Clean base64 string if data URL prefix exists
  let cleanBase64 = image;
  if (image.startsWith('data:')) {
    const match = image.match(/^data:[^;]+;base64,(.+)$/);
    if (match) {
      cleanBase64 = match[1];
    }
  }

  // Double check payload size
  const approxBytes = (cleanBase64.length * 3) / 4;
  if (approxBytes > 4.2 * 1024 * 1024) {
    return res.status(413).json({
      error: 'Image exceeds maximum allowed binary payload size of 4.2MB.',
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  try {
    const result = await extractReceiptWithGemini({
      imageBase64: cleanBase64,
      mimeType,
      modelName: model,
      customFields,
      documentType,
      askPrompt,
    });

    return res.status(200).json({
      success: true,
      data: result,
      model,
    });
  } catch (err: any) {
    const errCode = `ERR_${Date.now().toString(36)}`;
    console.error(`[Serverless ${errCode}] Extraction failure:`, err?.message?.slice(0, 120));
    return res.status(500).json({
      error: `An error occurred while analyzing the document (${errCode}). Please retry or use Basic OCR mode.`,
      code: 'EXTRACTION_ERROR',
    });
  }
}
