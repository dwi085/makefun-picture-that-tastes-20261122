// The picture that tastes of one ingredient — one ripe strawberry.
// Drawn fully programmatically: rasterizer + hand-rolled PNG encoder, stdlib only.
// Output: /output/entry.png, 1024x1024.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

// ---------- deterministic PRNG ----------
let seed = 20261122;
function rnd(): number {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- pixel helpers ----------
function setPx(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
}
function getPx(x: number, y: number): [number, number, number] {
  const i = (y * W + x) * 3;
  return [buf[i], buf[i + 1], buf[i + 2]];
}
// blend src color over current pixel with alpha 0..1
function blendPx(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const i = (y * W + x) * 3;
  buf[i] = Math.round(buf[i] * (1 - a) + r * a);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + g * a);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + b * a);
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// ---------- PNG encoder (stdlib zlib) ----------
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(): Buffer {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines, filter 0
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  let len = 0; for (const p of parts) len += p.length;
  const png = new Uint8Array(len);
  let off = 0; for (const p of parts) { png.set(p, off); off += p.length; }
  return Buffer.from(png);
}

// ---------- background: warm cream radial glow + soft vignette ----------
function paintBackground(): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - 512) / 512, dy = (y - 470) / 512;
      const d = Math.sqrt(dx * dx + dy * dy);
      const t = smoothstep(0.15, 1.25, d);
      // center #FFF8EC -> edge #F2CE9C
      const r = Math.round(255 - 13 * t);
      const g = Math.round(248 - 50 * t);
      const b = Math.round(236 - 74 * t);
      setPx(x, y, r, g, b);
    }
  }
  // faint warm sun glow top-left
  for (let y = 0; y < 520; y++) {
    for (let x = 0; x < 560; x++) {
      const dx = (x - 300) / 420, dy = (y - 180) / 420;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) blendPx(x, y, 255, 236, 190, 0.16 * (1 - d));
    }
  }
}

// ---------- plate: soft white ellipse + contact shadow ----------
function paintPlate(): void {
  // contact shadow under the berry
  for (let y = 760; y < 1000; y++) {
    for (let x = 120; x < 904; x++) {
      const dx = (x - 512) / 400, dy = (y - 880) / 62;
      const d = dx * dx + dy * dy;
      if (d < 1) blendPx(x, y, 120, 70, 30, 0.20 * (1 - d) * (1 - d));
    }
  }
  // plate disc
  for (let y = 700; y < 1010; y++) {
    for (let x = 90; x < 934; x++) {
      const dx = (x - 512) / 420, dy = (y - 845) / 130;
      const d = dx * dx + dy * dy;
      if (d < 1) {
        const edge = smoothstep(0.86, 1.0, d);
        blendPx(x, y, 255, 252, 246, 0.92 * (1 - edge * 0.55));
        if (d > 0.9 && d < 0.96) blendPx(x, y, 214, 182, 140, 0.35);
      }
    }
  }
}

// ---------- strawberry body outline (closed Catmull-Rom spline) ----------
const OUTLINE: [number, number][] = [
  [512, 238], [700, 258], [816, 428], [762, 682],
  [512, 908], [262, 682], [208, 428], [324, 258],
];
function catmullRom(pts: [number, number][], samplesPerSeg: number): [number, number][] {
  const out: [number, number][] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < samplesPerSeg; j++) {
      const t = j / samplesPerSeg, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  return out;
}
const BODY = catmullRom(OUTLINE, 60);

// scanline fill of a closed polygon, calling fn(x, y) per inside pixel
function fillPolygon(poly: [number, number][], fn: (x: number, y: number) => void): void {
  let minY = H, maxY = 0;
  for (const [, y] of poly) { minY = Math.min(minY, Math.floor(y)); maxY = Math.max(maxY, Math.ceil(y)); }
  minY = Math.max(0, minY); maxY = Math.min(H - 1, maxY);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k])), x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = x0; x <= x1; x++) fn(x, y);
    }
  }
}
// half-width of the body at a given y (for seed placement)
function bodyHalfWidth(y: number): number {
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < BODY.length; i++) {
    const [x1, y1] = BODY[i];
    const [x2, y2] = BODY[(i + 1) % BODY.length];
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      const x = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
  }
  return lo > hi ? 0 : (hi - lo) / 2;
}

