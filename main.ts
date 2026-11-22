// One ripe strawberry, drawn programmatically.
// make.fun entry: the-picture-that-tastes-of-one-20261122-2047
// "The picture that tastes of one ingredient" — a single strawberry.
// Node 22, stdlib only, no network. Writes a deterministic 1024x1024 PNG.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname } from "node:path";

const W = 1024;
const H = 1024;
const img = Buffer.alloc(W * H * 4);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
// Deterministic hash noise (no Math.random anywhere).
const hash2 = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function setPx(x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  img[i] = r;
  img[i + 1] = g;
  img[i + 2] = b;
  img[i + 3] = 255;
}

function blendPx(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  if (a > 1) a = 1;
  const i = (y * W + x) * 4;
  const ia = 1 - a;
  img[i] = r * a + img[i] * ia;
  img[i + 1] = g * a + img[i + 1] * ia;
  img[i + 2] = b * a + img[i + 2] * ia;
  img[i + 3] = 255;
}

// Filled ellipse, optionally with per-pixel alpha falloff at the rim.
function ellipse(cx, cy, rx, ry, r, g, b, a = 1, soft = 0) {
  const x0 = Math.max(0, Math.floor(cx - rx - 1));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx + 1));
  const y0 = Math.max(0, Math.floor(cy - ry - 1));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry + 1));
  for (let y = y0; y <= y1; y++) {
    const ny = (y - cy) / ry;
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      let alpha = a;
      if (soft > 0) alpha = a * clamp((1 - d) / soft, 0, 1);
      if (alpha >= 1) setPx(x, y, r, g, b);
      else blendPx(x, y, r, g, b, alpha);
    }
  }
}

// ---------- 1. Warm cream background ----------
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - 512) / 512;
    const dy = (y - 470) / 512;
    const d = Math.sqrt(dx * dx + dy * dy);
    const t = clamp(d, 0, 1);
    // Center #f8e6cb -> edges #eec193 (smooth radial gradient, no per-pixel
    // noise: it would bloat the PNG past the 1 MiB limit).
    const r = lerp(248, 238, t);
    const g = lerp(230, 193, t);
    const b = lerp(203, 147, t);
    setPx(x, y, clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
  }
}

// ---------- 2. White plate ----------
ellipse(512, 872, 388, 94, 226, 206, 180); // rim
ellipse(512, 870, 370, 84, 253, 251, 245); // plate face
// Soft contact shadow where the berry will sit.
ellipse(512, 888, 235, 46, 150, 90, 70, 0.16, 0.55);

// ---------- 3. Strawberry body ----------
// Outline: (y, half-width) control points, top to tip.
const OUTLINE = [
  [258, 30], [282, 140], [315, 215], [365, 272], [425, 298],
  [495, 300], [570, 278], [650, 240], [725, 190], [795, 128],
  [850, 72], [885, 28], [896, 0],
];
function halfWidth(y) {
  if (y <= OUTLINE[0][0]) return OUTLINE[0][1];
  for (let i = 0; i < OUTLINE.length - 1; i++) {
    const [y0, w0] = OUTLINE[i];
    const [y1, w1] = OUTLINE[i + 1];
    if (y >= y0 && y <= y1) {
      const t = sstep(y0, y1, y);
      return lerp(w0, w1, t);
    }
  }
  return 0;
}

const TOP = 258;
const BOT = 896;
for (let y = TOP; y <= BOT; y++) {
  const hw = halfWidth(y);
  if (hw <= 0) continue;
  const ny = (y - TOP) / (BOT - TOP);
  for (let x = Math.ceil(512 - hw); x <= Math.floor(512 + hw); x++) {
    const nx = (x - 512) / hw; // -1 (left) .. +1 (right)
    // Light comes from the upper left: bright there, deep red lower right.
    let lit = 0.82 - 0.42 * nx - 0.22 * (ny - 0.25);
    // Soft vertical sheen bands, like a glossy skin.
    lit += 0.035 * Math.sin(y * 0.11 + nx * 3.0);
    lit = clamp(lit, 0.18, 1.18);
    // Smooth low-frequency skin texture (compresses well in PNG).
    const n = 4.5 * Math.sin(x * 0.045 + 1.7) * Math.sin(y * 0.06 + 0.4);
    const r = clamp(138 + 118 * lit + n, 0, 255);
    const g = clamp(16 + 34 * lit + n * 0.6, 0, 255);
    const b = clamp(26 + 30 * lit + n * 0.6, 0, 255);
    setPx(x, y, r, g, b);
  }
}

// Big soft specular highlight, upper left of the body.
for (let y = 300; y <= 540; y++) {
  for (let x = 320; x <= 560; x++) {
    const dx = (x - 428) / 105;
    const dy = (y - 415) / 140;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1) continue;
    const a = 0.34 * Math.exp(-d2 * 2.2);
    blendPx(x, y, 255, 205, 205, a);
  }
}

