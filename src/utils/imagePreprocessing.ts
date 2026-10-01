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
  processedBase64: string;
  processedDataUrl: string;
  originalDataUrl: string;
  width: number;
  height: number;
  detectedCorners: [Point, Point, Point, Point]; // TL, TR, BR, BL
  quality: QualityReport;
  appliedEnhancements: string[];
  edgeConfidence: number;
  needsManualCropReview: boolean;
}

let openCvWorker: Worker | null = null;
let workerInitPromise: Promise<void> | null = null;

function getOpenCvWorker(): Promise<Worker | null> {
  if (typeof window === 'undefined' || !window.Worker) {
    return Promise.resolve(null);
  }
  if (!openCvWorker) {
    try {
      openCvWorker = new Worker('/opencv-worker.js');
      workerInitPromise = new Promise((resolve) => {
        const initId = 'init_' + Date.now();
        const handler = (e: MessageEvent) => {
          if (e.data.id === initId) {
            openCvWorker?.removeEventListener('message', handler);
            resolve();
          }
        };
        openCvWorker?.addEventListener('message', handler);
        openCvWorker?.postMessage({ id: initId, type: 'INIT' });

        // Timeout safety: resolve after 5 seconds even if OpenCV fails to load
        setTimeout(() => {
          openCvWorker?.removeEventListener('message', handler);
          resolve();
        }, 5000);
      });
    } catch (e) {
      console.warn('Failed to construct OpenCV worker:', e);
      return Promise.resolve(null);
    }
  }
  return (workerInitPromise || Promise.resolve()).then(() => openCvWorker);
}

/**
 * Loads an image from File, Blob, or URL into an HTMLImageElement
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
  const sampleW = Math.min(width, 350);
  const sampleH = Math.min(height, 350);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sampleW;
  tempCanvas.height = sampleH;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(ctx.canvas, 0, 0, sampleW, sampleH);

  const imgData = tempCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  const gray = new Float32Array(sampleW * sampleH);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

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
 * Dispatches edge detection to OpenCV Web Worker (with local fallback)
 */
export async function detectEdgesWithWorker(
  canvas: HTMLCanvasElement,
  w: number,
  h: number
): Promise<{ corners: [Point, Point, Point, Point]; confidence: number }> {
  const worker = await getOpenCvWorker();
  const scale = Math.min(1, 600 / Math.max(w, h));
  const sw = Math.floor(w * scale);
  const sh = Math.floor(h * scale);

  const smCanvas = document.createElement('canvas');
  smCanvas.width = sw;
  smCanvas.height = sh;
  const smCtx = smCanvas.getContext('2d')!;
  smCtx.drawImage(canvas, 0, 0, sw, sh);

  const imgData = smCtx.getImageData(0, 0, sw, sh);

  if (worker) {
    try {
      const taskId = 'edge_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const workerResult: any = await new Promise((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          if (e.data.id === taskId) {
            worker.removeEventListener('message', handler);
            resolve(e.data);
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({
          id: taskId,
          type: 'DETECT_EDGES',
          imageData: imgData,
          width: sw,
          height: sh,
        });

        // 3-second timeout fallback
        setTimeout(() => {
          worker.removeEventListener('message', handler);
          resolve(null);
        }, 3000);
      });

      if (workerResult && workerResult.corners) {
        // Rescale corners back to full dimension
        const scaledCorners = workerResult.corners.map((p: Point) => ({
          x: Math.round(p.x / scale),
          y: Math.round(p.y / scale),
        })) as [Point, Point, Point, Point];

        return {
          corners: scaledCorners,
          confidence: workerResult.confidence || 0.8,
        };
      }
    } catch (e) {
      console.warn('Worker edge detection error, falling back:', e);
    }
  }

  // Fallback if worker not available
  const defaultCorners = detectReceiptCorners(w, h);
  return { corners: defaultCorners, confidence: 0.5 };
}

/**
 * Returns default quadrilateral corner points for a given width and height
 */