function paintBody(): void {
  fillPolygon(BODY, (x, y) => {
    // light from upper-left: bright glossy red top-left, deep red bottom-right
    const nx = (x - 512) / 320, ny = (y - 560) / 340;
    const light = clamp(0.62 - 0.55 * nx - 0.35 * ny, 0, 1);
    const t = smoothstep(-0.9, 1.0, ny);
    // base: #E51B33 (top) -> #9E0E22 (bottom)
    let r = Math.round(229 - 72 * t + 42 * light);
    let g = Math.round(27 - 13 * t + 26 * light);
    let b = Math.round(51 - 17 * t + 22 * light);
    // subtle flesh texture: fine vertical streaks + grain
    const grain = (rnd() - 0.5) * 10;
    const streak = Math.sin(x * 0.11 + Math.sin(y * 0.02) * 3) * 5;
    r = clamp(Math.round(r + grain + streak), 0, 255);
    g = clamp(Math.round(g + grain * 0.6 + streak * 0.5), 0, 255);
    b = clamp(Math.round(b + grain * 0.6), 0, 255);
    setPx(x, y, r, g, b);
  });
  // rim light on the left edge (juicy gloss edge)
  for (let y = 300; y < 850; y++) {
    const hw = bodyHalfWidth(y);
    if (hw <= 0) continue;
    const cx = 512;
    for (let x = Math.floor(cx - hw); x < cx - hw + 14 && x < W; x++) {
      const a = 0.35 * (1 - (x - (cx - hw)) / 14);
      blendPx(x, y, 255, 120, 130, Math.max(0, a));
    }
  }
}

// ---------- seeds (achenes): golden, in curved rows following the body ----------
function paintSeeds(): void {
  const rows = [300, 360, 420, 482, 545, 610, 675, 740, 800];
  for (const y of rows) {
    const hw = bodyHalfWidth(y);
    if (hw < 40) continue;
    const inset = 34;
    const span = hw - inset;
    const count = Math.max(3, Math.floor(span / 52));
    for (let i = 0; i < count; i++) {
      const fx = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const jitter = (rnd() - 0.5) * 10;
      const sx = 512 + fx * span + jitter;
      const sy = y + (rnd() - 0.5) * 8 + fx * fx * 6;
      // seed: small vertical ellipse, pale gold with darker rim + bright dot
      const rx = 7, ry = 11;
      for (let dy = -ry - 1; dy <= ry + 1; dy++) {
        for (let dx = -rx - 1; dx <= rx + 1; dx++) {
          const e = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          if (e > 1.15) continue;
          const px = Math.round(sx + dx), py = Math.round(sy + dy);
          if (e > 0.85) blendPx(px, py, 196, 120, 40, 0.9);
          else if (e > 0.45) setPx(px, py, 252, 214, 120);
          else setPx(px, py, 255, 232, 160);
        }
      }
      setPx(Math.round(sx - 2), Math.round(sy - 4), 255, 250, 215);
    }
  }
}

