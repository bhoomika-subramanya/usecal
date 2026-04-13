#!/usr/bin/env node
/**
 * scripts/generate-icons.cjs
 *
 * Generates all Tauri-required icon files using only Node.js built-ins
 * (no npm packages needed). Produces a yellow-gradient circle with a
 * white diagonal annotation stroke — replace with your own brand art by:
 *
 *   1. Place a 1024×1024 PNG at:  src-tauri/icons/icon-source.png
 *   2. Run: npx @tauri-apps/cli icon src-tauri/icons/icon-source.png
 *
 * Required outputs:
 *   icons/32x32.png          – Windows / Linux small icon
 *   icons/128x128.png        – Linux app icon
 *   icons/128x128@2x.png     – macOS HiDPI (256×256 px)
 *   icons/icon.png           – Tray icon (512×512)
 *   icons/icon.ico           – Windows installer icon
 *   icons/icon.icns          – macOS bundle icon
 */

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'src-tauri', 'icons');

// ── CRC-32 (needed by PNG chunk format) ─────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG encoder ──────────────────────────────────────────────────────────────

function pngChunk(type, data) {
  const typeB  = Buffer.from(type, 'ascii');
  const lenB   = Buffer.allocUnsafe(4);
  lenB.writeUInt32BE(data.length, 0);
  const crcIn  = Buffer.concat([typeB, data]);
  const crcB   = Buffer.allocUnsafe(4);
  crcB.writeUInt32BE(crc32(crcIn), 0);
  return Buffer.concat([lenB, typeB, data, crcB]);
}

const PNG_SIG = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);

/**
 * Build a PNG from a pixel function: (x, y, w, h) → [r, g, b, a] (0-255 each)
 */
