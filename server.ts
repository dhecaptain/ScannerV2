import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractReceiptWithGemini } from './server/extractor.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser with 5MB limit (well within Vercel's 4.5MB limit)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// In-memory rate limiter: 20 requests per minute per IP
const requestHistory = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestHistory.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  timestamps.push(now);
  requestHistory.set(ip, timestamps);
  return true;
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Extraction endpoint
app.post('/api/extract', async (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '127.0.0.1';

  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      error: 'Rate limit exceeded. Maximum 20 extraction requests per minute. Please try again in a moment or use Basic OCR mode.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
    return;
  }

  try {
    const { image, mimeType, model, customFields, documentType, askPrompt } = req.body;

    if (!image) {
      res.status(400).json({ error: 'Missing "image" field (base64 encoded string).' });
      return;
    }

    // Clean base64 string if data URL prefix exists
    let cleanBase64 = image;
    let detectedMime = mimeType || 'image/jpeg';
    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        cleanBase64 = match[2];
      }
    }

    // File size check: base64 length to byte size estimation
    const approxBytes = (cleanBase64.length * 3) / 4;
    if (approxBytes > 4.5 * 1024 * 1024) {
      res.status(413).json({
        error: 'Image exceeds the maximum allowed payload size of 4.5MB. Please downscale or compress before sending.',
      });
      return;
    }

    const result = await extractReceiptWithGemini({
      imageBase64: cleanBase64,
      mimeType: detectedMime,
      modelName: model,
      customFields,
      documentType,
      askPrompt,
    });

    res.json({
      success: true,
      data: result,
      model: model || 'gemini-2.5-flash',
    });
  } catch (err: any) {
    console.error('Extraction error:', err);
    res.status(500).json({
      error: err.message || 'Failed to extract receipt data with Gemini API.',
      code: 'EXTRACTION_ERROR',
    });
  }
});

// Dev / Prod static serving
async function setupServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReceiptLens server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