// ---------- calyx: green leaves + stem ----------
function leafPoly(cx: number, cy: number, angle: number, len: number, wid: number, r: number, g: number, b: number): void {
  // a pointed leaf: two quadratic edges meeting at the tip
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const px = -dy, py = dx; // perpendicular
  const tipX = cx + dx * len, tipY = cy + dy * len;
  const midX = cx + dx * len * 0.55, midY = cy + dy * len * 0.55;
  const pts: [number, number][] = [];
  for (let t = 0; t <= 1; t += 0.05) {
    const w = Math.sin(t * Math.PI) * wid;
    pts.push([midX * t + cx * (1 - t) + px * w * (1 - t * 0.4), midY * t + cy * (1 - t) + py * w * (1 - t * 0.4)]);
  }
  pts.push([tipX, tipY]);
  for (let t = 1; t >= 0; t -= 0.05) {
    const w = Math.sin(t * Math.PI) * wid;
    pts.push([midX * t + cx * (1 - t) - px * w * (1 - t * 0.4), midY * t + cy * (1 - t) - py * w * (1 - t * 0.4)]);
  }
  fillPolygon(pts, (x, y) => setPx(x, y, r, g, b));
  // centre vein
  for (let t = 0.15; t < 0.95; t += 0.02) {
    const vx = Math.round(cx + dx * len * t), vy = Math.round(cy + dy * len * t);
    blendPx(vx, vy, 220, 240, 170, 0.5);
  }
}
function paintCalyx(): void {
  const cx = 512, cy = 252;
  // stem first (behind leaves)
  for (let t = 0; t <= 1; t += 0.01) {
    const sx = Math.round(cx + 6 + t * 26), sy = Math.round(cy - 12 - t * 78);
    for (let d = -5; d <= 5; d++) {
      const a = 1 - Math.abs(d) / 6;
      blendPx(sx + d, sy, 96, 138, 52, a * 0.95);
      blendPx(sx + d, sy + 1, 76, 112, 40, a * 0.95);
    }
  }
  // 6 leaves fanning out over the top of the berry
  const leaves: [number, number, number][] = [
    [-2.45, 135, 55], [-1.95, 155, 62], [-1.45, 165, 64],
    [-0.95, 155, 62], [-0.45, 135, 55],
  ];
  for (const [ang, len, wid] of leaves) {
    leafPoly(cx, cy + 6, ang, len, wid, 46, 128, 46);
  }
  // darker inner leaves for depth
  leafPoly(cx, cy + 10, -1.70, 120, 34, 30, 102, 34);
  leafPoly(cx, cy + 10, -1.30, 130, 34, 30, 102, 34);
  // small green cap where leaves meet the berry
  for (let y = 236; y < 268; y++) {
    for (let x = 430; x < 594; x++) {
      const dx = (x - 512) / 82, dy = (y - 252) / 16;
      if (dx * dx + dy * dy < 1) blendPx(x, y, 58, 140, 54, 0.85);
    }
  }
}

// ---------- big soft gloss highlight + dew drops ----------
function paintGloss(): void {
  // broad juicy highlight, upper-left of the berry
  for (let y = 300; y < 560; y++) {
    for (let x = 300; x < 520; x++) {
      const dx = (x - 398) / 105, dy = (y - 420) / 130;
      const d = dx * dx + dy * dy;
      if (d < 1) blendPx(x, y, 255, 190, 195, 0.30 * (1 - d) * (1 - d));
    }
  }
  // sharp specular streak
  for (let y = 330; y < 470; y++) {
    for (let x = 350; x < 440; x++) {
      const dx = (x - 395) / 42, dy = (y - 400) / 70;
      const d = dx * dx + dy * dy;
      if (d < 1) blendPx(x, y, 255, 255, 255, 0.5 * (1 - d));
    }
  }
  // dew drops: translucent beads with a bright dot
  const drops: [number, number, number][] = [
    [640, 470, 16], [700, 600, 12], [380, 640, 13], [560, 760, 11], [450, 520, 9], [660, 350, 10],
  ];
  for (const [cx, cy, rad] of drops) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / rad;
        if (d > 1) continue;
        const px = Math.round(cx + dx), py = Math.round(cy + dy);
        // bead: lighten + cool tint at rim, bright specular top-left
        blendPx(px, py, 255, 235, 225, 0.28 * (1 - d * 0.5));
        if (dx < -rad * 0.3 && dy < -rad * 0.3 && d < 0.55) blendPx(px, py, 255, 255, 255, 0.75);
      }
    }
  }
}

function main(): void {
  paintBackground();
  paintPlate();
  paintBody();
  paintSeeds();
  paintCalyx();
  paintGloss();
  // Grading sandbox: /output/entry.png. Local verification: pass a path,
  // e.g. `node main.ts ./out/entry.png` (or set OUTPUT_PATH).
  const outPath = process.argv[2] ?? process.env.OUTPUT_PATH ?? "/output/entry.png";
  const dir = outPath.slice(0, outPath.lastIndexOf("/")) || ".";
  mkdirSync(dir, { recursive: true });
  const png = encodePNG();
  writeFileSync(outPath, png);
  console.log("wrote", outPath, png.length, "bytes");
}
main();

