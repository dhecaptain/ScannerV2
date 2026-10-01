# ReceiptLens 🧾🔍

**Production-ready OCR tool that extracts line items, prices, discounts, and taxes from receipts and financial documents, exporting them directly to CSV and formatted Excel (.xlsx).**

Powered by Google Gemini 2.5 Flash / 2.5 Pro Vision with client-side Tesseract.js fallback for offline and rate-limited scenarios.

---

## Features

- **Primary Extraction Engine (Gemini 2.5 Flash & Pro)**: Structured JSON output with schema enforcement, line item splitting, weighted item decimal capture (e.g. `0.190 KG × 399.00 = 75.81`), pen strike-through detection, discount reconciliation, and self-verifying math checks.
- **Robust Client Preprocessing**:
  - Auto-orientation & EXIF correction
  - Quadrilateral edge detection & perspective transform (flattens crumpled/skewed thermal paper)
  - Interactive 4-corner crop adjustment modal with guideline grid
  - Lighting enhancement: low-light boost, glare mitigation, and mild sharpening (no aggressive binarization to preserve thermal print nuances)
  - Blurriness detection via Laplacian variance
  - Downscales longest side $\le 2000$px and compresses to $\approx 85\%$ JPEG ($\le 4.5$MB payload limit)
- **Tesseract.js Fallback**: Seamless client-side OCR engine when offline or rate-limited, badged as *Basic mode*.
- **Comprehensive Results Table**:
  - Inline editing of names, quantities, unit prices, line totals, VAT codes, and strike-throughs
  - Low-confidence cells flagged in yellow ($<0.8$)
  - Math validation checks: `quantity × unit_price ≈ line_total` and line item sum vs printed grand total
  - Split-view zoom, pan, and rotate
- **Multi-File Batch Queue**: Process multiple receipts with concurrency limit of 3 and exponential backoff retry.
- **Flexible "Extract More" & Custom Fields**:
  - Presets: Cashier, Customer Name, Payment Details, VAT breakdown, Rewarded Discounts, Loyalty points, Item codes, Barcode/receipt number
  - Custom field definitions saved to `localStorage`
  - Free-text *"Ask about this document"* box that queries Gemini with the receipt image and appends answers
- **Universal Export**:
  - **Excel (.xlsx)**: Sheet 1 "Items" with frozen header, auto-fit columns, and `=SUM(...)` formula row; Sheet 2 "Receipts" summary
  - **CSV**: UTF-8 with BOM (`\uFEFF`) ensuring Microsoft Excel opens symbols and currency cleanly without encoding errors
  - **TSV**: 1-click clipboard copy for instant paste into Google Sheets or Excel
- **PWA & Mobile Ready**: Installable Progressive Web App with service worker, camera scanner with live framing overlay, dark/light theme.

---

## Tech Stack

- **Frontend**: Next.js 14+ / React 19, TypeScript, Tailwind CSS, Lucide Icons, Zustand, React Dropzone.
- **Backend / Serverless**: Next.js API Routes / Vercel Serverless Functions (`/api/extract`), Express dev server.
- **AI SDK**: `@google/genai` TypeScript SDK with structured JSON schemas.
- **OCR Fallback**: `tesseract.js`.
- **Spreadsheets**: `xlsx` (SheetJS).

---

## Local Development Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repo-url>
   cd receiptlens
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini API Key:
   ```env
   GEMINI_API_KEY="your-gemini-api-key-here"
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Vercel Deployment Guide (Zero Extra Config)

1. **Push to GitHub**:
   Push your repository to GitHub, GitLab, or Bitbucket.

2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and select your repository.
   - Framework Preset: **Vite** or **Other**.
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Add Environment Variable**:
   In the Vercel project settings under **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Google Gemini API key.

4. **Deploy**:
   Click **Deploy**. Vercel will automatically provision the serverless function `/api/extract` from `api/extract.ts` with `maxDuration = 60` and `4.5mb` payload limits.

---

## How to Switch Models

ReceiptLens supports one-click model switching from the top header:
- **Fast Mode (Default)**: Uses `gemini-2.5-flash` for near-instant OCR parsing.
- **High Accuracy Mode**: Toggle **2.5 Pro** in the header to use `gemini-2.5-pro` with deep reasoning for tough, faded, or handwritten receipts.

---

## Privacy Notice

- All receipt images are processed **in-memory only**.
- Images are never stored on the server or logged to disk.
- EXIF GPS metadata is automatically stripped before transmission.
