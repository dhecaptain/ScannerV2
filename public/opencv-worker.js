/**
 * OpenCV.js Web Worker for Document Edge Detection
 * Offloads compute-heavy computer vision pipeline from main UI thread
 */

let cvReady = false;

self.onmessage = async (e) => {
  const { id, type, imageData, width, height } = e.data;

  if (type === 'INIT') {
    if (cvReady) {
      self.postMessage({ id, status: 'READY' });
      return;
    }
    try {
      // Load pinned OpenCV.js
      importScripts('https://docs.opencv.org/4.8.0/opencv.js');
      if (typeof cv !== 'undefined' && cv.Mat) {
        cvReady = true;
        self.postMessage({ id, status: 'READY' });
      } else {
        cv['onRuntimeInitialized'] = () => {
          cvReady = true;
          self.postMessage({ id, status: 'READY' });
        };
      }
    } catch (err) {
      self.postMessage({ id, status: 'ERROR', error: err.message });
    }
    return;
  }

  if (type === 'DETECT_EDGES') {
    if (!cvReady || typeof cv === 'undefined') {
      // Fallback if opencv failed to load
      const fallbackCorners = computeBrightRegionFallback(imageData, width, height);
      self.postMessage({ id, corners: fallbackCorners, confidence: 0.5, method: 'bright_region_fallback' });
      return;
    }

    try {
      const src = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const claheResult = new cv.Mat();
      const blurred = new cv.Mat();
      const edges = new cv.Mat();
      const closed = new cv.Mat();

      // 1. Grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // 2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
      const clahe = new cv.CLAHE(2.5, new cv.Size(8, 8));
      clahe.apply(gray, claheResult);

      // 3. Gaussian Blur
      cv.GaussianBlur(claheResult, blurred, new cv.Size(5, 5), 0);

      // 4. Canny Edge Detection
      cv.Canny(blurred, edges, 50, 150, 3, false);

      // 5. Morphological Close (bridge gaps in printed borders / folds)
      const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
      cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);

      // 6. Find Contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      const totalArea = width * height;
      let maxArea = 0;
      let bestCorners = null;

      for (let i = 0; i < contours.size(); ++i) {
        const c = contours.get(i);
        const area = cv.contourArea(c);
        if (area > totalArea * 0.15 && area > maxArea) {
          const peri = cv.arcLength(c, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(c, approx, 0.02 * peri, true);

          if (approx.rows === 4) {
            maxArea = area;
            const pts = [];
            for (let j = 0; j < 4; j++) {
              pts.push({
                x: approx.data32S[j * 2],
                y: approx.data32S[j * 2 + 1],
              });
            }
            bestCorners = orderCorners(pts);
          }
          approx.delete();
        }
      }

      // Cleanup OpenCV Mats
      src.delete();
      gray.delete();
      clahe.delete();
      claheResult.delete();
      blurred.delete();
      edges.delete();
      kernel.delete();
      closed.delete();
      contours.delete();
      hierarchy.delete();

      if (bestCorners && maxArea > totalArea * 0.2) {
        self.postMessage({ id, corners: bestCorners, confidence: 0.95, method: 'opencv_clahe_canny' });
      } else {
        // Fallback to bright region bounding box for thermal receipts on dark tables
        const fallbackCorners = computeBrightRegionFallback(imageData, width, height);
        self.postMessage({ id, corners: fallbackCorners, confidence: 0.6, method: 'bright_region_fallback' });
      }
    } catch (cvErr) {
      const fallbackCorners = computeBrightRegionFallback(imageData, width, height);
      self.postMessage({ id, corners: fallbackCorners, confidence: 0.5, method: 'bright_region_fallback' });
    }
  }
};

/**
 * Orders 4 points consistently: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 */
function orderCorners(pts) {
  // Sum (x + y): smallest is TL, largest is BR
  // Difference (y - x): smallest is TR, largest is BL
  const sortedBySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const tl = sortedBySum[0];
  const br = sortedBySum[3];

  const remaining = [sortedBySum[1], sortedBySum[2]];
  // For remaining two points, TR has x > y (so y - x is smaller), BL has y > x (y - x is larger)
  remaining.sort((a, b) => a.y - a.x - (b.y - b.x));
  const tr = remaining[0];
  const bl = remaining[1];

  return [tl, tr, br, bl];
}

/**
 * High-speed fallback: computes bounding quadrilateral of brightest receipt region
 */
function computeBrightRegionFallback(imageData, w, h) {
  const data = imageData.data;
  const colBright = new Float32Array(w);
  const rowBright = new Float32Array(h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      colBright[x] += lum;
      rowBright[y] += lum;
    }
  }

  let minCol = Math.max(Math.round(w * 0.05), 0);
  let maxCol = Math.min(Math.round(w * 0.95), w);
  let minRow = Math.max(Math.round(h * 0.03), 0);
  let maxRow = Math.min(Math.round(h * 0.97), h);

  const avgColLum = colBright.reduce((a, b) => a + b, 0) / (w * h);
  const thresh = avgColLum * 0.95;

  for (let x = 0; x < w * 0.4; x++) {
    if (colBright[x] / h > thresh) {
      minCol = x;
      break;
    }
  }
  for (let x = w - 1; x > w * 0.6; x--) {
    if (colBright[x] / h > thresh) {
      maxCol = x;
      break;
    }
  }

  for (let y = 0; y < h * 0.3; y++) {
    if (rowBright[y] / w > thresh) {
      minRow = y;
      break;
    }
  }
  for (let y = h - 1; y > h * 0.7; y--) {
    if (rowBright[y] / w > thresh) {
      maxRow = y;
      break;
    }
  }

  return [
    { x: minCol, y: minRow },
    { x: maxCol, y: minRow },
    { x: maxCol, y: maxRow },
    { x: minCol, y: maxRow },
  ];
}
