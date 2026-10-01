import { Point } from '../types/receipt';

export interface QualityReport {
  is_blurry: boolean;
  is_dark: boolean;
  is_small: boolean;
  blur_score: number;
  brightness_score: number;
  width: number;
  height: number;
  message?: string;
}

export interface PreprocessingResult {
  processedBlob: Blob;
  processedDataUrl: string;
  originalDataUrl: string;
  width: number;
  height: number;
  detectedCorners: [Point, Point, Point, Point]; // TL, TR, BR, BL
  quality: QualityReport;
  appliedEnhancements: string[];
}

/**
 * Loads an image from File or Blob or URL into an HTMLImageElement
 */
export function loadImage(src: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));

    if (typeof src === 'string') {
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

/**
 * Computes Laplacian variance on grayscale image data to detect blur
 */
export function calculateBlurScore(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const sampleW = Math.min(width, 400);
  const sampleH = Math.min(height, 400);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sampleW;
  tempCanvas.height = sampleH;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(ctx.canvas, 0, 0, sampleW, sampleH);

  const imgData = tempCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // Convert to grayscale array
  const gray = new Float32Array(sampleW * sampleH);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 3x3 Laplacian filter kernel:
  //  0  1  0
  //  1 -4  1
  //  0  1  0
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const idx = y * sampleW + x;
      const lap =
        gray[idx - sampleW] +
        gray[idx + sampleW] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.max(0, variance);
}

/**
 * Calculates mean brightness (0-255)
 */
export function calculateBrightness(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const sampleW = Math.min(width, 200);
  const sampleH = Math.min(height, 200);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sampleW;
  tempCanvas.height = sampleH;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(ctx.canvas, 0, 0, sampleW, sampleH);

  const data = tempCtx.getImageData(0, 0, sampleW, sampleH).data;
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return totalBrightness / (sampleW * sampleH);
}

/**
 * Robust Receipt Edge Detection:
 * Designed specifically for receipts on dark notebooks/tables (like the user sample images),
 * thermal paper, and tall, narrow rectangular receipts.
 */
export function detectReceiptCorners(
  canvas: HTMLCanvasElement,
  w: number,
  h: number
): [Point, Point, Point, Point] {
  // Default padding bounding quadrilateral if contrast is low or edges are ambiguous
  const defaultCorners: [Point, Point, Point, Point] = [
    { x: w * 0.08, y: h * 0.04 }, // Top-Left
    { x: w * 0.92, y: h * 0.04 }, // Top-Right
    { x: w * 0.92, y: h * 0.96 }, // Bottom-Right
    { x: w * 0.08, y: h * 0.96 }, // Bottom-Left
  ];

  try {
    const scale = Math.min(1, 600 / Math.max(w, h));
    const sw = Math.floor(w * scale);
    const sh = Math.floor(h * scale);

    const smCanvas = document.createElement('canvas');
    smCanvas.width = sw;
    smCanvas.height = sh;
    const smCtx = smCanvas.getContext('2d')!;
    smCtx.drawImage(canvas, 0, 0, sw, sh);

    const imgData = smCtx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // Build luminance map
    const lum = new Uint8Array(sw * sh);
    let avgLum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      lum[i / 4] = v;
      avgLum += v;
    }
    avgLum /= sw * sh;

    // Detect high-contrast horizontal and vertical paper boundaries (thermal paper is white/light on darker table)
    // Find column bounds where receipt paper exists
    const colBright: number[] = new Array(sw).fill(0);
    const rowBright: number[] = new Array(sh).fill(0);

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const val = lum[y * sw + x];
        colBright[x] += val;
        rowBright[y] += val;
      }
    }

    // Threshold based on background vs paper
    let minX = sw * 0.08;
    let maxX = sw * 0.92;
    let minY = sh * 0.04;
    let maxY = sh * 0.96;

    const colAvg = colBright.map(v => v / sh);
    const rowAvg = rowBright.map(v => v / sw);
    const midBrightness = (Math.max(...colAvg) + Math.min(...colAvg)) / 2;

    // Find first and last columns significantly above background
    for (let x = 0; x < sw * 0.4; x++) {
      if (colAvg[x] > midBrightness * 0.95) {
        minX = Math.max(sw * 0.03, x);
        break;
      }
    }
    for (let x = sw - 1; x > sw * 0.6; x--) {
      if (colAvg[x] > midBrightness * 0.95) {
        maxX = Math.min(sw * 0.97, x);
        break;
      }
    }

    for (let y = 0; y < sh * 0.3; y++) {
      if (rowAvg[y] > midBrightness * 0.95) {
        minY = Math.max(sh * 0.02, y);
        break;
      }
    }
    for (let y = sh - 1; y > sh * 0.7; y--) {
      if (rowAvg[y] > midBrightness * 0.95) {
        maxY = Math.min(sh * 0.98, y);
        break;
      }
    }

    // Convert scaled coordinates back to full image size
    return [
      { x: Math.round(minX / scale), y: Math.round(minY / scale) },
      { x: Math.round(maxX / scale), y: Math.round(minY / scale) },
      { x: Math.round(maxX / scale), y: Math.round(maxY / scale) },
      { x: Math.round(minX / scale), y: Math.round(maxY / scale) },
    ];
  } catch {
    return defaultCorners;
  }
}

