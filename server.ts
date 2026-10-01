import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractReceiptWithGemini } from './server/extractor.ts';
import { checkRateLimit, getClientIp } from './server/ratelimit.ts';
import { ExtractRequestBodySchema } from './server/schemas.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser with 5MB limit
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

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
  const clientIp = getClientIp(req.headers as any, req.ip);

  // Rate limit check
  const rl = await checkRateLimit(clientIp);
  if (!rl.allowed) {
    res.status(429).json({
      error: rl.reason || 'Rate limit exceeded. Please wait a moment or use Basic mode.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
    return;
  }

  // Zod request validation
  const parsed = ExtractRequestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request payload: ' + parsed.error.issues.map(i => i.message).join(', '),
      code: 'INVALID_PAYLOAD',
    });
    return;
  }

  const { image, mimeType, model, customFields, documentType, askPrompt } = parsed.data;

  // Clean base64 string if data URL prefix exists
  let cleanBase64 = image;
  if (image.startsWith('data:')) {
    const match = image.match(/^data:[^;]+;base64,(.+)$/);
    if (match) {
      cleanBase64 = match[1];
    }
  }

  // Size limit check
  const approxBytes = (cleanBase64.length * 3) / 4;
  if (approxBytes > 4.2 * 1024 * 1024) {
    res.status(413).json({
      error: 'Image payload is too large. Longest side must be <= 2000px and compressed.',
      code: 'PAYLOAD_TOO_LARGE',
    });
    return;
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

    res.json({
      success: true,
      data: result,
      model,
    });
  } catch (err: any) {
    const errCode = `ERR_${Date.now().toString(36)}`;
    console.error(`[Server ${errCode}] Extraction error:`, err?.message?.slice(0, 120));
    res.status(500).json({
      error: `An error occurred while analyzing the document (${errCode}). Please retry or use Basic OCR mode.`,
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
