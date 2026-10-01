/**
 * Utilities for decoding HEIC and PDF documents into standard HTML canvas / Blobs
 */

export async function convertHeicToJpeg(file: File | Blob): Promise<Blob> {
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  });
  return Array.isArray(result) ? result[0] : result;
}

export async function renderPdfToBlobs(file: File | Blob): Promise<{ blob: Blob; pageNumber: number }[]> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Set worker source to CDN matching installed pdfjs-dist version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages: { blob: Blob; pageNumber: number }[] = [];

  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High DPI for crisp OCR
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.92);
    });

    pages.push({ blob, pageNumber: i });
  }

  return pages;
}

export async function normalizeFileInput(file: File): Promise<File[]> {
  const name = file.name.toLowerCase();
  
  // 1. HEIC / HEIF
  if (name.endsWith('.heic') || name.endsWith('.heif') || file.type === 'image/heic') {
    const jpegBlob = await convertHeicToJpeg(file);
    const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
    return [new File([jpegBlob], newName, { type: 'image/jpeg' })];
  }

  // 2. PDF Document
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pageBlobs = await renderPdfToBlobs(file);
    return pageBlobs.map((p, idx) => {
      const pageName = file.name.replace(/\.pdf$/i, `_page_${idx + 1}.jpg`);
      return new File([p.blob], pageName, { type: 'image/jpeg' });
    });
  }

  return [file];
}