export function detectReceiptCorners(
  _canvasOrW?: HTMLCanvasElement | number,
  wOrH?: number,
  maybeH?: number
): [Point, Point, Point, Point] {
  let w = 800;
  let h = 1200;
  if (typeof _canvasOrW === 'number') {
    w = _canvasOrW;
    h = typeof wOrH === 'number' ? wOrH : 1200;
  } else if (_canvasOrW && typeof _canvasOrW === 'object' && 'width' in _canvasOrW) {
    w = typeof wOrH === 'number' ? wOrH : _canvasOrW.width;
    h = typeof maybeH === 'number' ? maybeH : _canvasOrW.height;
  }
  return [
    { x: Math.round(w * 0.05), y: Math.round(h * 0.03) },
    { x: Math.round(w * 0.95), y: Math.round(h * 0.03) },
    { x: Math.round(w * 0.95), y: Math.round(h * 0.97) },
    { x: Math.round(w * 0.05), y: Math.round(h * 0.97) },
  ];
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

      const p00 = bilinearPoint(tl, tr, br, bl, u0, v0);
      const p10 = bilinearPoint(tl, tr, br, bl, u1, v0);
      const p11 = bilinearPoint(tl, tr, br, bl, u1, v1);
      const p01 = bilinearPoint(tl, tr, br, bl, u0, v1);

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
  const dy = (sx0 * (sy2 * y1 - sy1 * y2) + sy0 * (sx1 * y2 - sx2 * y1) + (sx2 * sy1 - sx1 * sy2) * x0) / denom;

  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(im, 0, 0);
  ctx.restore();
}

/**
 * Lighting enhancement & contrast normalization without aggressive binarization.
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

  let factor = 1.0;
  let offset = 0;

  if (brightness < 85) {
    factor = 1.25;
    offset = 20;
    applied.push('Low-light exposure boost');
  } else if (brightness > 215) {
    factor = 0.9;
    offset = -12;
    applied.push('Glare reduction & contrast restoration');
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] + offset) * factor));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] + offset) * factor));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] + offset) * factor));
  }

  ctx.putImageData(imgData, 0, 0);
  applied.push('Adaptive illumination normalization');
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
 * Reads EXIF orientation from JPEG byte stream:
 * 1 = 0 deg, 3 = 180 deg, 6 = 90 deg CW, 8 = 270 deg CW
 */
export async function getExifOrientation(fileOrBlob: File | Blob): Promise<number> {
  if (typeof Blob === 'undefined' || !(fileOrBlob instanceof Blob)) return 1;
  try {
    const slice = fileOrBlob.slice(0, 64 * 1024);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1;

    let offset = 2;
    const maxOffset = view.byteLength - 2;
    while (offset < maxOffset) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        // APP1 Exif marker
        offset += 2; // skip length
        if (view.getUint32(offset, false) !== 0x45786966) return 1; // "Exif"
        offset += 6;
        const little = view.getUint16(offset, false) === 0x4949; // "II" vs "MM"
        const ifdOffset = view.getUint32(offset + 4, little);
        let tagOffset = offset + ifdOffset;
        if (tagOffset + 2 > view.byteLength) return 1;
        const tagsCount = view.getUint16(tagOffset, little);
        tagOffset += 2;
        for (let i = 0; i < tagsCount; i++) {
          if (tagOffset + 12 > view.byteLength) break;
          const tag = view.getUint16(tagOffset, little);
          if (tag === 0x0112) {
            // Orientation tag
            return view.getUint16(tagOffset + 8, little);
          }
          tagOffset += 12;
        }
        return 1;
      } else if ((marker & 0xff00) === 0xff00) {
        if (marker === 0xffda || marker === 0xffd9) break; // Start of scan or end of image
        const len = view.getUint16(offset, false);
        offset += len;
      } else {
        break;
      }
    }
  } catch {
    return 1;
  }
  return 1;
}

/**
 * Requirement B: Iterative 3-pass compression ensuring the base64 payload is <= 3.8MB:
 * Pass 1: longest side <= 2000px, JPEG quality 0.85
 * Pass 2: longest side <= 1600px, JPEG quality 0.70
 * Pass 3: longest side <= 1200px, JPEG quality 0.55
 * If still > 3.8MB after 3 passes, throws descriptive user error.
 */
