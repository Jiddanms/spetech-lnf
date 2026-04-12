
// utils/qrgenerator.js
// QR poster generator for Spetech Lost and Found Web
//
// Responsibilities:
// - Generate QR codes (SVG or PNG data) for predefined reporting locations.
// - Save QR assets into frontend assets folder (frontend/assets/qrcodes) or uploads folder.
// - Optionally create a simple HTML poster file that embeds the QR and location label.
// - Defensive, synchronous-friendly API for use in server routes or CLI tasks.
//
// Usage examples:
//   const qg = require('./utils/qrgenerator');
//   await qg.ensureDirs();
//   const svgPath = await qg.generateQrSvg('Gedung A');
//   const posterPath = await qg.generatePosterHtml('Gedung A', { title: 'Laporkan Barang - Gedung A' });
//
// Notes:
// - This module uses the `qrcode` package to produce SVG/PNG data URIs.
// - For PNG file output, it uses the data URI produced by qrcode and decodes it to binary.
// - Keep dependencies minimal: install `qrcode` and `fs-extra` in your project.
//     npm install qrcode fs-extra
//
// - The generated QR encodes a reporting URL pattern: `${baseUrl}/report?location=${encodeURIComponent(location)}`
//   Adjust `baseUrl` when integrating with a deployed server.

const path = require('path');
const fs = require('fs-extra');
const QRCode = require('qrcode');

const APP_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ASSETS = path.join(APP_ROOT, 'frontend', 'assets', 'qrcodes');
const UPLOADS_DIR = path.join(APP_ROOT, 'uploads');

// Allowed locations (must match blueprint)
const ALLOWED_LOCATIONS = [
  'Gedung A',
  'Gedung B',
  'Gedung C',
  'Lapangan Upacara',
  'Lapangan Basket',
  'Lapangan Tenis',
  'Koperasi',
  'Kantin'
];

// Default base URL encoded into QR codes (adjust in production)
const DEFAULT_BASE_URL = process.env.SPETECH_BASE_URL || 'https://example.com'; // replace when deploying

// Ensure directories exist
async function ensureDirs() {
  await fs.ensureDir(FRONTEND_ASSETS);
  await fs.ensureDir(UPLOADS_DIR);
  return { frontend: FRONTEND_ASSETS, uploads: UPLOADS_DIR };
}

// Validate location against allowed list
function validateLocation(location) {
  if (!location) return false;
  const normalized = String(location).trim();
  return ALLOWED_LOCATIONS.some(l => l.toLowerCase() === normalized.toLowerCase());
}

// Build the URL encoded into the QR code
function buildReportUrl(location, baseUrl = DEFAULT_BASE_URL) {
  const loc = encodeURIComponent(String(location).trim());
  // Use a clear query param so backend can route: /report?location=Gedung%20A
  return `${baseUrl.replace(/\/$/, '')}/report?location=${loc}`;
}

/**
 * generateQrSvg(location, options)
 * - location: one of ALLOWED_LOCATIONS
 * - options: { size: number (px), margin: number, colorDark, colorLight, outputDir }
 * Returns: absolute path to saved SVG file
 */
async function generateQrSvg(location, options = {}) {
  if (!validateLocation(location)) {
    throw new Error(`Lokasi tidak valid: ${location}`);
  }
  await ensureDirs();

  const {
    size = 300,
    margin = 2,
    colorDark = '#000000',
    colorLight = '#ffffff',
    outputDir = FRONTEND_ASSETS
  } = options;

  const url = buildReportUrl(location, options.baseUrl);
  const fileNameSafe = String(location).replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '').toLowerCase();
  const fileName = `qr_${fileNameSafe}.svg`;
  const outPath = path.join(outputDir, fileName);

  // Generate SVG string
  const svgString = await QRCode.toString(url, {
    type: 'svg',
    width: size,
    margin,
    color: { dark: colorDark, light: colorLight }
  });

  // Wrap with minimal viewbox/style to ensure consistent sizing
  const wrappedSvg = svgString.replace('<svg', `<svg role="img" aria-label="QR code ${location}"`);

  await fs.writeFile(outPath, wrappedSvg, 'utf8');
  return outPath;
}

/**
 * generateQrPng(location, options)
 * - Generates PNG file from QR data URI and saves to outputDir
 * - options: { size, margin, outputDir }
 * Returns: absolute path to saved PNG file
 */