/**
 * Perspective Warp Transformation:
 * Flattens quadrilateral corners [TL, TR, BR, BL] into a rectified rectangular image.
 */
export function applyPerspectiveTransform(
  sourceCanvas: HTMLCanvasElement,
  corners: [Point, Point, Point, Point]
): HTMLCanvasElement {
  const [tl, tr, br, bl] = corners;

  // Calculate width and height of output rectangle
  const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
  const targetW = Math.max(200, Math.round(Math.max(widthTop, widthBottom)));

  const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
  const targetH = Math.max(200, Math.round(Math.max(heightLeft, heightRight)));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const outCtx = outCanvas.getContext('2d')!;

  // Bilinear interpolation warp across the quadrilateral mesh
  const srcCtx = sourceCanvas.getContext('2d')!;
  const gridX = 16;
  const gridY = 24;

  const dx = targetW / gridX;
  const dy = targetH / gridY;

  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      const u0 = gx / gridX;
      const v0 = gy / gridY;
      const u1 = (gx + 1) / gridX;
      const v1 = (gy + 1) / gridY;

      // Bilinear interpolation of src coordinates
      const p00 = bilinearPoint(tl, tr, br, bl, u0, v0);
      const p10 = bilinearPoint(tl, tr, br, bl, u1, v0);
      const p11 = bilinearPoint(tl, tr, br, bl, u1, v1);
      const p01 = bilinearPoint(tl, tr, br, bl, u0, v1);

      // Draw textured triangles
      drawTriangle(
        outCtx,
        sourceCanvas,
        gx * dx, gy * dy,
        (gx + 1) * dx, gy * dy,
        gx * dx, (gy + 1) * dy,
        p00.x, p00.y,
        p10.x, p10.y,
        p01.x, p01.y
      );

      drawTriangle(
        outCtx,
        sourceCanvas,
        (gx + 1) * dx, gy * dy,
        (gx + 1) * dx, (gy + 1) * dy,
        gx * dx, (gy + 1) * dy,
        p10.x, p10.y,
        p11.x, p11.y,
        p01.x, p01.y
      );
    }
  }

  return outCanvas;
}

function bilinearPoint(tl: Point, tr: Point, br: Point, bl: Point, u: number, v: number): Point {
  const topX = tl.x + (tr.x - tl.x) * u;
  const topY = tl.y + (tr.y - tl.y) * u;
  const botX = bl.x + (br.x - bl.x) * u;
  const botY = bl.y + (br.y - bl.y) * u;
  return {
    x: topX + (botX - topX) * v,
    y: topY + (botY - topY) * v,
  };
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  im: HTMLCanvasElement,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  sx0: number, sy0: number,
  sx1: number, sy1: number,
  sx2: number, sy2: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

  // Affine transform matrix
  const denom = (sx0 * (sy1 - sy2) - sx1 * sy0 + sx2 * sy0 + (sx1 - sx2) * sy1);
  if (denom === 0) {
    ctx.restore();
    return;
  }

  const m11 = - (sy0 * (x1 - x2) - sy1 * x0 + sy2 * x0 + (sy1 - sy2) * x1) / denom;
  const m12 = (sy1 * y2 + sy0 * (y1 - y2) - sy2 * y1 + (sy2 - sy1) * y0) / denom;
  const m21 = (sx0 * (x1 - x2) - sx1 * x0 + sx2 * x0 + (sx1 - sx2) * x1) / denom;
  const m22 = - (sx1 * y2 + sx0 * (y1 - y2) - sx2 * y1 + (sx2 - sx1) * y0) / denom;
  const dx = (sx0 * (sy2 * x1 - sy1 * x2) + sy0 * (sx1 * x2 - sx2 * x1) + (sx2 * sy1 - sx1 * sy2) * x0) / denom;
  const dy = (sx0 * (sy2 * y1 - sy1 * y2) + sy0 * (sx1 * y2 - sx2 * y1) + (sx2 * sy1 - sx1 * sy2) * y0) / denom;

  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(im, 0, 0);
  ctx.restore();
}

