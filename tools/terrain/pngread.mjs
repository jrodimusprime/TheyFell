import { readFileSync } from 'node:fs'; import zlib from 'node:zlib';
export function readPNG(p) {
  const b = readFileSync(p); let o = 8, w, h, depth, ct, plte, idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; } else if (t === 'PLTE') plte = d; else if (t === 'IDAT') idat.push(d); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], bpp = Math.max(1, ch * depth / 8), stride = Math.ceil(w * ch * depth / 8);
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride), px = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)]; raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i]; if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1; else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; } cur[i] = v & 255; }
    for (let x = 0; x < w; x++) { const k = (y * w + x) * 3;
      if (ct === 3) { const bitsPer = depth, idx = depth === 8 ? cur[x] : (cur[(x * bitsPer) >> 3] >> (8 - bitsPer - ((x * bitsPer) & 7))) & ((1 << bitsPer) - 1); px[k] = plte[idx * 3]; px[k + 1] = plte[idx * 3 + 1]; px[k + 2] = plte[idx * 3 + 2]; }
      else if (ct === 2 || ct === 6) { px[k] = cur[x * ch]; px[k + 1] = cur[x * ch + 1]; px[k + 2] = cur[x * ch + 2]; } else { px[k] = px[k + 1] = px[k + 2] = cur[x * ch]; } }
    cur.copy(prev); }
  return { w, h, px }; }