function makePNG(width, height, getPixel) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 6; // color type: RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  // Raw scanlines: [filter_byte=0, R, G, B, A, R, G, B, A, …]
  const rowStride = 1 + width * 4;
  const raw = Buffer.allocUnsafe(height * rowStride);
  for (let y = 0; y < height; y++) {
    raw[y * rowStride] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const off = y * rowStride + 1 + x * 4;
      raw[off]     = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([PNG_SIG, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

// ── Icon design ──────────────────────────────────────────────────────────────
// Yellow-to-amber gradient circle with a white diagonal annotation stroke.

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }

function iconPixel(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const radius = w * 0.46;

  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Transparent outside the circle
  if (dist > radius + 1) return [0, 0, 0, 0];

  // Edge anti-alias
  const edgeAlpha = clamp(radius - dist + 1, 0, 1);

  // Background gradient: #FACC15 (yellow) → #D97706 (amber) top-left to bottom-right
  const t = (x / w + y / h) / 2;
  const bgR = Math.round(lerp(0xFA, 0xD9, t));
  const bgG = Math.round(lerp(0xCC, 0x77, t));
  const bgB = Math.round(lerp(0x15, 0x06, t));

  // White annotation stroke: diagonal line from (0.68w, 0.22h) to (0.32w, 0.78h)
  const nx = x / w, ny = y / h;
  // Parametric: point on line at param s = (nx - 0.32) / 0.36
  const s = clamp((nx - 0.32) / 0.36, 0, 1);
  const lineX = 0.32 + s * 0.36;
  const lineY = 0.78 - s * 0.56;
  const perpDist = Math.sqrt((nx - lineX) ** 2 + (ny - lineY) ** 2) * w;
  const strokeW = w * 0.055;
  const strokeAlpha = clamp(1 - perpDist / strokeW, 0, 1);

  // Small round tip at bottom-left end of stroke
  const tipDist = Math.sqrt((nx - 0.32) ** 2 + (ny - 0.78) ** 2) * w;
  const tipAlpha = clamp(1 - tipDist / (strokeW * 0.7), 0, 1);
  const penAlpha = Math.max(strokeAlpha, tipAlpha) * 0.92;

  // Compose pen (white) over gradient background
  const r = Math.round(lerp(bgR, 255, penAlpha));
  const g = Math.round(lerp(bgG, 255, penAlpha));
  const b = Math.round(lerp(bgB, 255, penAlpha));
  const a = Math.round(edgeAlpha * 255);

  return [r, g, b, a];
}

// ── ICO encoder ──────────────────────────────────────────────────────────────
// ICO file = 6-byte header + N directory entries (16 bytes each) + N PNG blobs

function makeICO(entries) {
  const count  = entries.length;
  const header = Buffer.allocUnsafe(6);
  header.writeUInt16LE(0,     0); // reserved
  header.writeUInt16LE(1,     2); // type = ICO
  header.writeUInt16LE(count, 4);

  const dirs  = [];
  let offset = 6 + count * 16;
  for (const { size, data } of entries) {
    const dir = Buffer.allocUnsafe(16);
    dir[0] = size >= 256 ? 0 : size; // 0 means 256
    dir[1] = size >= 256 ? 0 : size;
    dir[2] = 0;                       // color count (0 = full color)
    dir[3] = 0;                       // reserved
    dir.writeUInt16LE(1,            4); // color planes
    dir.writeUInt16LE(32,           6); // bits per pixel
    dir.writeUInt32LE(data.length,  8);
    dir.writeUInt32LE(offset,      12);
    offset += data.length;
    dirs.push(dir);
  }
  return Buffer.concat([header, ...dirs, ...entries.map(e => e.data)]);
}

// ── ICNS encoder ─────────────────────────────────────────────────────────────
// ICNS = "icns" magic + 4-byte file size + sequence of typed chunks

const ICNS_TYPE = { 32: 'icp5', 64: 'icp6', 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };

function makeICNS(entries) {
  const chunks = entries.map(({ size, data }) => {
    const type = ICNS_TYPE[size];
    if (!type) return null;
    const hdr = Buffer.allocUnsafe(8);
    Buffer.from(type, 'ascii').copy(hdr, 0);
    hdr.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([hdr, data]);
  }).filter(Boolean);

  const body   = Buffer.concat(chunks);
  const header = Buffer.allocUnsafe(8);
  Buffer.from('icns', 'ascii').copy(header, 0);
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

  const sizes  = [32, 64, 128, 256, 512, 1024];
  const pngMap = {};

  console.log('Generating Universal Annotator icons…\n');
  for (const size of sizes) {
    process.stdout.write(`  ${size}×${size}… `);
    pngMap[size] = makePNG(size, size, iconPixel);
    console.log('done');
  }

  // Required by tauri.conf.json
  fs.writeFileSync(path.join(ICONS_DIR, '32x32.png'),       pngMap[32]);
  fs.writeFileSync(path.join(ICONS_DIR, '128x128.png'),     pngMap[128]);
  fs.writeFileSync(path.join(ICONS_DIR, '128x128@2x.png'),  pngMap[256]); // 256px = @2x of 128
  fs.writeFileSync(path.join(ICONS_DIR, 'icon.png'),        pngMap[512]); // tray icon

  // Windows ICO — embed 32, 128, 256
  const icoEntries = [32, 128, 256].map(s => ({ size: s, data: pngMap[s] }));
  fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), makeICO(icoEntries));

  // macOS ICNS — embed all sizes
  const icnsEntries = [32, 64, 128, 256, 512, 1024].map(s => ({ size: s, data: pngMap[s] }));
  fs.writeFileSync(path.join(ICONS_DIR, 'icon.icns'), makeICNS(icnsEntries));

  console.log(`\n✓  Icons written to ${ICONS_DIR}\n`);
  console.log('To use your own brand art:');
  console.log('  1. Place a 1024×1024 PNG at: src-tauri/icons/icon-source.png');
  console.log('  2. Run: npx @tauri-apps/cli icon src-tauri/icons/icon-source.png');
}

main();
