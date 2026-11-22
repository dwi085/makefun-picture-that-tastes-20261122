// The picture that tastes of one ingredient — one ripe strawberry.
// Drawn entirely in code: 1024x1024 RGBA buffer, own PNG encoder, stdlib only.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname } from "node:path";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 4);

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Deterministic per-pixel speckle, independent of draw order.
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 4;
  if (a >= 255) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    return;
  }
  const sa = a / 255;
  const da = 1 - sa;
  buf[i] = Math.round(r * sa + buf[i] * da);
  buf[i + 1] = Math.round(g * sa + buf[i + 1] * da);
  buf[i + 2] = Math.round(b * sa + buf[i + 2] * da);
  buf[i + 3] = 255;
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, r: number, g: number, b: number, a = 255): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y - cy) / ry;
    const rem = 1 - dy * dy;
    if (rem < 0) continue;
    const dx = rx * Math.sqrt(rem);
    for (let x = Math.floor(cx - dx); x <= Math.ceil(cx + dx); x++) {
      blend(x, y, r, g, b, a);
    }
  }
}

function fillPoly(pts: Array<[number, number]>, r: number, g: number, b: number, a = 255): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((x, z) => x - z);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
        blend(x, y, r, g, b, a);
      }
    }
  }
}

// ---- warm cream backdrop, lighter in the middle ----
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = y / (H - 1);
    const d = Math.hypot(x - 512, y - 470) / 720;
    const glow = Math.max(0, 1 - d) * 26;
    blend(x, y, 243 + glow * 0.4 - t * 12, 216 + glow * 0.35 - t * 26, 168 + glow * 0.3 - t * 40, 255);
  }
}

// ---- white plate, flat ellipse ----
fillEllipse(512, 880, 342, 84, 228, 216, 198, 255);
fillEllipse(512, 876, 324, 74, 253, 251, 247, 255);
// soft contact shadow where the berry sits
fillEllipse(512, 862, 215, 48, 186, 148, 116, 78);
fillEllipse(512, 866, 160, 34, 176, 138, 108, 60);

// ---- strawberry body profile: broad shoulders, tapering tip ----
const PROFILE: Array<[number, number]> = [
  [0, 138], [0.07, 244], [0.18, 300], [0.32, 306], [0.45, 283],
  [0.58, 246], [0.72, 196], [0.84, 138], [0.93, 82], [1, 0],
];
function halfWidth(t: number): number {
  if (t <= 0) return PROFILE[0][1];
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [t0, w0] = PROFILE[i];
    const [t1, w1] = PROFILE[i + 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const s = (1 - Math.cos(u * Math.PI)) / 2;
      return w0 + (w1 - w0) * s;
    }
  }
  return 0;
}

