// Generates the PWA PNG icons (no dependencies). Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const G1 = [127, 140, 245];
const G2 = [169, 139, 242];
const DOT = [143, 139, 244];
const grad = (u, v) => {
  const t = (u + v) / 2;
  return G1.map((c, i) => Math.round(c + (G2[i] - c) * t));
};
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const S = 4; // supersampling
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / (S * S)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// shapes in unit space, scaled around center by `k`
function bubble(u, v, k) {
  const x = (u - 0.5) / k + 0.5;
  const y = (v - 0.5) / k + 0.5;
  const inEllipse = ((x - 0.5) / 0.36) ** 2 + ((y - 0.47) / 0.3) ** 2 <= 1;
  // tail: triangle bottom-left
  const inTail = (() => {
    const ax = 0.27, ay = 0.66, bx = 0.42, by = 0.72, cx = 0.22, cy = 0.86;
    const d = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    const d1 = d(x, y, ax, ay, bx, by), d2 = d(x, y, bx, by, cx, cy), d3 = d(x, y, cx, cy, ax, ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  })();
  const dot = [0.34, 0.5, 0.66].some((cx) => (x - cx) ** 2 + (y - 0.47) ** 2 <= 0.048 ** 2);
  if (dot) return 'dot';
  return inEllipse || inTail ? 'bubble' : null;
}

function roundedSquare(u, v, r) {
  const cx = Math.min(Math.max(u, r), 1 - r);
  const cy = Math.min(Math.max(v, r), 1 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}

const icon = (rounded, k) => (u, v) => {
  if (rounded && !roundedSquare(u, v, 0.22)) return [0, 0, 0, 0];
  const s = bubble(u, v, k);
  if (s === 'bubble') return [...WHITE, 1];
  if (s === 'dot') return [...DOT, 1];
  return [...grad(u, v), 1];
};

const out = 'public/';
writeFileSync(out + 'pwa-192x192.png', png(192, icon(false, 0.82)));
writeFileSync(out + 'pwa-512x512.png', png(512, icon(false, 0.82)));
writeFileSync(out + 'maskable-512x512.png', png(512, icon(false, 0.6)));
writeFileSync(out + 'apple-touch-icon.png', png(180, icon(false, 0.72)));
writeFileSync(out + 'pwa-64x64.png', png(64, icon(true, 0.82)));
console.log('icons written');
