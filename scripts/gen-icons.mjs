// Dependency-free PNG icon generator for the PWA.
// Draws the app's green brand mark (layered diamonds) at several sizes.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ── PNG encoding ──
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── geometry helpers ──
const clamp01 = v => Math.max(0, Math.min(1, v));
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp01(t);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function over(rgba, idx, r, g, b, a) {
  // composite (r,g,b,a in 0..1 alpha) over existing opaque pixel
  rgba[idx]     = Math.round(rgba[idx]     * (1 - a) + r * a);
  rgba[idx + 1] = Math.round(rgba[idx + 1] * (1 - a) + g * a);
  rgba[idx + 2] = Math.round(rgba[idx + 2] * (1 - a) + b * a);
}

// ── draw one icon ──
function makeIcon(size, { rounded, glyphScale = 1 }) {
  const rgba = Buffer.alloc(size * size * 4);
  const top = [26, 26, 34], bot = [8, 8, 12];   // near-black tile with a soft top light
  const radius = rounded ? size * 0.225 : 0;
  const hx = size / 2, hy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let alpha = 1;
      if (rounded) {
        const qx = Math.abs(x + 0.5 - hx) - (hx - radius);
        const qy = Math.abs(y + 0.5 - hy) - (hy - radius);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
        alpha = clamp01(0.5 - outside);
      }
      const t = clamp01(y / size);
      const R = Math.round(top[0] + (bot[0] - top[0]) * t);
      const G = Math.round(top[1] + (bot[1] - top[1]) * t);
      const B = Math.round(top[2] + (bot[2] - top[2]) * t);
      rgba[idx] = R; rgba[idx + 1] = G; rgba[idx + 2] = B; rgba[idx + 3] = Math.round(alpha * 255);
    }
  }

  // "V" chevron in a 32-unit grid, centered, scaled
  const g = size / 32 * glyphScale;
  const off = (size - 32 * g) / 2;
  const gx = u => off + u * g;
  const gy = v => off + v * g;
  const stroke = 3.4 * g, half = stroke / 2;
  const aa = Math.max(1, g * 0.9);
  const segs = [
    [[8.6, 10.2], [16, 22.2]],
    [[23.4, 10.2], [16, 22.2]],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const px = x + 0.5, py = y + 0.5;
      let dmin = Infinity;
      for (const [a, b] of segs) dmin = Math.min(dmin, distToSeg(px, py, gx(a[0]), gy(a[1]), gx(b[0]), gy(b[1])));
      const cov = clamp01((half - dmin) / aa + 0.5);
      if (cov > 0) over(rgba, idx, 255, 255, 255, cov);
    }
  }
  return encodePNG(size, size, rgba);
}

const targets = [
  { name: 'icon-192.png', size: 192, rounded: true },
  { name: 'icon-512.png', size: 512, rounded: true },
  { name: 'maskable-512.png', size: 512, rounded: false, glyphScale: 0.66 },
  { name: 'apple-touch-180.png', size: 180, rounded: false },
  { name: 'favicon-32.png', size: 32, rounded: true },
];
for (const t of targets) {
  fs.writeFileSync(path.join(OUT, t.name), makeIcon(t.size, t));
  console.log('wrote icons/' + t.name);
}