// leaves first, so their bases tuck behind the berry top
function drawLeaf(spreadDeg: number, len: number, wid: number): void {
  const a = (spreadDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const bx = 512;
  const by = 268;
  const tipX = bx + dx * len;
  const tipY = by + dy * len;
  const mx = bx + dx * len * 0.45;
  const my = by + dy * len * 0.45;
  const px_ = Math.cos(a);
  const py = Math.sin(a);
  const outer: Array<[number, number]> = [
    [bx, by],
    [mx + px_ * wid, my + py * wid],
    [tipX, tipY],
    [mx - px_ * wid, my - py * wid],
  ];
  fillPoly(outer, 15, 102, 44, 255);
  const inner: Array<[number, number]> = [
    [bx + dx * 12, by + dy * 12],
    [mx + px_ * wid * 0.45, my + py * wid * 0.45],
    [bx + dx * len * 0.82, by + dy * len * 0.82],
    [mx - px_ * wid * 0.45, my - py * wid * 0.45],
  ];
  fillPoly(inner, 42, 148, 68, 255);
}
drawLeaf(-68, 118, 34);
drawLeaf(-46, 148, 38);
drawLeaf(-23, 168, 40);
drawLeaf(0, 176, 42);
drawLeaf(23, 168, 40);
drawLeaf(46, 148, 38);
drawLeaf(68, 118, 34);

// berry body, scanline by scanline
const TOP = 252;
const BOT = 906;
for (let y = TOP; y <= BOT; y++) {
  const t = (y - TOP) / (BOT - TOP);
  const wobble = 1 + 0.013 * Math.sin(y * 0.09 + 1.3) + 0.008 * Math.sin(y * 0.031 + 0.4);
  const w = halfWidth(t) * wobble;
  for (let x = Math.ceil(512 - w); x <= Math.floor(512 + w); x++) {
    const nx = (x - 512) / 310;
    // top rim dips gently at the shoulders
    if (y < TOP + 46 * nx * nx) continue;
    // glossy highlight upper-left, deep shade lower-right
    const hl = Math.exp(
      -((x - 402) * (x - 402)) / (2 * 150 * 150) - ((y - 398) * (y - 398)) / (2 * 195 * 195),
    );
    const gloss = Math.exp(
      -((x - 432) * (x - 432)) / (2 * 88 * 88) - ((y - 352) * (y - 352)) / (2 * 128 * 128),
    );
    const shade = Math.max(0, nx) * 0.55 + Math.max(0, (y - 250) / 655 - 0.55) * 0.38;
    const n = hash2(x, y) - 0.5;
    const r = clamp(Math.round(226 + 30 * hl + 22 * gloss - 96 * shade + n * 10), 0, 255);
    const g = clamp(Math.round(28 + 24 * hl + 10 * gloss - 15 * shade + n * 5), 0, 255);
    const b = clamp(Math.round(32 + 18 * hl + 8 * gloss - 13 * shade + n * 5), 0, 255);
    blend(x, y, r, g, b, 255);
  }
}

// pale golden achenes following the body contour
for (let row = 0; row < 12; row++) {
  const y = 308 + row * 50;
  const t = (y - TOP) / (BOT - TOP);
  const w = halfWidth(t) - 30;
  if (w < 10) continue;
  const off = row % 2 ? 26 : 0;
  for (let x = 512 - w + off; x <= 512 + w; x += 52) {
    fillEllipse(x + 1, y + 3, 6.5, 9.5, 148, 22, 26, 190);
    fillEllipse(x, y, 5, 7.5, 246, 214, 128, 255);
    fillEllipse(x - 1.5, y - 2.5, 1.8, 2.6, 255, 242, 196, 255);
  }
}

// calyx disc + short stem over the berry top
fillEllipse(512, 274, 80, 30, 14, 94, 40, 255);
fillEllipse(512, 267, 56, 18, 30, 132, 60, 255);
for (let i = 0; i <= 24; i++) {
  const u = i / 24;
  const sx = 512 + u * 14 + 5 * Math.sin(u * Math.PI * 0.5);
  const sy = 272 - u * 102;
  const rad = 5.5 - u * 2.5;
  fillEllipse(sx, sy, rad, rad * 1.4, 96, 74, 30, 255);
}

// clear dew drops on the berry, each with a white sparkle
const DEW: Array<[number, number, number]> = [
  [392, 452, 9], [618, 470, 7], [452, 566, 8], [636, 612, 10],
  [368, 668, 7], [560, 706, 9], [476, 762, 7], [610, 792, 6],
  [428, 330, 6], [560, 360, 8],
];
for (const [dx, dy, dr] of DEW) {
  fillEllipse(dx, dy, dr, dr, 255, 250, 240, 52);
  fillEllipse(dx, dy, dr * 0.72, dr * 0.72, 235, 225, 215, 40);
  fillEllipse(dx - dr * 0.32, dy - dr * 0.38, dr * 0.28, dr * 0.28, 255, 255, 255, 235);
}

// ---- gentle vignette, darker toward the corners ----
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - 512, y - 512) / 724;
    const s = clamp((r - 0.62) / (1.05 - 0.62), 0, 1);
    const f = 1 - 0.17 * s * s * (3 - 2 * s);
    if (f < 1) {
      const i = (y * W + x) * 4;
      buf[i] = Math.round(buf[i] * f);
      buf[i + 1] = Math.round(buf[i + 1] * f);
      buf[i + 2] = Math.round(buf[i + 2] * f);
    }
  }
}

// ---- minimal PNG encoder (signature, IHDR, IDAT, IEND) ----
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const outPath = process.argv[2] ?? "/output/entry.png";
mkdirSync(dirname(outPath), { recursive: true });
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  Buffer.from(buf.buffer, y * W * 4, W * 4).copy(raw, y * (1 + W * 4) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk("IHDR", ihdr),
  pngChunk("IDAT", deflateSync(raw, { level: 9 })),
  pngChunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes)`);