export async function compressToTargetPayloadLimit(
  canvas: HTMLCanvasElement,
  maxBase64Bytes = 3.8 * 1024 * 1024
): Promise<{ blob: Blob; base64: string; dataUrl: string }> {
  const passes = [
    { maxDim: 2000, quality: 0.85 },
    { maxDim: 1600, quality: 0.70 },
    { maxDim: 1200, quality: 0.55 },
  ];

  let currentCanvas = canvas;

  for (let i = 0; i < passes.length; i++) {
    const { maxDim, quality } = passes[i];
    const longest = Math.max(currentCanvas.width, currentCanvas.height);
    if (longest > maxDim) {
      const scale = maxDim / longest;
      const targetW = Math.round(currentCanvas.width * scale);
      const targetH = Math.round(currentCanvas.height * scale);
      const resized = document.createElement('canvas');
      resized.width = targetW;
      resized.height = targetH;
      const rCtx = resized.getContext('2d')!;
      rCtx.drawImage(currentCanvas, 0, 0, targetW, targetH);
      currentCanvas = resized;
    }

    const dataUrl = currentCanvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

    if (base64.length <= maxBase64Bytes) {
      const blob: Blob = await new Promise((resolve) => {
        currentCanvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', quality);
      });
      return { blob, base64, dataUrl };
    }
  }

  throw new Error('Image too large after compression. Please crop closer to the receipt or use a lower camera resolution.');
}

/**
 * Full Preprocessing Pipeline
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

  // 1. Initial downscale so longest side <= 2000px
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
  
  // Drawing to canvas strips EXIF GPS metadata automatically
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const originalDataUrl = canvas.toDataURL('image/jpeg', 0.9);

  // 2. Handle manual or EXIF rotation
  let effectiveRotation = options.rotation || 0;
  if (!effectiveRotation && (fileOrUrl instanceof Blob)) {
    const exifOrientation = await getExifOrientation(fileOrUrl);
    if (exifOrientation === 3) effectiveRotation = 180;
    else if (exifOrientation === 6) effectiveRotation = 90;
    else if (exifOrientation === 8) effectiveRotation = 270;
  }

  if (effectiveRotation) {
    canvas = rotateCanvas(canvas, effectiveRotation);
  }

  // 3. Quality analysis
  const blurScore = calculateBlurScore(ctx, canvas.width, canvas.height);
  const brightness = calculateBrightness(ctx, canvas.width, canvas.height);
  const is_blurry = blurScore < 25;
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

  if (is_blurry) quality.message = 'Image might be blurry. Consider holding camera steady for faint thermal print.';
  else if (is_dark) quality.message = 'Low lighting detected. Adaptive illumination boost applied.';

  // 4. Edge detection via OpenCV Web Worker
  let detectedCorners: [Point, Point, Point, Point];
  let edgeConfidence = 0.9;

  if (options.customCorners) {
    detectedCorners = options.customCorners;
  } else {
    const edgeRes = await detectEdgesWithWorker(canvas, canvas.width, canvas.height);
    detectedCorners = edgeRes.corners;
    edgeConfidence = edgeRes.confidence;
  }

  // 5. Perspective Transform if requested
  let workingCanvas = canvas;
  if (options.autoPerspective) {
    workingCanvas = applyPerspectiveTransform(canvas, detectedCorners);
  }

  // 6. Lighting & contrast enhancement
  const { applied: appliedEnhancements } = enhanceImageLighting(workingCanvas, brightness);

  // 7. Iterative compression ensuring payload <= 3.8MB base64
  const { blob: processedBlob, base64: processedBase64, dataUrl: processedDataUrl } =
    await compressToTargetPayloadLimit(workingCanvas, 3.8 * 1024 * 1024);

  return {
    processedBlob,
    processedBase64,
    processedDataUrl,
    originalDataUrl,
    width: workingCanvas.width,
    height: workingCanvas.height,
    detectedCorners,
    quality,
    appliedEnhancements,
    edgeConfidence,
    needsManualCropReview: edgeConfidence < 0.7,
  };
}
