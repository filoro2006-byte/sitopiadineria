// Costruzione delle mesh delle sezioni 16x16x16
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const B = MC.B;
  const { OPAQUE, FLUID } = MC.BL;
  const WH = MC.WH;

  const P = 18;
  const PV = P * P * P;
  const pb = new Uint8Array(PV), pl = new Uint8Array(PV), pm = new Uint8Array(PV);
  const pidx = (x, y, z) => ((y + 1) * P + (z + 1)) * P + (x + 1);

  const POS = 128; // unità di posizione per blocco
  const STRIDE = 20;

  class Builder {
    constructor(q) { this.alloc(q); }
    alloc(q) {
      this.cap = q * 4;
      this.buf = new ArrayBuffer(this.cap * STRIDE);
      this.i16 = new Int16Array(this.buf);
      this.u8 = new Uint8Array(this.buf);
      this.n = 0;
    }
    ensure(extra) {
      if (this.n + extra <= this.cap) return;
      const old = this.u8, n = this.n;
      this.alloc((this.cap / 4) * 2);
      this.u8.set(old.subarray(0, n * STRIDE));
      this.n = n;
    }
    v(x, y, z, layer, u, vv, flags, shade, sky, blk, r, g, b, mode, nrm) {
      const o = this.n * STRIDE, h = o >> 1;
      const i16 = this.i16, u8 = this.u8;
      i16[h] = Math.round(x * POS); i16[h + 1] = Math.round(y * POS); i16[h + 2] = Math.round(z * POS); i16[h + 3] = layer;
      u8[o + 8] = Math.round(u * 16); u8[o + 9] = Math.round(vv * 16); u8[o + 10] = flags; u8[o + 11] = shade;
      u8[o + 12] = sky; u8[o + 13] = blk; u8[o + 14] = nrm === undefined ? 7 : nrm; u8[o + 15] = 0;
      u8[o + 16] = r; u8[o + 17] = g; u8[o + 18] = b; u8[o + 19] = mode;
      this.n++;
    }
  }
  const solidB = new Builder(16384), transB = new Builder(4096);

  // Facce: 0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z
  const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const FC = [
    [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
  ];
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const FACE_SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];
  const AO_MUL = [0.47, 0.64, 0.8, 1.0];

  // offset nei dati imbottiti per AO/luce: [face][corner] = [F, S1, S2, C]
  const AOOFF = [];
  for (let f = 0; f < 6; f++) {
    const n = FN[f];
    const axis = n[0] ? 0 : n[1] ? 1 : 2;
    const tA = axis === 0 ? 1 : 0, tB = axis === 2 ? 1 : 2;
    const arr = [];
    for (let c = 0; c < 4; c++) {
      const cr = FC[f][c];
      const sA = cr[tA] * 2 - 1, sB = cr[tB] * 2 - 1;
      const F = [n[0], n[1], n[2]];
      const S1 = F.slice(); S1[tA] += sA;
      const S2 = F.slice(); S2[tB] += sB;
      const C = F.slice(); C[tA] += sA; C[tB] += sB;
      const off = (v) => (v[1] * P + v[2]) * P + v[0];
      arr.push([off(F), off(S1), off(S2), off(C)]);
    }
    AOOFF.push(arr);
  }

  // layer della texture per blocco e faccia
  let FACE_LAYER = null;
  let FRONT_LAYER = null;
  function initLayers() {
    const T = MC.textures.index;
    FACE_LAYER = new Int16Array(256 * 6);
    FRONT_LAYER = new Int16Array(256);
    for (const d of MC.defs) {
      if (!d.tex || d.id >= 256) continue;
      const get = (n) => { const l = T[n]; if (l === undefined) { console.warn('texture mancante', n); return 0; } return l; };
      for (let f = 0; f < 6; f++) {
        const n = f === 2 ? d.tex.top : f === 3 ? d.tex.bottom : d.tex.side;
        FACE_LAYER[d.id * 6 + f] = get(n);
      }
      FRONT_LAYER[d.id] = d.tex.front ? get(d.tex.front) : FACE_LAYER[d.id * 6];
    }
    DOOR_TOP = T.door_top;
    for (let i = 0; i < 8; i++) WHEAT[i] = T['wheat_' + i];
  }

  function fill(world, cx, sy, cz) {
    const chs = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) chs.push(world.getChunk(cx + dx, cz + dz));
    let count = 0;
    const baseY = sy * 16;
    for (let y = -1; y <= 16; y++) {
      const wy = baseY + y;
      for (let z = -1; z <= 16; z++) {
        const cz3 = z < 0 ? 0 : z > 15 ? 6 : 3;
        const lz = z & 15;
        let p = pidx(-1, y, z);
        for (let x = -1; x <= 16; x++, p++) {
          if (wy < 0) { pb[p] = B.bedrock; pl[p] = 0; pm[p] = 0; continue; }
          if (wy >= WH) { pb[p] = 0; pl[p] = 0xf0; pm[p] = 0; continue; }
          const ch = chs[cz3 + (x < 0 ? 0 : x > 15 ? 2 : 1)];
          if (!ch) { pb[p] = 0; pl[p] = 0xf0; pm[p] = 0; continue; }
          const i = (wy << 8) | (lz << 4) | (x & 15);
          const b = ch.blocks[i];
          pb[p] = b; pl[p] = ch.light[i]; pm[p] = ch.meta ? ch.meta[i] : 0;
          if (b && x >= 0 && x < 16 && y >= 0 && y < 16 && z >= 0 && z < 16) count++;
        }
      }
    }
    return count;
  }

  function fluidHeight(p) {
    const b = pb[p];
    const up = pb[p + P * P];
    if (FLUID[up] && FLUID[up] === FLUID[b]) return 1;
    const m = pm[p];
    if (m & 8) return 1;
    const l = m & 7;
    return l === 0 ? 0.89 : Math.max(0.1, (8 - l) / 9);
  }

  const isLeaf = new Uint8Array(256);
  function initLeaf() {
    for (const k of ['oak_leaves', 'birch_leaves', 'spruce_leaves', 'jungle_leaves', 'acacia_leaves']) isLeaf[B[k]] = 1;
  }

  function tintFor(d, face, grass, foliage, ci, out) {
    const t = d.tint;
    out[3] = 0;
    if (!t) return;
    if (t === 1) { out[0] = grass[ci * 3]; out[1] = grass[ci * 3 + 1]; out[2] = grass[ci * 3 + 2]; out[3] = 1; }
    else if (t === 2) {
      if (face === 3) return;
      out[0] = grass[ci * 3]; out[1] = grass[ci * 3 + 1]; out[2] = grass[ci * 3 + 2]; out[3] = face === 2 ? 1 : 2;
    } else if (t === 3) { out[0] = foliage[ci * 3]; out[1] = foliage[ci * 3 + 1]; out[2] = foliage[ci * 3 + 2]; out[3] = 1; }
    else if (t === 4) { out[0] = d.tintColor[0]; out[1] = d.tintColor[1]; out[2] = d.tintColor[2]; out[3] = 1; }
  }

  const tint = [255, 255, 255, 0];

  function meshSection(world, chunk, sy, opts) {
    if (!FACE_LAYER) { initLayers(); initLeaf(); }
    solidB.n = 0; transB.n = 0;
    const count = fill(world, chunk.cx, sy, chunk.cz);
    if (count === 0) return { solid: null, trans: null, empty: true };
    const fancy = opts.fancyLeaves !== false;
    const blocks = MC.blocks;
    const grass = chunk.grass, foliage = chunk.foliage;
    const wx0 = chunk.cx * 16, wz0 = chunk.cz * 16, wy0 = sy * 16;

    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) {
      let p = pidx(0, y, z);
      for (let x = 0; x < 16; x++, p++) {
        const id = pb[p];
        if (id === 0) continue;
        const d = blocks[id];
        const ci = (z << 4) | x;
        switch (d.shape) {
          case 'cube': cube(d, id, p, x, y, z, ci, grass, foliage, fancy); break;
          case 'cross': cross(d, id, p, x, y, z, ci, grass, foliage, wx0 + x, wy0 + y, wz0 + z); break;
          case 'torch': torch(d, id, p, x, y, z); break;
          case 'liquid': liquid(d, id, p, x, y, z); break;
          case 'cactus': cactus(d, id, p, x, y, z); break;
          case 'model': model(d, id, p, x, y, z, ci, grass, foliage); break;
          case 'crop': crop(d, id, p, x, y, z); break;
        }
      }
    }
    return {
      solid: solidB.n ? solidB.u8.subarray(0, solidB.n * STRIDE) : null,
      solidVerts: solidB.n,
      trans: transB.n ? transB.u8.subarray(0, transB.n * STRIDE) : null,
      transVerts: transB.n,
      empty: false,
    };
  }

  const aoV = [0, 0, 0, 0], skV = [0, 0, 0, 0], blV = [0, 0, 0, 0];

  function computeCorner(p, f) {
    const offs = AOOFF[f];
    for (let c = 0; c < 4; c++) {
      const o = offs[c];
      const pF = p + o[0], pS1 = p + o[1], pS2 = p + o[2], pC = p + o[3];
      const s1 = OPAQUE[pb[pS1]], s2 = OPAQUE[pb[pS2]], cc = OPAQUE[pb[pC]];
      aoV[c] = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc);
      let sk = pl[pF] >> 4, bl = pl[pF] & 15, n = 1;
      if (!s1) { sk += pl[pS1] >> 4; bl += pl[pS1] & 15; n++; }
      if (!s2) { sk += pl[pS2] >> 4; bl += pl[pS2] & 15; n++; }
      if (!cc && !(s1 && s2)) { sk += pl[pC] >> 4; bl += pl[pC] & 15; n++; }
      skV[c] = Math.round((sk / n) * 17);
      blV[c] = Math.round((bl / n) * 17);
    }
  }

  function emitFace(bld, f, x, y, z, layer, flags, rotUV, t, shadeMul, box) {
    const corners = FC[f];
    const fs = FACE_SHADE[f] * (shadeMul || 1);
    const flip = (aoV[0] + aoV[2]) * 16 + skV[0] + skV[2] + blV[0] + blV[2] < (aoV[1] + aoV[3]) * 16 + skV[1] + skV[3] + blV[1] + blV[3];
    bld.ensure(4);
    for (let k = 0; k < 4; k++) {
      const c = flip ? (k + 1) & 3 : k;
      const cr = corners[c];
      let u = UV[c][0], v = UV[c][1];
      if (rotUV) { const tu = u; u = v; v = 1 - tu; }
      let px = cr[0], py = cr[1], pz = cr[2];
      if (box) {
        px = cr[0] ? box[3] : box[0]; py = cr[1] ? box[4] : box[1]; pz = cr[2] ? box[5] : box[2];
      }
      const shade = Math.round(255 * fs * AO_MUL[aoV[c]]);
      bld.v(x + px, y + py, z + pz, layer, u, v, flags, shade, skV[c], blV[c], t[0], t[1], t[2], t[3], f);
    }
  }

  function cube(d, id, p, x, y, z, ci, grass, foliage, fancy) {
    const bld = d.pass === 'translucent' ? transB : solidB;
    const meta = pm[p];
    const flags = (d.emissive ? 8 : 0) | (d.wave === 2 ? 2 : 0);
    for (let f = 0; f < 6; f++) {
      const n = FN[f];
      const np = p + (n[1] * P + n[2]) * P + n[0];
      const nb = pb[np];
      if (OPAQUE[nb]) continue;
      if (nb === id && d.cullSame) continue;
      if (!fancy && isLeaf[id] && isLeaf[nb]) continue;
      if (d.pass === 'translucent' && nb !== 0 && blocks_pass_trans(nb) && d.cullSame) continue;
      let layer = FACE_LAYER[id * 6 + f];
      let rot = false;
      if (d.axis) {
        const ax = meta & 3;
        if (ax === 1) { // asse X
          if (f === 0 || f === 1) layer = FACE_LAYER[id * 6 + 2];
          else rot = true;
        } else if (ax === 2) { // asse Z
          if (f === 4 || f === 5) layer = FACE_LAYER[id * 6 + 2];
          else if (f === 0 || f === 1) rot = true;
        }
      } else if (d.facing) {
        if (f === (meta & 7) && f !== 2 && f !== 3) layer = FRONT_LAYER[id];
      }
      computeCorner(p, f);
      tintFor(d, f, grass, foliage, ci, tint);
      emitFace(bld, f, x, y, z, layer, flags, rot, tint);
    }
  }
  function blocks_pass_trans(nb) { return MC.blocks[nb].pass === 'translucent' && MC.blocks[nb].shape === 'cube'; }

  function cross(d, id, p, x, y, z, ci, grass, foliage, wx, wy, wz) {
    const layer = FACE_LAYER[id * 6 + 4];
    tintFor(d, 4, grass, foliage, ci, tint);
    const sk = Math.round((pl[p] >> 4) * 17), bl = Math.round((pl[p] & 15) * 17);
    let ox = 0, oz = 0;
    if (id !== B.sugar_cane) {
      const h = MC.util.hash3(1337, wx, wy, wz);
      ox = (h - 0.5) * 0.3; oz = (((h * 7919) % 1) - 0.5) * 0.3;
    }
    const a = 0.15, b = 0.85;
    const hgt = 1;
    const wave = d.wave ? 1 : 0;
    const planes = [[a, a, b, b], [a, b, b, a]];
    solidB.ensure(16);
    const shade = 230;
    for (const [x0, z0, x1, z1] of planes) {
      const X0 = x + x0 + ox, Z0 = z + z0 + oz, X1 = x + x1 + ox, Z1 = z + z1 + oz;
      // fronte
      solidB.v(X0, y, Z0, layer, 0, 0, 0, shade, sk, bl, tint[0], tint[1], tint[2], tint[3], 6);
      solidB.v(X1, y, Z1, layer, 1, 0, 0, shade, sk, bl, tint[0], tint[1], tint[2], tint[3], 6);
      solidB.v(X1, y + hgt, Z1, layer, 1, 1, wave, shade, sk, bl, tint[0], tint[1], tint[2], tint[3], 6);
      solidB.v(X0, y + hgt, Z0, layer, 0, 1, wave, shade, sk, bl, tint[0], tint[1], tint[2], tint[3], 6);
      // retro
      solidB.v(X1, y, Z1, layer, 1, 0, 0, shade, sk, bl, tint[0], tint[1], tint[2], tint[3], 6);
      solidB.v(X0, y, Z0, layer, 0, 0, 0, shade, sk, bl, tint[0], tint[1], tint[2], tint[3], 6);
      solidB.v(X0, y + hgt, Z0, layer, 0, 1, wave, shade, sk, bl, tint[0], tint[1], tint[2], tint[3], 6);
      solidB.v(X1, y + hgt, Z1, layer, 1, 1, wave, shade, sk, bl, tint[0], tint[1], tint[2], tint[3], 6);
    }
  }

  function torch(d, id, p, x, y, z) {
    const layer = FACE_LAYER[id * 6 + 4];
    const meta = pm[p];
    const sk = Math.round((pl[p] >> 4) * 17), bl = 255;
    let wx = 0, wz = 0;
    if (meta === 1) wx = -1; else if (meta === 2) wx = 1; else if (meta === 3) wz = -1; else if (meta === 4) wz = 1;
    const wall = meta !== 0;
    const tf = (px, py, pz) => {
      if (!wall) return [x + px, y + py, z + pz];
      const yy = py + 0.22;
      return [x + px + wx * 0.4375 - wx * py * 0.4, y + yy, z + pz + wz * 0.4375 - wz * py * 0.4];
    };
    const x0 = 7 / 16, x1 = 9 / 16, y1 = 10 / 16;
    const box = [x0, 0, x0, x1, y1, x1];
    solidB.ensure(24);
    for (let f = 0; f < 6; f++) {
      const corners = FC[f];
      for (let k = 0; k < 4; k++) {
        const cr = corners[k];
        const px = cr[0] ? box[3] : box[0], py = cr[1] ? box[4] : box[1], pz = cr[2] ? box[5] : box[2];
        let u, v;
        if (f === 2) { u = 7 / 16 + UV[k][0] * 2 / 16; v = 8 / 16 + UV[k][1] * 2 / 16; }
        else if (f === 3) { u = 7 / 16 + UV[k][0] * 2 / 16; v = UV[k][1] * 2 / 16; }
        else { u = 7 / 16 + UV[k][0] * 2 / 16; v = UV[k][1] * 10 / 16; }
        const q = tf(px, py, pz);
        solidB.v(q[0], q[1], q[2], layer, u, v, 8, Math.round(255 * FACE_SHADE[f]), sk, bl, 255, 255, 255, 0, 7);
      }
    }
  }

  function cactus(d, id, p, x, y, z) {
    const in1 = 1 / 16;
    for (let f = 0; f < 6; f++) {
      const n = FN[f];
      const np = p + (n[1] * P + n[2]) * P + n[0];
      const nb = pb[np];
      if ((f === 2 || f === 3) && (OPAQUE[nb] || nb === id)) continue;
      const layer = FACE_LAYER[id * 6 + f];
      computeCorner(p, f);
      if (f !== 2 && f !== 3) { aoV[0] = aoV[1] = aoV[2] = aoV[3] = 3; const sk = Math.round((pl[p] >> 4) * 17), bl = Math.round((pl[p] & 15) * 17); skV.fill(sk); blV.fill(bl); }
      tint[3] = 0;
      const box = [0, 0, 0, 1, 1, 1];
      if (f === 0) box[3] = 1 - in1, box[0] = 1 - in1;
      if (f === 1) box[0] = in1, box[3] = in1;
      if (f === 4) box[5] = 1 - in1, box[2] = 1 - in1;
      if (f === 5) box[2] = in1, box[5] = in1;
      if (f === 2 || f === 3) { box[0] = in1; box[2] = in1; box[3] = 1 - in1; box[5] = 1 - in1; }
      emitFace(solidB, f, x, y, z, layer, 0, false, tint, 1, box);
    }
  }

  function liquid(d, id, p, x, y, z) {
    const water = d.fluid === 1;
    const bld = water ? transB : solidB;
    const F = d.fluid;
    const h = fluidHeight(p);
    const layer = FACE_LAYER[id * 6 + 2];
    const flags = water ? 32 : 16 | 8;
    tint[3] = 0;
    for (let f = 0; f < 6; f++) {
      const n = FN[f];
      const np = p + (n[1] * P + n[2]) * P + n[0];
      const nb = pb[np];
      let y0 = 0, y1 = h;
      if (f === 2) {
        if (FLUID[nb] === F) continue;
        if (OPAQUE[nb] && h >= 1) continue;
      } else if (f === 3) {
        if (FLUID[nb] === F || OPAQUE[nb]) continue;
      } else {
        if (OPAQUE[nb]) continue;
        if (FLUID[nb] === F) {
          const hn = fluidHeight(np);
          if (hn >= h) continue;
          y0 = hn;
        }
        if (water && nb === B.ice) continue;
      }
      const sk = Math.round((pl[np] >> 4) * 17), bl = Math.round((pl[np] & 15) * 17);
      const shade = Math.round(255 * FACE_SHADE[f]);
      const corners = FC[f];
      bld.ensure(4);
      for (let k = 0; k < 4; k++) {
        const cr = corners[k];
        let py = cr[1] ? y1 : y0;
        if (f === 2) py = h;
        if (f === 3) py = 0;
        let u = UV[k][0], v = UV[k][1];
        if (f !== 2 && f !== 3) v = cr[1] ? y1 : y0;
        const fl = flags | (f === 2 && water ? 4 : 0);
        bld.v(x + cr[0], y + py, z + cr[2], layer, u, v, fl, shade, sk, bl, 255, 255, 255, 0, f);
      }
    }
  }

  // blocchi con modello: scatole con UV prese dalla posizione
  const pget = (lx, ly, lz) => pb[pidx(lx, ly, lz)];
  function connAt(id, x, y, z) {
    return MC.connMask((ax, ay, az) => (ax < -1 || ax > 16 || az < -1 || az > 16 || ay < -1 || ay > 16 ? 0 : pget(ax, ay, az)), x, y, z, id);
  }
  function model(d, id, p, x, y, z, ci, grass, foliage) {
    const meta = pm[p];
    const boxes = d.model(meta, d.conn ? connAt(id, x, y, z) : 0);
    const bld = d.cutout || d.pass === 'translucent' ? solidB : solidB;
    const ownSky = pl[p] >> 4, ownBlk = pl[p] & 15;
    tint[3] = 0;
    for (const b of boxes) {
      for (let f = 0; f < 6; f++) {
        const n = FN[f];
        const onEdge = (f === 0 && b[3] >= 1) || (f === 1 && b[0] <= 0) || (f === 2 && b[4] >= 1) || (f === 3 && b[1] <= 0) || (f === 4 && b[5] >= 1) || (f === 5 && b[2] <= 0);
        const np = p + (n[1] * P + n[2]) * P + n[0];
        if (onEdge && OPAQUE[pb[np]]) continue;
        if (onEdge && pb[np] === id && d.conn === 'pane') continue;
        let layer = FACE_LAYER[id * 6 + f];
        if (d.facing && f === (meta & 7) && f !== 2 && f !== 3) layer = FRONT_LAYER[id];
        if (d.door && (meta & 8)) layer = DOOR_TOP;
        const ov = b[6];
        if (ov && ov.f && ov.f[f]) layer = MC.textures.index[ov.f[f]];
        const uvRot = ov && ov.r && (f === 2 || f === 3) ? ov.r : 0;
        let sk, bl;
        if (onEdge) { sk = Math.max(pl[np] >> 4, ownSky); bl = Math.max(pl[np] & 15, ownBlk); }
        else { sk = Math.max(ownSky, pl[np] >> 4); bl = Math.max(ownBlk, pl[np] & 15); }
        if (d.lightOpacity >= 15) { sk = pl[np] >> 4; bl = pl[np] & 15; }
        const skv = Math.round(sk * 17), blv = Math.round(bl * 17);
        const shade = Math.round(255 * FACE_SHADE[f] * (onEdge ? 1 : 0.92));
        const corners = FC[f];
        bld.ensure(4);
        for (let k = 0; k < 4; k++) {
          const cr = corners[k];
          const px = cr[0] ? b[3] : b[0], py = cr[1] ? b[4] : b[1], pz = cr[2] ? b[5] : b[2];
          let u, v;
          if (f === 0 || f === 1) { u = f === 0 ? 1 - pz : pz; v = py; }
          else if (f === 2 || f === 3) { u = px; v = f === 2 ? 1 - pz : pz; }
          else { u = f === 4 ? px : 1 - px; v = py; }
          for (let q = 0; q < uvRot; q++) { const tu = u; u = 1 - v; v = tu; }
          bld.v(x + px, y + py, z + pz, layer, u, v, d.emissive ? 8 : 0, shade, skv, blv, 255, 255, 255, 0, f);
        }
      }
    }
  }
  function crop(d, id, p, x, y, z) {
    const st = pm[p] & 7;
    const layer = WHEAT[st];
    const sk = Math.round((pl[p] >> 4) * 17), bl = Math.round((pl[p] & 15) * 17);
    solidB.ensure(32);
    const shade = 230;
    // quattro piani a cancelletto
    for (const off of [0.25, 0.75]) {
      for (const axis of [0, 1]) {
        const P0 = axis ? [x + off, z] : [x, z + off], P1 = axis ? [x + off, z + 1] : [x + 1, z + off];
        const X0 = P0[0], Z0 = P0[1], X1 = P1[0], Z1 = P1[1];
        solidB.v(X0, y, Z0, layer, 0, 0, 0, shade, sk, bl, 255, 255, 255, 0, 6);
        solidB.v(X1, y, Z1, layer, 1, 0, 0, shade, sk, bl, 255, 255, 255, 0, 6);
        solidB.v(X1, y + 1, Z1, layer, 1, 1, 1, shade, sk, bl, 255, 255, 255, 0, 6);
        solidB.v(X0, y + 1, Z0, layer, 0, 1, 1, shade, sk, bl, 255, 255, 255, 0, 6);
        solidB.v(X1, y, Z1, layer, 1, 0, 0, shade, sk, bl, 255, 255, 255, 0, 6);
        solidB.v(X0, y, Z0, layer, 0, 0, 0, shade, sk, bl, 255, 255, 255, 0, 6);
        solidB.v(X0, y + 1, Z0, layer, 0, 1, 1, shade, sk, bl, 255, 255, 255, 0, 6);
        solidB.v(X1, y + 1, Z1, layer, 1, 1, 1, shade, sk, bl, 255, 255, 255, 0, 6);
      }
    }
  }
  let DOOR_TOP = 0;
  const WHEAT = [];

  MC.mesher = { meshSection, STRIDE, POS };
})();
