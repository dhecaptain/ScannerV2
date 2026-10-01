import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractReceiptWithGemini } from '../server/extractor.ts';

export const maxDuration = 60;
export const config = {
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

  try {
    const { image, mimeType, model, customFields, documentType, askPrompt } = req.body || {};

    if (!image) {
      return res.status(400).json({ error: 'Missing "image" field.' });
    }

    let cleanBase64 = image;
    let detectedMime = mimeType || 'image/jpeg';
    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        cleanBase64 = match[2];
      }
    }

    const approxBytes = (cleanBase64.length * 3) / 4;
    if (approxBytes > 4.5 * 1024 * 1024) {
      return res.status(413).json({
        error: 'Image exceeds payload size limit of 4.5MB.',
      });
    }

    const result = await extractReceiptWithGemini({
      imageBase64: cleanBase64,
      mimeType: detectedMime,
      modelName: model,
      customFields,
      documentType,
      askPrompt,
    });

    return res.status(200).json({
      success: true,
      data: result,
      model: model || 'gemini-2.5-flash',
    });
  } catch (err: any) {
    console.error('Vercel API error:', err);
    return res.status(500).json({
      error: err.message || 'Internal extraction failure.',
      code: 'EXTRACTION_ERROR',
    });
  }
}
