import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  RotateCw, 
  RotateCcw, 
  Check, 
  Sliders, 
  AlertTriangle, 
  Sparkles, 
  Crop as CropIcon,
  Sun,
  Eye
} from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';
import { Point } from '../types/receipt';
import { detectReceiptCorners, loadImage } from '../utils/imagePreprocessing';

export const CropPerspectiveModal: React.FC = () => {
  const {
    isCropModalOpen,
    cropTargetReceiptId,
    closeCropModal,
    receipts,
    applyCropAndEnhance,
  } = useReceiptStore();

  const receipt = receipts.find(r => r.id === cropTargetReceiptId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [corners, setCorners] = useState<[Point, Point, Point, Point]>([
    { x: 50, y: 50 },
    { x: 350, y: 50 },
    { x: 350, y: 550 },
    { x: 50, y: 550 },
  ]);
  const [activeCornerIdx, setActiveCornerIdx] = useState<number | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [canvasScale, setCanvasScale] = useState<number>(1);
  const [isApplying, setIsApplying] = useState(false);

  // Load image when modal opens
  useEffect(() => {
    if (!isCropModalOpen || !receipt) return;

    const src = receipt.original_file || receipt.image_url;
    loadImage(src).then((img) => {
      setImageElement(img);

      // Determine initial corners
      if (receipt.crop_corners) {
        setCorners(receipt.crop_corners);
      } else {
        const detected = detectReceiptCorners(
          document.createElement('canvas'),
          img.naturalWidth || img.width,
          img.naturalHeight || img.height
        );
        setCorners(detected);
      }
      setRotation(receipt.rotation_angle || 0);
    });
  }, [isCropModalOpen, receipt]);

  // Render canvas with handles
  useEffect(() => {
    if (!imageElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgW = imageElement.naturalWidth || imageElement.width;
    const imgH = imageElement.naturalHeight || imageElement.height;

    // Fit canvas inside container
    const containerW = Math.min(window.innerWidth * 0.85, 750);
    const containerH = Math.min(window.innerHeight * 0.6, 600);
    const scale = Math.min(containerW / imgW, containerH / imgH, 1);
    setCanvasScale(scale);

    canvas.width = imgW * scale;
    canvas.height = imgH * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save and rotate context if needed
    ctx.save();
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    // Draw translucent darkened overlay outside the quadrilateral
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut out quadrilateral
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners[0].x * scale, corners[0].y * scale);
    ctx.lineTo(corners[1].x * scale, corners[1].y * scale);
    ctx.lineTo(corners[2].x * scale, corners[2].y * scale);
    ctx.lineTo(corners[3].x * scale, corners[3].y * scale);
    ctx.closePath();
    ctx.clip();
    // Redraw original inside the polygon
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    // Draw guidelines grid inside polygon
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal 3rds
    for (let i = 1; i <= 2; i++) {
      const u = i / 3;
      const lx = (corners[0].x + (corners[3].x - corners[0].x) * u) * scale;
      const ly = (corners[0].y + (corners[3].y - corners[0].y) * u) * scale;
      const rx = (corners[1].x + (corners[2].x - corners[1].x) * u) * scale;
      const ry = (corners[1].y + (corners[2].y - corners[1].y) * u) * scale;
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
    }
    // Vertical 3rds
    for (let i = 1; i <= 2; i++) {
      const u = i / 3;
      const tx = (corners[0].x + (corners[1].x - corners[0].x) * u) * scale;
      const ty = (corners[0].y + (corners[1].y - corners[0].y) * u) * scale;
      const bx = (corners[3].x + (corners[2].x - corners[3].x) * u) * scale;
      const by = (corners[3].y + (corners[2].y - corners[3].y) * u) * scale;
      ctx.moveTo(tx, ty);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.restore();

    // Draw quadrilateral boundary stroke
    ctx.strokeStyle = '#10b981'; // emerald-500
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(corners[0].x * scale, corners[0].y * scale);
    ctx.lineTo(corners[1].x * scale, corners[1].y * scale);
    ctx.lineTo(corners[2].x * scale, corners[2].y * scale);
    ctx.lineTo(corners[3].x * scale, corners[3].y * scale);
    ctx.closePath();
    ctx.stroke();

    // Draw corner handles
    const handleLabels = ['TL', 'TR', 'BR', 'BL'];
    corners.forEach((pt, idx) => {
      const cx = pt.x * scale;
      const cy = pt.y * scale;

      // Outer ring
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = activeCornerIdx === idx ? '#059669' : '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner dot
      ctx.fillStyle = activeCornerIdx === idx ? '#059669' : '#10b981';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, [imageElement, corners, activeCornerIdx, rotation]);

  // Mouse / Touch handlers for dragging handles
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvasScale;
    const y = (e.clientY - rect.top) / canvasScale;

    // Check which handle is closest
    const threshold = 35 / canvasScale;
    let closestIdx = -1;
    let minD = Infinity;

    corners.forEach((pt, i) => {
      const d = Math.hypot(pt.x - x, pt.y - y);
      if (d < threshold && d < minD) {
        minD = d;
        closestIdx = i;
      }
    });

    if (closestIdx !== -1) {
      setActiveCornerIdx(closestIdx);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeCornerIdx === null || !canvasRef.current || !imageElement) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(imageElement.naturalWidth || imageElement.width, (e.clientX - rect.left) / canvasScale));
    const y = Math.max(0, Math.min(imageElement.naturalHeight || imageElement.height, (e.clientY - rect.top) / canvasScale));

    setCorners((prev) => {
      const updated = [...prev] as [Point, Point, Point, Point];
      updated[activeCornerIdx] = { x: Math.round(x), y: Math.round(y) };
      return updated;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeCornerIdx !== null) {
      setActiveCornerIdx(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleRotate = (delta: number) => {
    setRotation((prev) => ((prev + delta) % 360 + 360) % 360);
  };

  const handleResetCorners = () => {
    if (!imageElement) return;
    const imgW = imageElement.naturalWidth || imageElement.width;
    const imgH = imageElement.naturalHeight || imageElement.height;
    setCorners([
      { x: Math.round(imgW * 0.05), y: Math.round(imgH * 0.03) },
      { x: Math.round(imgW * 0.95), y: Math.round(imgH * 0.03) },
      { x: Math.round(imgW * 0.95), y: Math.round(imgH * 0.97) },
      { x: Math.round(imgW * 0.05), y: Math.round(imgH * 0.97) },
    ]);
  };

  const handleApply = async () => {
    if (!cropTargetReceiptId) return;
    setIsApplying(true);
    try {
      await applyCropAndEnhance(cropTargetReceiptId, corners, rotation);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isCropModalOpen || !receipt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col my-auto max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CropIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Adjust Document Boundary & Perspective
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Drag the 4 corner handles to isolate the receipt paper from tables or notebooks
              </p>
            </div>
          </div>
          <button
            onClick={closeCropModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Display */}
        <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-auto min-h-[350px]">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="cursor-crosshair touch-none shadow-2xl rounded-lg"
          />
        </div>

        {/* Quality diagnostics banner if issues */}
        {receipt.quality_check && (receipt.quality_check.is_blurry || receipt.quality_check.is_dark) && (
          <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              {receipt.quality_check.is_blurry
                ? 'Warning: Image appears soft or blurry (Laplacian variance low). Hold camera steady for thermal print.'
                : 'Notice: Low illumination detected. Adaptive contrast will be boosted automatically.'}
            </span>
          </div>
        )}

        {/* Footer Toolbar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRotate(-90)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 flex items-center gap-1.5 hover:bg-slate-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rotate -90°</span>
            </button>
            <button
              onClick={() => handleRotate(90)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 flex items-center gap-1.5 hover:bg-slate-100"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate +90°</span>
            </button>
            <button
              onClick={handleResetCorners}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 hover:bg-slate-100"
            >
              Full Bounds
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={closeCropModal}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {isApplying ? (
                <span>Warping & Processing...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Apply Crop & Flatten</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