// ---------- 4. Pale-gold seeds, in rows that follow the body contour ----------
function seed(cx, cy) {
  // Tiny pit shadow first, then the golden seed.
  ellipse(cx + 1, cy + 3, 6.5, 9.5, 120, 30, 35, 0.28, 0.6);
  ellipse(cx, cy, 5.5, 8.5, 238, 196, 96);
  ellipse(cx - 1, cy - 2, 3.5, 5.5, 252, 228, 150);
}
let row = 0;
for (let y = 332; y <= 832; y += 52, row++) {
  const hw = halfWidth(y) - 30;
  if (hw < 20) continue;
  const step = 62;
  const count = Math.floor(hw / step);
  const off = row % 2 === 0 ? 0 : step / 2;
  for (let k = -count; k <= count; k++) {
    const x = 512 + k * step + off;
    if (Math.abs(x - 512) > hw) continue;
    seed(Math.round(x), y);
  }
}

// ---------- 5. Green calyx: pointed leaves fanning out from the top ----------
function leaf(angleDeg, len, wid, shade) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const bx = 512;
  const by = 272;
  const x0 = Math.max(0, Math.floor(bx - len));
  const x1 = Math.min(W - 1, Math.ceil(bx + len));
  const y0 = Math.max(0, Math.floor(by - len));
  const y1 = Math.min(H - 1, Math.ceil(by + len));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x - bx;
      const py = y - by;
      const u = px * dx + py * dy; // along the leaf
      const v = -px * dy + py * dx; // across the leaf
      if (u < 2 || u > len) continue;
      const t = u / len;
      const half = wid * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * t)), 0.9);
      if (Math.abs(v) > half) continue;
      const base = 1 - t * 0.45;
      const vein = Math.abs(v) < 1.6 ? 1.25 : 1;
      const r = clamp(36 * base * shade * vein, 0, 255);
      const g = clamp(122 * base * shade * vein, 0, 255);
      const b = clamp(48 * base * shade * vein, 0, 255);
      setPx(x, y, r, g, b);
    }
  }
}
leaf(-72, 128, 17, 0.9);
leaf(-48, 148, 19, 1.0);
leaf(-24, 158, 20, 1.05);
leaf(0, 150, 20, 1.1);
leaf(24, 156, 20, 1.05);
leaf(48, 146, 19, 1.0);
leaf(72, 126, 17, 0.9);
// Cap that hides the leaf bases.
ellipse(512, 272, 58, 24, 30, 104, 42);
ellipse(512, 268, 40, 16, 38, 122, 50);

// Short stem, leaning slightly.
for (let t = 0; t <= 1.001; t += 0.02) {
  const sx = Math.round(512 - t * 16);
  const sy = Math.round(262 - t * 52);
  const rr = 7 - t * 2.5;
  ellipse(sx, sy, rr, rr, Math.round(lerp(96, 70, t)), Math.round(lerp(110, 96, t)), 52);
}

// ---------- 5b. Dew drops: clear beads with a bright catch-light ----------
function dew(cx, cy, r) {
  if (Math.abs(cx - 512) > halfWidth(cy) - 14) return;
  ellipse(cx, cy, r, r, 225, 240, 250, 0.30, 0.7);
  ellipse(cx, cy + r * 0.45, r * 0.8, r * 0.45, 120, 40, 45, 0.18, 0.7);
  ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.32, r * 0.32, 255, 255, 255, 0.85, 0.5);
}
dew(604, 468, 11);
dew(418, 558, 9);
dew(662, 618, 12);
dew(382, 688, 8);
dew(558, 742, 10);
dew(698, 482, 8);
dew(468, 428, 7);
dew(620, 780, 9);

// ---------- 5c. Soft vignette: gently darken the far edges ----------
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - 512) / 724;
    const dy = (y - 512) / 724;
    const d = Math.sqrt(dx * dx + dy * dy);
    const f = 1 - 0.16 * sstep(0.55, 1.05, d);
    if (f >= 0.999) continue;
    const i = (y * W + x) * 4;
    img[i] *= f;
    img[i + 1] *= f;
    img[i + 2] *= f;
  }
}

// ---------- 6. PNG encoding (own encoder: IHDR / IDAT / IEND, CRC32) ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

const outPath = process.argv[2] || "/output/entry.png";
// Build scanlines, picking the smallest filter per row (None / Sub / Up).
const rowBytes = W * 4;
const raw = Buffer.alloc(H * (1 + rowBytes));
const prev = Buffer.alloc(rowBytes);
for (let y = 0; y < H; y++) {
  const row = img.subarray(y * rowBytes, (y + 1) * rowBytes);
  const cands = [];
  for (const f of [0, 1, 2]) {
    const fb = Buffer.alloc(rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      let v = row[i];
      if (f === 1 && i >= 4) v -= row[i - 4];
      if (f === 2) v -= prev[i];
      fb[i] = v & 0xff;
    }
    let score = 0;
    for (let i = 0; i < rowBytes; i++) {
      const s = fb[i] > 127 ? fb[i] - 256 : fb[i];
      score += s < 0 ? -s : s;
    }
    cands.push([score, f, fb]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  const best = cands[0];
  raw[y * (1 + rowBytes)] = best[1];
  best[2].copy(raw, y * (1 + rowBytes) + 1);
  row.copy(prev);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes)`);