async function generateQrPng(location, options = {}) {
  if (!validateLocation(location)) {
    throw new Error(`Lokasi tidak valid: ${location}`);
  }
  await ensureDirs();

  const {
    size = 300,
    margin = 2,
    outputDir = FRONTEND_ASSETS
  } = options;

  const url = buildReportUrl(location, options.baseUrl);
  const fileNameSafe = String(location).replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '').toLowerCase();
  const fileName = `qr_${fileNameSafe}.png`;
  const outPath = path.join(outputDir, fileName);

  // Generate data URL (PNG)
  const dataUrl = await QRCode.toDataURL(url, { width: size, margin });
  // dataUrl: "data:image/png;base64,...."
  const base64 = dataUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(outPath, buffer);
  return outPath;
}

/**
 * generatePosterHtml(location, options)
 * - Creates a simple HTML poster file that embeds the generated SVG (or PNG) and includes title/description.
 * - options: { title, subtitle, qrSvgPath, qrPngPath, outputDir, includeDownloadLink }
 * Returns: absolute path to saved HTML poster
 */
async function generatePosterHtml(location, options = {}) {
  if (!validateLocation(location)) {
    throw new Error(`Lokasi tidak valid: ${location}`);
  }
  await ensureDirs();

  const {
    title = `QR Pelaporan - ${location}`,
    subtitle = 'Scan untuk melapor barang hilang/temuan',
    outputDir = FRONTEND_ASSETS,
    includeDownloadLink = true,
    baseUrl = DEFAULT_BASE_URL
  } = options;

  // Ensure QR SVG exists (generate if not provided)
  let qrSvgPath = options.qrSvgPath;
  if (!qrSvgPath) {
    qrSvgPath = await generateQrSvg(location, { baseUrl });
  }

  // Use relative path from outputDir for embedding
  const relSvg = path.relative(outputDir, qrSvgPath).split(path.sep).join('/');

  const fileNameSafe = String(location).replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '').toLowerCase();
  const posterFile = `poster_${fileNameSafe}.html`;
  const posterPath = path.join(outputDir, posterFile);

  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--bg:#0f1720;--card:#111827;--accent:#2ea6ff;--muted:#9aa6b2;--white:#fff}
    body{margin:0;font-family:Inter,system-ui,Arial;background:var(--bg);color:var(--white);display:flex;align-items:center;justify-content:center;height:100vh}
    .poster{background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent);padding:28px;border-radius:12px;max-width:720px;width:92%;box-shadow:0 12px 40px rgba(0,0,0,0.6)}
    .header{display:flex;align-items:center;gap:16px}
    .title{font-size:20px;font-weight:800}
    .subtitle{color:var(--muted);font-size:13px;margin-top:6px}
    .qr-wrap{display:flex;align-items:center;justify-content:center;margin-top:18px}
    .qr-wrap svg{width:320px;height:320px}
    .meta{display:flex;justify-content:space-between;align-items:center;margin-top:12px;color:var(--muted);font-size:13px}
    a.btn{background:var(--accent);color:#042033;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:700}
  </style>
</head>
<body>
  <div class="poster">
    <div class="header">
      <div>
        <div class="title">${escapeHtml(title)}</div>
        <div class="subtitle">${escapeHtml(subtitle)}</div>
      </div>
    </div>
    <div class="qr-wrap">
      <!-- Embedded SVG -->
      ${await fs.readFile(qrSvgPath, 'utf8')}
    </div>
    <div class="meta">
      <div>Lokasi: <strong>${escapeHtml(location)}</strong></div>
      <div>
        ${includeDownloadLink ? `<a class="btn" href="${relSvg}" download="qr_${fileNameSafe}.svg">Download SVG</a>` : ''}
      </div>
    </div>
    <div style="margin-top:10px;color:var(--muted);font-size:12px">Generated by Spetech LNF QR Generator</div>
  </div>
</body>
</html>`;

  await fs.writeFile(posterPath, html, 'utf8');
  return posterPath;
}

/* Utility: escape HTML for poster content */
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Exported API */
module.exports = {
  ALLOWED_LOCATIONS,
  DEFAULT_BASE_URL,
  ensureDirs,
  validateLocation,
  buildReportUrl,
  generateQrSvg,
  generateQrPng,
  generatePosterHtml
};