/**
 * Lighting enhancement & contrast normalization without aggressive binarization.
 * Preserves color/grayscale nuances so Gemini Vision model can read thermal faint print.
 */
export function enhanceImageLighting(
  canvas: HTMLCanvasElement,
  brightness: number
): { canvas: HTMLCanvasElement; applied: string[] } {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const applied: string[] = [];

  // Low light correction
  let factor = 1.0;
  let offset = 0;

  if (brightness < 90) {
    // Under-exposed photo: lift midtones and boost contrast
    factor = 1.25;
    offset = 25;
    applied.push('Low-light exposure boost');
  } else if (brightness > 210) {
    // Over-exposed / washed out
    factor = 0.9;
    offset = -15;
    applied.push('Glare reduction & contrast restoration');
  }

  // Mild unsharp mask / contrast enhancement
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] + offset) * factor));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] + offset) * factor));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] + offset) * factor));
  }

  ctx.putImageData(imgData, 0, 0);
  applied.push('Adaptive illumination normalizer');
  return { canvas, applied };
}

/**
 * Rotates a canvas by 90, 180, or 270 degrees
 */
export function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const normDeg = ((degrees % 360) + 360) % 360;
  if (normDeg === 0) return canvas;

  const outCanvas = document.createElement('canvas');
  const ctx = outCanvas.getContext('2d')!;

  if (normDeg === 90 || normDeg === 270) {
    outCanvas.width = canvas.height;
    outCanvas.height = canvas.width;
  } else {
    outCanvas.width = canvas.width;
    outCanvas.height = canvas.height;
  }

  ctx.translate(outCanvas.width / 2, outCanvas.height / 2);
  ctx.rotate((normDeg * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return outCanvas;
}

/**
 * Full Preprocessing Pipeline
 * Downscales longest side <= 2000px, detects edges, warps if autoTransform=true,
 * runs quality check (Laplacian blur + dark detection), and compresses to 85% JPEG.
 */
export async function preprocessReceiptImage(
  fileOrUrl: File | Blob | string,
  options: {
    autoPerspective?: boolean;
    rotation?: number;
    customCorners?: [Point, Point, Point, Point];
  } = {}
): Promise<PreprocessingResult> {
  const img = await loadImage(fileOrUrl);
  let srcW = img.naturalWidth || img.width;
  let srcH = img.naturalHeight || img.height;

  // 1. Initial downscale if ultra-high res, so processing is snappy and stays under 2000px
  const maxDim = 2000;
  let targetW = srcW;
  let targetH = srcH;
  if (Math.max(srcW, srcH) > maxDim) {
    const scale = maxDim / Math.max(srcW, srcH);
    targetW = Math.round(srcW * scale);
    targetH = Math.round(srcH * scale);
  }

  let canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Store original preview
  const originalDataUrl = canvas.toDataURL('image/jpeg', 0.9);

  // 2. Handle rotation if specified
  if (options.rotation) {
    canvas = rotateCanvas(canvas, options.rotation);
  }

  // 3. Quality analysis
  const blurScore = calculateBlurScore(ctx, canvas.width, canvas.height);
  const brightness = calculateBrightness(ctx, canvas.width, canvas.height);
  const is_blurry = blurScore < 25; // low variance means soft or blurry
  const is_dark = brightness < 60;
  const is_small = canvas.width < 400 || canvas.height < 400;

  const quality: QualityReport = {
    is_blurry,
    is_dark,
    is_small,
    blur_score: Math.round(blurScore),
    brightness_score: Math.round(brightness),
    width: canvas.width,
    height: canvas.height,
  };

  if (is_blurry) quality.message = 'Image might be blurry. Consider retaking for optimal line item accuracy.';
  else if (is_dark) quality.message = 'Low lighting detected. Adaptive illumination boost applied.';

  // 4. Edge detection
  const detectedCorners = options.customCorners || detectReceiptCorners(canvas, canvas.width, canvas.height);

  // 5. Perspective Transform if requested
  let workingCanvas = canvas;
  if (options.autoPerspective) {
    workingCanvas = applyPerspectiveTransform(canvas, detectedCorners);
  }

  // 6. Lighting & contrast enhancement for faint thermal paper
  const { applied: appliedEnhancements } = enhanceImageLighting(workingCanvas, brightness);

  // 7. Compress to ~85% JPEG
  const blob: Blob = await new Promise((resolve) => {
    workingCanvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.85);
  });

  const processedDataUrl = workingCanvas.toDataURL('image/jpeg', 0.85);

  return {
    processedBlob: blob,
    processedDataUrl,
    originalDataUrl,
    width: workingCanvas.width,
    height: workingCanvas.height,
    detectedCorners,
    quality,
    appliedEnhancements,
  };
}
