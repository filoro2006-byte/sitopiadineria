// Texture procedurali in pixel-art 16x16 (generate in memoria, senza canvas readback)
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const { mulberry32, hashString } = MC.util;

  const S = 16;
  const layers = []; // Uint8Array(1024)
  const index = {}; // nome -> layer

  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

  class P {
    constructor(name) {
      this.d = new Uint8Array(S * S * 4);
      this.rng = mulberry32(hashString(name) ^ 0x9e3779b9);
    }
    r() { return this.rng(); }
    ri(n) { return Math.floor(this.rng() * n); }
    set(x, y, c, a) {
      x = ((x % S) + S) % S; y = ((y % S) + S) % S;
      const i = (y * S + x) * 4;
      this.d[i] = clamp255(c[0]); this.d[i + 1] = clamp255(c[1]); this.d[i + 2] = clamp255(c[2]);
      this.d[i + 3] = a === undefined ? 255 : clamp255(a);
    }
    get(x, y) {
      x = ((x % S) + S) % S; y = ((y % S) + S) % S;
      const i = (y * S + x) * 4;
      return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
    }
    alpha(x, y) { return this.d[(y * S + x) * 4 + 3]; }
    fill(c, a) { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) this.set(x, y, c, a); }
    clear() { this.d.fill(0); }
    each(fn) { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) fn(x, y); }
    copy(other) { this.d.set(other); }
    tnoise(period) { return tileNoise(this.rng, period); }
  }

  function sh(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function pal(colors, v) {
    let i = Math.floor(v * colors.length);
    if (i < 0) i = 0; if (i >= colors.length) i = colors.length - 1;
    return colors[i];
  }
  function tileNoise(rng, n) {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rng();
    const cell = S / n;
    return function (x, y) {
      const fx = x / cell, fy = y / cell;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      let tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const xa = ((x0 % n) + n) % n, xb = (xa + 1) % n, ya = ((y0 % n) + n) % n, yb = (ya + 1) % n;
      const a = g[ya * n + xa], b = g[ya * n + xb], c = g[yb * n + xa], d = g[yb * n + xb];
      return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    };
  }

  const cache = {};
  function tex(name, fn) {
    const p = new P(name);
    fn(p);
    cache[name] = p.d;
    index[name] = layers.length;
    layers.push(p.d);
    return p.d;
  }

  // ---------- Generatori base ----------
  function noiseTex(p, colors, opts) {
    opts = opts || {};
    const n1 = p.tnoise(opts.p1 || 4), n2 = p.tnoise(opts.p2 || 8);
    const w = opts.w || [0.45, 0.3, 0.25];
    p.each((x, y) => {
      const v = n1(x, y) * w[0] + n2(x, y) * w[1] + p.r() * w[2];
      p.set(x, y, pal(colors, v));
    });
  }

  function stoneBase(p, base) {
    base = base || [128, 128, 128];
    const cols = [sh(base, 0.78), sh(base, 0.86), sh(base, 0.93), base, sh(base, 1.07), sh(base, 1.14)];
    const n1 = p.tnoise(4), n2 = p.tnoise(8), n3 = p.tnoise(16);
    p.each((x, y) => {
      const v = n1(x, y) * 0.35 + n2(x, y) * 0.3 + n3(x, y) * 0.2 + p.r() * 0.25 - 0.05;
      p.set(x, y, pal(cols, v));
    });
    // piccole crepe scure
    for (let i = 0; i < 5; i++) {
      let x = p.ri(S), y = p.ri(S);
      const len = 2 + p.ri(3);
      for (let k = 0; k < len; k++) {
        p.set(x, y, sh(base, 0.72));
        x += p.ri(3) - 1; y += p.r() < 0.5 ? 0 : 1;
      }
    }
  }

  function voronoiTex(p, base, count, opts) {
    opts = opts || {};
    const pts = [];
    for (let i = 0; i < count; i++) pts.push([p.r() * S, p.r() * S, 0.8 + p.r() * 0.35]);
    p.each((x, y) => {
      let d1 = 1e9, d2 = 1e9, best = 0, bx = 0, by = 0;
      for (let i = 0; i < pts.length; i++) {
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const dx = x + 0.5 - (pts[i][0] + ox * S), dy = y + 0.5 - (pts[i][1] + oy * S);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; best = i; bx = dx; by = dy; } else if (d < d2) d2 = d;
        }
      }
      const edge = d2 - d1;
      let f = pts[best][2];
      // luce dall'alto a sinistra sulle pietre
      f *= 1 - (bx + by) * 0.035;
      f *= 0.92 + p.r() * 0.14;
      let c = sh(base, f);
      if (edge < (opts.mortar || 1.1)) c = sh(opts.mortarColor || base, (opts.mortarShade || 0.55) + p.r() * 0.08);
      p.set(x, y, c);
    });
  }

  function oreTex(p, oreCols, count, base) {
    stoneBase(p, base);
    const placed = [];
    for (let b = 0; b < count; b++) {
      let cx = 2 + p.ri(12), cy = 2 + p.ri(12);
      let tries = 0;
      while (tries++ < 20 && placed.some(([a, c]) => Math.abs(a - cx) < 4 && Math.abs(c - cy) < 4)) { cx = 2 + p.ri(12); cy = 2 + p.ri(12); }
      placed.push([cx, cy]);
      const size = 3 + p.ri(3);
      const cells = [[cx, cy]];
      for (let i = 0; i < size; i++) {
        const [px, py] = cells[p.ri(cells.length)];
        const d = p.ri(4);
        cells.push([px + [1, -1, 0, 0][d], py + [0, 0, 1, -1][d]]);
      }
      for (const [x, y] of cells) p.set(x, y, oreCols[1]);
      for (const [x, y] of cells) {
        if (!cells.some(([a, c]) => a === x - 1 && c === y - 1)) p.set(x, y, oreCols[2] || sh(oreCols[1], 1.25));
      }
      for (const [x, y] of cells) {
        if (!cells.some(([a, c]) => a === x && c === y + 1)) p.set(x, y + 1, oreCols[0]);
      }
    }
  }

  function planks(p, base) {
    const n = p.tnoise(16);
    const offs = [p.ri(16), p.ri(16), p.ri(16), p.ri(16)];
    const shades = [0.98 + p.r() * 0.06, 0.94 + p.r() * 0.06, 1.0 + p.r() * 0.04, 0.95 + p.r() * 0.06];
    p.each((x, y) => {
      const board = Math.floor(y / 4);
      const ry = y % 4;
      let f = shades[board] * (0.93 + n(x * 0.3, y) * 0.1 + p.r() * 0.05);
      // venature orizzontali
      if ((x * 7 + board * 13 + ry * 5) % 11 === 0) f *= 0.9;
      if (ry === 3) f *= 0.7; // fuga tra le assi
      if (ry === 0) f *= 1.04;
      const jx = (offs[board] + (board % 2 ? 8 : 0)) % 16;
      if (x === jx && ry !== 3) f *= 0.72; // giunto verticale
      p.set(x, y, sh(base, f));
    });
  }

  function logSide(p, base, style) {
    const n = p.tnoise(4);
    const cols = [];
    for (let x = 0; x < S; x++) cols.push(0.85 + p.r() * 0.25);
    p.each((x, y) => {
      let f = cols[x] * (0.9 + n(x, y) * 0.2);
      if (style === 'birch') {
        let c = [216, 215, 210];
        f = 0.93 + p.r() * 0.1;
        p.set(x, y, sh(c, f));
        return;
      }
      if ((x + (y >> 2)) % 5 === 0) f *= 0.75;
      if (p.r() < 0.06) f *= 0.8;
      p.set(x, y, sh(base, f));
    });
    if (style === 'birch') {
      // segni neri orizzontali
      for (let i = 0; i < 9; i++) {
        const y = p.ri(S), x = p.ri(S), len = 2 + p.ri(4);
        for (let k = 0; k < len; k++) p.set(x + k, y, k === 0 || k === len - 1 ? [70, 70, 64] : [35, 33, 30]);
      }
      for (let i = 0; i < 10; i++) p.set(p.ri(S), p.ri(S), [180, 178, 172]);
    }
  }

  function logTop(p, bark, inner, ringCol) {
    p.each((x, y) => {
      const dx = x - 7.5, dy = y - 7.5;
      const d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.6 + Math.sqrt(dx * dx + dy * dy) * 0.4;
      let c;
      if (x === 0 || y === 0 || x === 15 || y === 15) c = sh(bark, 0.9 + p.r() * 0.2);
      else {
        const ring = Math.floor(d + p.r() * 0.35) % 2 === 0;
        c = ring ? sh(inner, 0.97 + p.r() * 0.06) : sh(ringCol, 0.97 + p.r() * 0.06);
      }
      p.set(x, y, c);
    });
  }

  function leaves(p, base, holes) {
    const n = p.tnoise(8), n2 = p.tnoise(4);
    p.each((x, y) => {
      const v = n(x, y) * 0.5 + n2(x, y) * 0.3 + p.r() * 0.35;
      if (p.r() < holes && v < 0.62) { p.set(x, y, sh(base, 0.5), 0); return; }
      const f = 0.55 + v * 0.65;
      p.set(x, y, sh(base, f));
    });
    // bordi più scuri per dare volume
    for (let i = 0; i < 20; i++) {
      const x = p.ri(S), y = p.ri(S);
      if (p.alpha(x, y) > 0) p.set(x, y, sh(base, 0.45));
    }
  }

  function bevel(p, light, dark) {
    for (let i = 0; i < S; i++) {
      p.set(i, 0, sh(p.get(i, 0), light)); p.set(0, i, sh(p.get(0, i), light));
      p.set(i, 15, sh(p.get(i, 15), dark)); p.set(15, i, sh(p.get(15, i), dark));
    }
  }

  function metalBlock(p, base) {
    const n = p.tnoise(8);
    p.each((x, y) => {
      let f = 0.95 + n(x, y) * 0.08 + p.r() * 0.04;
      if ((x + y) % 7 === 0 && x > 1 && y > 1 && x < 14 && y < 14) f *= 1.05;
      p.set(x, y, sh(base, f));
    });
    for (let i = 1; i < 15; i++) {
      p.set(i, 1, sh(base, 1.2)); p.set(1, i, sh(base, 1.2));
      p.set(i, 14, sh(base, 0.78)); p.set(14, i, sh(base, 0.78));
    }
    bevel(p, 1.3, 0.62);
  }

  function gemBlock(p, base) {
    p.each((x, y) => {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      let f = 0.85 + ((Math.floor(d) % 4) / 4) * 0.3 + p.r() * 0.06;
      p.set(x, y, sh(base, f));
    });
    bevel(p, 1.35, 0.6);
    for (let i = 0; i < 6; i++) p.set(2 + p.ri(12), 2 + p.ri(12), [255, 255, 255]);
  }

  function woolTex(p, base) {
    p.each((x, y) => {
      let f = 0.93 + p.r() * 0.08;
      if ((x + y * 2) % 4 === 0) f *= 0.94;
      if ((x * 3 + y) % 5 === 0) f *= 1.05;
      p.set(x, y, sh(base, f));
    });
  }

  function flatTex(p, base, amt) {
    const n = p.tnoise(8);
    p.each((x, y) => p.set(x, y, sh(base, 1 - amt / 2 + (n(x, y) * 0.5 + p.r() * 0.5) * amt)));
  }

  function bricksTex(p, brick, mortar, rowH, brickW) {
    rowH = rowH || 4; brickW = brickW || 8;
    const brickShade = {};
    p.each((x, y) => {
      const row = Math.floor(y / rowH);
      const off = row % 2 ? brickW / 2 : 0;
      const col = Math.floor((x + off) / brickW);
      const key = row + ':' + (col % (16 / brickW));
      if (brickShade[key] === undefined) brickShade[key] = 0.85 + p.r() * 0.25;
      const lx = (x + off) % brickW, ly = y % rowH;
      if (ly === rowH - 1 || lx === brickW - 1) p.set(x, y, sh(mortar, 0.9 + p.r() * 0.15));
      else {
        let f = brickShade[key] * (0.92 + p.r() * 0.12);
        if (ly === 0) f *= 1.1;
        p.set(x, y, sh(brick, f));
      }
    });
  }

  function stoneBricks(p, mossy) {
    const base = [122, 121, 122];
    const n = p.tnoise(8);
    p.each((x, y) => {
      const row = y >> 3;
      const off = row % 2 ? 4 : 0;
      const lx = (x + off) % 8, ly = y % 8;
      const bx = ((x + off) >> 3);
      let f = 0.9 + n(x, y) * 0.15 + p.r() * 0.08 + ((bx + row) % 2) * 0.03;
      let c = sh(base, f);
      if (ly === 7 || lx === 7) c = sh(base, 0.55 + p.r() * 0.08);
      else if (ly === 0 || lx === 0) c = sh(base, 1.12);
      else if (ly === 6 || lx === 6) c = sh(base, 0.8);
      p.set(x, y, c);
    });
    if (mossy) {
      const m = p.tnoise(4);
      p.each((x, y) => {
        if (m(x, y) + p.r() * 0.3 > 0.78) p.set(x, y, sh([86, 115, 50], 0.8 + p.r() * 0.35));
      });
    }
  }

  function sandLike(p, base, amt) {
    const n = p.tnoise(8);
    p.each((x, y) => {
      let f = 1 - amt + n(x, y) * amt * 0.8 + p.r() * amt * 1.2;
      p.set(x, y, sh(base, f));
    });
    for (let i = 0; i < 10; i++) p.set(p.ri(S), p.ri(S), sh(base, 0.82));
  }

  function sandstoneSide(p, base) {
    const n = p.tnoise(8);
    p.each((x, y) => {
      let f = 0.95 + n(x, y) * 0.06 + p.r() * 0.05;
      if (y < 3) f *= 1.06;
      if (y === 3) f *= 0.84;
      if (y === 11 || y === 12) f *= 0.93 + p.r() * 0.05;
      if (y > 12) f *= 0.97;
      if (y > 4 && y < 11 && (x + y * 3) % 9 === 0) f *= 0.9;
      p.set(x, y, sh(base, f));
    });
  }

  // Sprite di piante: disegno su tela trasparente
  function stem(p, x, y0, y1, col) {
    for (let y = y0; y <= y1; y++) p.set(x, y, sh(col, 0.9 + p.r() * 0.2));
  }
  function flower(p, petal, center, stemCol, headY, shape) {
    p.clear();
    stemCol = stemCol || [58, 120, 40];
    stem(p, 7, headY + 2, 15, stemCol);
    p.set(6, 12, stemCol); p.set(5, 11, stemCol); p.set(8, 13, stemCol); p.set(9, 12, stemCol); p.set(10, 11, sh(stemCol, 1.1));
    const pts = shape || [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [-2, 0], [2, 0], [0, 2]];
    for (const [dx, dy] of pts) p.set(7 + dx, headY + dy, sh(petal, 0.85 + p.r() * 0.3));
    if (center) p.set(7, headY, center);
  }

  // ---------- Definizione delle texture ----------
  function buildAll() {
    tex('stone', (p) => stoneBase(p, [126, 126, 126]));
    tex('dirt', (p) => {
      noiseTex(p, [[97, 68, 45], [110, 78, 52], [121, 85, 58], [134, 96, 67], [145, 104, 72]], { w: [0.3, 0.3, 0.4] });
      for (let i = 0; i < 8; i++) p.set(p.ri(S), p.ri(S), [150, 118, 90]);
      for (let i = 0; i < 6; i++) p.set(p.ri(S), p.ri(S), [80, 56, 38]);
    });
    const grassGray = (p, x, y, n) => {
      const v = n(x, y) * 0.5 + p.r() * 0.5;
      return pal([[118, 118, 118], [134, 134, 134], [148, 148, 148], [160, 160, 160], [174, 174, 174]], v);
    };
    tex('grass_top', (p) => {
      const n = p.tnoise(8);
      p.each((x, y) => p.set(x, y, grassGray(p, x, y, n)));
    });
    tex('grass_side', (p) => {
      p.copy(cache.dirt);
      const n = p.tnoise(8);
      for (let x = 0; x < S; x++) {
        const depth = 3 + (p.r() < 0.5 ? 1 : 0) + (p.r() < 0.25 ? 1 : 0);
        for (let y = 0; y < depth; y++) {
          const c = grassGray(p, x, y, n);
          p.set(x, y, c, 190); // alpha < 1 = maschera di tinta
        }
      }
    });
    // versioni già colorate per oggetti, icone e particelle
    const GT = [124 / 255, 189 / 255, 88 / 255];
    tex('grass_side_item', (p) => {
      p.copy(cache.grass_side);
      p.each((x, y) => { const c = p.get(x, y); if (c[3] < 250) p.set(x, y, [c[0] * GT[0], c[1] * GT[1], c[2] * GT[2]]); });
    });
    tex('grass_top_item', (p) => {
      p.copy(cache.grass_top);
      p.each((x, y) => { const c = p.get(x, y); p.set(x, y, [c[0] * GT[0], c[1] * GT[1], c[2] * GT[2]]); });
    });
    tex('snowy_grass_side', (p) => {
      p.copy(cache.dirt);
      for (let x = 0; x < S; x++) {
        const depth = 3 + (p.r() < 0.5 ? 1 : 0) + (p.r() < 0.3 ? 1 : 0);
        for (let y = 0; y < depth; y++) p.set(x, y, sh([240, 250, 252], 0.92 + p.r() * 0.08));
      }
    });
    tex('cobblestone', (p) => voronoiTex(p, [128, 128, 128], 11, { mortar: 1.0, mortarShade: 0.5 }));
    tex('mossy_cobblestone', (p) => {
      p.copy(cache.cobblestone);
      const m = p.tnoise(4);
      p.each((x, y) => { if (m(x, y) + p.r() * 0.35 > 0.75) p.set(x, y, sh([90, 120, 50], 0.75 + p.r() * 0.4)); });
    });
    tex('bedrock', (p) => {
      const n = p.tnoise(4);
      p.each((x, y) => {
        const v = n(x, y) * 0.5 + p.r() * 0.5;
        p.set(x, y, pal([[30, 30, 30], [55, 55, 55], [85, 85, 85], [110, 110, 110], [140, 140, 140]], v));
      });
    });
    tex('water', (p) => {
      const n = p.tnoise(4), n2 = p.tnoise(8);
      p.each((x, y) => {
        const v = n(x, y) * 0.6 + n2(x, y) * 0.4;
        const w = Math.sin((x + y * 0.5 + v * 6) * 0.9) * 0.5 + 0.5;
        const c = mixc([38, 80, 190], [80, 135, 235], w * 0.7 + v * 0.3);
        p.set(x, y, c, 170 + w * 30);
      });
    });
    tex('lava', (p) => {
      const n = p.tnoise(4), n2 = p.tnoise(8);
      p.each((x, y) => {
        const v = n(x, y) * 0.55 + n2(x, y) * 0.45 + p.r() * 0.1;
        p.set(x, y, pal([[160, 40, 5], [200, 70, 10], [225, 105, 20], [240, 150, 30], [252, 200, 60], [255, 235, 120]], v));
      });
    });
    tex('sand', (p) => sandLike(p, [219, 207, 160], 0.12));
    tex('red_sand', (p) => sandLike(p, [190, 103, 38], 0.14));
    tex('gravel', (p) => {
      p.fill([110, 104, 100]);
      const cols = [[140, 132, 128], [120, 112, 108], [90, 86, 84], [155, 145, 140], [128, 115, 105], [100, 95, 95]];
      for (let i = 0; i < 40; i++) {
        const c = cols[p.ri(cols.length)];
        const x = p.ri(S), y = p.ri(S), w = 1 + p.ri(3), h = 1 + p.ri(2);
        for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) p.set(x + a, y + b, sh(c, 0.9 + p.r() * 0.15));
        p.set(x, y + h, sh(c, 0.6));
      }
    });
    tex('clay', (p) => {
      flatTex(p, [160, 166, 178], 0.1);
      for (let i = 0; i < 6; i++) { const x = p.ri(14), y = p.ri(16); p.set(x, y, [175, 180, 192]); p.set(x + 1, y, [175, 180, 192]); }
    });
    tex('snow', (p) => { flatTex(p, [243, 250, 252], 0.06); for (let i = 0; i < 8; i++) p.set(p.ri(S), p.ri(S), [220, 232, 240]); });
    tex('ice', (p) => {
      p.each((x, y) => p.set(x, y, sh([140, 180, 252], 0.95 + p.r() * 0.08), 165));
      for (let i = 0; i < 4; i++) {
        let x = p.ri(S), y = p.ri(S);
        for (let k = 0; k < 5; k++) { p.set(x + k, y - k, [220, 235, 255], 200); }
      }
    });
    tex('packed_ice', (p) => {
      p.each((x, y) => p.set(x, y, sh([142, 178, 240], 0.93 + p.r() * 0.1)));
      for (let i = 0; i < 5; i++) { const x = p.ri(S), y = p.ri(S); for (let k = 0; k < 4; k++) p.set(x + k, y + (k >> 1), [190, 212, 250]); }
    });

    // Minerali
    tex('coal_ore', (p) => oreTex(p, [[26, 26, 26], [45, 45, 45], [75, 75, 75]], 4));
    tex('iron_ore', (p) => oreTex(p, [[150, 110, 85], [216, 175, 147], [236, 206, 180]], 4));
    tex('copper_ore', (p) => oreTex(p, [[120, 70, 45], [224, 128, 90], [110, 190, 150]], 4));
    tex('gold_ore', (p) => oreTex(p, [[170, 140, 20], [250, 238, 77], [255, 255, 180]], 4));
    tex('redstone_ore', (p) => oreTex(p, [[110, 0, 0], [200, 10, 10], [255, 90, 90]], 5));
    tex('lapis_ore', (p) => oreTex(p, [[20, 40, 120], [35, 75, 190], [90, 130, 230]], 5));
    tex('diamond_ore', (p) => oreTex(p, [[20, 130, 140], [93, 236, 245], [210, 255, 255]], 4));
    tex('emerald_ore', (p) => oreTex(p, [[10, 110, 40], [23, 221, 98], [160, 255, 190]], 3));

    tex('gold_block', (p) => metalBlock(p, [246, 208, 61]));
    tex('iron_block', (p) => metalBlock(p, [218, 218, 218]));
    tex('copper_block', (p) => metalBlock(p, [192, 107, 79]));
    tex('diamond_block', (p) => gemBlock(p, [98, 219, 214]));
    tex('emerald_block', (p) => gemBlock(p, [42, 203, 88]));
    tex('lapis_block', (p) => gemBlock(p, [31, 67, 140]));
    tex('redstone_block', (p) => gemBlock(p, [175, 24, 5]));
    tex('coal_block', (p) => { flatTex(p, [22, 22, 24], 0.4); bevel(p, 1.8, 0.6); });
    tex('amethyst_block', (p) => {
      p.each((x, y) => {
        const a = ((x * 3 + y * 5) % 7) / 7, b = ((x * 5 - y * 2 + 64) % 5) / 5;
        p.set(x, y, mixc([110, 70, 170], [200, 160, 240], a * 0.6 + b * 0.4 + p.r() * 0.1));
      });
    });

    // Legni
    const woods = {
      oak: { plank: [162, 130, 78], bark: [104, 82, 50], inner: [176, 143, 88], ring: [150, 118, 70] },
      birch: { plank: [196, 179, 123], bark: [216, 215, 210], inner: [206, 190, 132], ring: [180, 162, 110] },
      spruce: { plank: [115, 85, 49], bark: [58, 38, 18], inner: [124, 92, 54], ring: [100, 74, 42] },
      jungle: { plank: [160, 115, 80], bark: [86, 68, 26], inner: [172, 128, 84], ring: [146, 104, 68] },
      acacia: { plank: [168, 90, 50], bark: [104, 97, 88], inner: [184, 100, 58], ring: [155, 82, 46] },
    };
    for (const k in woods) {
      const w = woods[k];
      tex(k + '_planks', (p) => planks(p, w.plank));
      tex(k + '_log', (p) => logSide(p, w.bark, k === 'birch' ? 'birch' : ''));
      tex(k + '_log_top', (p) => logTop(p, w.bark, w.inner, w.ring));
    }
    tex('oak_leaves', (p) => leaves(p, [150, 150, 150], 0.25));
    tex('birch_leaves', (p) => leaves(p, [155, 155, 155], 0.22));
    tex('spruce_leaves', (p) => {
      leaves(p, [130, 130, 130], 0.28);
      for (let i = 0; i < 12; i++) { const x = p.ri(15), y = p.ri(S); p.set(x, y, [95, 95, 95]); p.set(x + 1, y, [95, 95, 95]); }
    });
    tex('jungle_leaves', (p) => leaves(p, [155, 155, 155], 0.18));
    tex('acacia_leaves', (p) => leaves(p, [150, 150, 150], 0.3));

    tex('glass', (p) => {
      p.clear();
      const edge = [225, 240, 245];
      for (let i = 0; i < S; i++) {
        p.set(i, 0, edge, 255); p.set(0, i, edge, 255); p.set(i, 15, sh(edge, 0.8), 255); p.set(15, i, sh(edge, 0.8), 255);
      }
      for (let k = 0; k < 3; k++) { p.set(3 + k, 5 - k, [255, 255, 255], 230); p.set(9 + k, 12 - k, [255, 255, 255], 230); }
      p.set(4, 3, [255, 255, 255], 200); p.set(12, 9, [255, 255, 255], 200);
    });
    for (const [k] of MC.GLASS_COLORS) {
      const col = (MC.DYE_COLORS.find((c) => c[0] === k) || [0, 0, [255, 255, 255]])[2];
      tex(k + '_stained_glass', (p) => {
        p.each((x, y) => p.set(x, y, col, 110));
        for (let i = 0; i < S; i++) {
          p.set(i, 0, sh(col, 1.15), 210); p.set(0, i, sh(col, 1.15), 210); p.set(i, 15, sh(col, 0.8), 210); p.set(15, i, sh(col, 0.8), 210);
        }
        for (let k2 = 0; k2 < 3; k2++) p.set(3 + k2, 5 - k2, sh(col, 1.4), 170);
      });
    }

    tex('sandstone', (p) => sandstoneSide(p, [216, 203, 155]));
    tex('sandstone_top', (p) => sandLike(p, [220, 208, 162], 0.07));
    tex('sandstone_bottom', (p) => { sandLike(p, [214, 200, 150], 0.1); for (let i = 0; i < 12; i++) p.set(p.ri(S), p.ri(S), [190, 176, 128]); });
    tex('cut_sandstone', (p) => {
      sandLike(p, [218, 205, 158], 0.06);
      for (let i = 0; i < S; i++) { p.set(i, 0, [230, 220, 178]); p.set(i, 15, [180, 166, 118]); p.set(0, i, [230, 220, 178]); p.set(15, i, [180, 166, 118]); p.set(i, 7, [196, 182, 134]); }
    });
    tex('red_sandstone', (p) => sandstoneSide(p, [186, 100, 38]));
    tex('red_sandstone_top', (p) => sandLike(p, [190, 104, 40], 0.07));
    tex('red_sandstone_bottom', (p) => sandLike(p, [180, 98, 36], 0.1));

    tex('bricks', (p) => bricksTex(p, [150, 72, 58], [185, 175, 165]));
    tex('mud_bricks', (p) => bricksTex(p, [138, 105, 78], [110, 84, 62]));
    tex('stone_bricks', (p) => stoneBricks(p, false));
    tex('mossy_stone_bricks', (p) => stoneBricks(p, true));
    tex('chiseled_stone_bricks', (p) => {
      flatTex(p, [122, 121, 122], 0.12);
      for (let i = 0; i < S; i++) { p.set(i, 0, [150, 150, 150]); p.set(0, i, [150, 150, 150]); p.set(i, 15, [70, 70, 70]); p.set(15, i, [70, 70, 70]); }
      for (let i = 3; i <= 12; i++) { p.set(i, 3, [80, 80, 80]); p.set(3, i, [80, 80, 80]); p.set(i, 12, [150, 150, 150]); p.set(12, i, [150, 150, 150]); }
      for (let i = 6; i <= 9; i++) { p.set(i, 6, [90, 90, 90]); p.set(6, i, [90, 90, 90]); p.set(i, 9, [145, 145, 145]); p.set(9, i, [145, 145, 145]); }
    });
    tex('smooth_stone', (p) => {
      flatTex(p, [160, 160, 160], 0.07);
      for (let i = 0; i < S; i++) { p.set(i, 0, [175, 175, 175]); p.set(i, 15, [120, 120, 120]); p.set(0, i, [168, 168, 168]); p.set(15, i, [120, 120, 120]); }
    });
    const speck = (p, base, spk, n) => { stoneBase(p, base); for (let i = 0; i < n; i++) { const c = spk[p.ri(spk.length)]; const x = p.ri(S), y = p.ri(S); p.set(x, y, c); if (p.r() < 0.5) p.set(x + 1, y, sh(c, 0.9)); } };
    tex('andesite', (p) => speck(p, [136, 136, 138], [[160, 160, 162], [110, 110, 112], [95, 95, 98]], 40));
    tex('diorite', (p) => speck(p, [190, 190, 192], [[230, 230, 232], [150, 150, 152], [120, 120, 122]], 45));
    tex('granite', (p) => speck(p, [154, 106, 89], [[180, 128, 110], [120, 80, 66], [210, 160, 140]], 45));
    const polished = (p, base) => {
      flatTex(p, base, 0.08);
      for (let i = 0; i < S; i++) { p.set(i, 0, sh(base, 1.15)); p.set(0, i, sh(base, 1.15)); p.set(i, 15, sh(base, 0.7)); p.set(15, i, sh(base, 0.7)); }
      for (let i = 0; i < 5; i++) p.set(1 + p.ri(14), 1 + p.ri(14), sh(base, 1.1));
    };
    tex('polished_andesite', (p) => polished(p, [132, 134, 134]));
    tex('polished_diorite', (p) => polished(p, [192, 192, 195]));
    tex('polished_granite', (p) => polished(p, [154, 106, 89]));

    tex('obsidian', (p) => {
      const n = p.tnoise(4);
      p.each((x, y) => {
        const v = n(x, y) * 0.6 + p.r() * 0.4;
        p.set(x, y, pal([[10, 8, 18], [20, 16, 32], [32, 24, 52], [48, 34, 80]], v));
      });
      for (let i = 0; i < 6; i++) p.set(p.ri(S), p.ri(S), [100, 70, 160]);
    });
    tex('netherrack', (p) => {
      noiseTex(p, [[80, 20, 20], [100, 30, 30], [115, 40, 38], [130, 55, 52], [145, 65, 60]], { w: [0.3, 0.3, 0.4] });
    });
    tex('deepslate', (p) => {
      const n = p.tnoise(8);
      p.each((x, y) => {
        let f = 0.9 + n(x, y) * 0.15 + p.r() * 0.08;
        if ((y + (x >> 2)) % 5 === 0) f *= 0.85;
        p.set(x, y, sh([82, 82, 88], f));
      });
    });
    tex('deepslate_top', (p) => {
      p.each((x, y) => {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        let f = 0.85 + (Math.floor(d) % 3) * 0.08 + p.r() * 0.08;
        p.set(x, y, sh([80, 80, 86], f));
      });
    });
    tex('cobbled_deepslate', (p) => voronoiTex(p, [78, 78, 84], 14, { mortar: 0.9, mortarShade: 0.45 }));

    // Colori
    const terr = {
      terracotta: [152, 94, 67], white_terracotta: [210, 178, 161], orange_terracotta: [162, 84, 38], yellow_terracotta: [186, 133, 35],
      red_terracotta: [143, 61, 47], brown_terracotta: [77, 51, 36], light_gray_terracotta: [135, 107, 98],
    };
    for (const k in terr) tex(k, (p) => flatTex(p, terr[k], 0.08));
    for (const [k, , c] of MC.DYE_COLORS) {
      tex(k + '_wool', (p) => woolTex(p, c));
      tex(k + '_concrete', (p) => flatTex(p, sh(c, 0.9), 0.04));
    }

    tex('tnt_side', (p) => {
      p.each((x, y) => {
        let c = [200, 50, 40];
        if (y >= 5 && y <= 10) c = [230, 230, 225];
        if (y === 4 || y === 11) c = [120, 30, 25];
        let f = 0.9 + p.r() * 0.15;
        if (x % 4 === 3 && (y < 4 || y > 11)) f *= 0.75;
        p.set(x, y, sh(c, f));
      });
      const T = ['###', '.#.', '.#.', '.#.'];
      const N = ['#..#', '##.#', '#.##', '#..#'];
      const draw = (g, ox) => g.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) if (row[xx] === '#') p.set(ox + xx, 6 + yy, [30, 30, 30]); });
      draw(T, 2); draw(N, 6); draw(T, 11);
    });
    tex('tnt_top', (p) => {
      p.each((x, y) => p.set(x, y, sh([200, 55, 45], 0.9 + p.r() * 0.15)));
      for (let i = 0; i < S; i++) { p.set(i, 0, [120, 30, 25]); p.set(0, i, [120, 30, 25]); p.set(i, 15, [120, 30, 25]); p.set(15, i, [120, 30, 25]); }
      for (let y = 5; y <= 10; y++) for (let x = 5; x <= 10; x++) p.set(x, y, [210, 210, 205]);
      p.set(7, 7, [60, 60, 60]); p.set(8, 7, [60, 60, 60]); p.set(7, 8, [60, 60, 60]); p.set(8, 8, [60, 60, 60]);
      p.set(8, 6, [80, 80, 80]); p.set(9, 5, [80, 80, 80]);
    });
    tex('tnt_bottom', (p) => { p.each((x, y) => p.set(x, y, sh([180, 45, 38], 0.9 + p.r() * 0.15))); });

    tex('bookshelf', (p) => {
      p.copy(cache.oak_planks);
      const bookCols = [[140, 30, 30], [40, 70, 140], [50, 110, 50], [150, 120, 40], [100, 50, 120], [120, 80, 40], [30, 110, 110]];
      for (const [y0, y1] of [[1, 6], [9, 14]]) {
        let x = 1;
        while (x < 15) {
          const w = 1 + (p.r() < 0.3 ? 1 : 0);
          const c = bookCols[p.ri(bookCols.length)];
          const top = y0 + p.ri(2);
          for (let xx = x; xx < Math.min(15, x + w); xx++) {
            for (let y = top; y <= y1; y++) p.set(xx, y, sh(c, y === top ? 1.2 : 0.9 + p.r() * 0.15));
            p.set(xx, y0 - 1, [95, 72, 40]);
          }
          x += w;
          if (p.r() < 0.15) x++;
        }
        for (let xx = 0; xx < S; xx++) { p.set(xx, y1 + 1, [95, 72, 40]); }
      }
      for (let i = 0; i < S; i++) { p.set(i, 0, [150, 118, 70]); p.set(i, 15, [110, 85, 50]); }
    });
    tex('crafting_table_top', (p) => {
      p.copy(cache.oak_planks);
      for (let i = 0; i < S; i++) { p.set(i, 0, [80, 55, 30]); p.set(0, i, [80, 55, 30]); p.set(i, 15, [80, 55, 30]); p.set(15, i, [80, 55, 30]); }
      for (let i = 2; i < 14; i++) { p.set(i, 5, [95, 68, 38]); p.set(i, 10, [95, 68, 38]); p.set(5, i, [95, 68, 38]); p.set(10, i, [95, 68, 38]); }
    });
    const tableSide = (p, front) => {
      p.copy(cache.oak_planks);
      for (let x = 0; x < S; x++) for (let y = 0; y < 3; y++) p.set(x, y, sh([110, 80, 45], 0.9 + p.r() * 0.15));
      for (let x = 0; x < S; x++) p.set(x, 3, [70, 50, 28]);
      // attrezzi appesi
      if (front) {
        for (let y = 5; y < 13; y++) p.set(4, y, [110, 80, 45]); // manico sega
        for (let y = 6; y < 12; y++) for (let x = 5; x < 8; x++) p.set(x, y, [170, 170, 170]);
        for (let y = 5; y < 13; y++) p.set(11, y, [110, 80, 45]);
        for (let x = 9; x < 14; x++) { p.set(x, 5, [120, 120, 120]); p.set(x, 6, [150, 150, 150]); }
      } else {
        for (let y = 6; y < 13; y++) p.set(8, y, [110, 80, 45]);
        for (let x = 6; x < 11; x++) { p.set(x, 5, [130, 130, 130]); p.set(x, 6, [160, 160, 160]); }
      }
    };
    tex('crafting_table_side', (p) => tableSide(p, false));
    tex('crafting_table_front', (p) => tableSide(p, true));
    tex('furnace_side', (p) => {
      stoneBase(p, [118, 118, 118]);
      for (let i = 0; i < S; i++) { p.set(i, 0, [150, 150, 150]); p.set(0, i, [140, 140, 140]); p.set(i, 15, [80, 80, 80]); p.set(15, i, [80, 80, 80]); }
    });
    tex('furnace_top', (p) => {
      flatTex(p, [130, 130, 130], 0.12);
      for (let i = 0; i < S; i++) { p.set(i, 0, [150, 150, 150]); p.set(0, i, [150, 150, 150]); p.set(i, 15, [85, 85, 85]); p.set(15, i, [85, 85, 85]); }
    });
    tex('furnace_front', (p) => {
      p.copy(cache.furnace_side);
      for (let y = 8; y < 14; y++) for (let x = 3; x < 13; x++) p.set(x, y, y < 10 ? [30, 30, 30] : [20, 20, 20]);
      for (let x = 3; x < 13; x++) { p.set(x, 7, [70, 70, 70]); p.set(x, 14, [150, 150, 150]); }
      for (let x = 4; x < 12; x++) if (p.r() < 0.6) p.set(x, 13, [200, 90, 20]);
      for (let x = 3; x < 13; x++) p.set(x, 4, [90, 90, 90]);
    });
    tex('pumpkin_side', (p) => {
      p.each((x, y) => {
        let f = 0.9 + p.r() * 0.12;
        if (x % 4 === 0) f *= 0.78;
        if (x % 4 === 2) f *= 1.08;
        p.set(x, y, sh([220, 125, 25], f));
      });
    });
    tex('pumpkin_top', (p) => {
      p.each((x, y) => {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        let f = 0.88 + p.r() * 0.12 - (d < 2 ? 0.2 : 0) + (Math.floor(d) % 3 === 0 ? -0.08 : 0);
        p.set(x, y, sh([215, 122, 24], f));
      });
      for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) p.set(x, y, sh([100, 80, 30], 0.9 + p.r() * 0.2));
    });
    tex('jack_o_lantern', (p) => {
      p.copy(cache.pumpkin_side);
      const glow = [255, 230, 80];
      const eye = [[3, 4], [4, 4], [5, 4], [4, 5], [3, 5], [5, 5], [4, 3]];
      for (const [x, y] of eye) { p.set(x, y, glow); p.set(x + 7, y, glow); }
      for (let x = 3; x < 13; x++) p.set(x, 10, glow);
      for (let x = 4; x < 12; x++) p.set(x, 11, glow);
      p.set(5, 9, glow); p.set(10, 9, glow); p.set(7, 11, [200, 110, 20]); p.set(8, 11, [200, 110, 20]);
    });
    tex('melon_side', (p) => {
      p.each((x, y) => {
        let c = [110, 150, 30];
        if (x % 5 === 0 || (x + 1) % 5 === 0) c = [70, 110, 20];
        p.set(x, y, sh(c, 0.88 + p.r() * 0.18));
      });
    });
    tex('melon_top', (p) => {
      p.each((x, y) => {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        p.set(x, y, sh(Math.floor(d) % 3 === 0 ? [80, 120, 25] : [115, 155, 35], 0.9 + p.r() * 0.15));
      });
    });
    tex('hay_side', (p) => {
      p.each((x, y) => {
        let f = 0.85 + p.r() * 0.25;
        if ((x * 3 + y) % 5 === 0) f *= 0.85;
        let c = [200, 165, 40];
        if (y === 3 || y === 12) c = [150, 60, 30];
        if (y === 2 || y === 4 || y === 11 || y === 13) c = mixc(c, [150, 60, 30], 0.3);
        p.set(x, y, sh(c, f));
      });
    });
    tex('hay_top', (p) => {
      p.each((x, y) => {
        const a = Math.atan2(y - 7.5, x - 7.5);
        const f = 0.85 + Math.sin(a * 6 + Math.hypot(x - 7.5, y - 7.5)) * 0.1 + p.r() * 0.12;
        p.set(x, y, sh([196, 160, 40], f));
      });
    });
    tex('quartz_side', (p) => { flatTex(p, [235, 229, 222], 0.05); for (let i = 0; i < 6; i++) { const x = p.ri(12), y = p.ri(16); for (let k = 0; k < 4; k++) p.set(x + k, y, [224, 218, 210]); } });
    tex('quartz_top', (p) => { flatTex(p, [236, 230, 224], 0.05); for (let i = 0; i < S; i++) { p.set(i, 0, [245, 242, 238]); p.set(i, 15, [210, 203, 196]); p.set(0, i, [245, 242, 238]); p.set(15, i, [210, 203, 196]); } });
    tex('sponge', (p) => {
      flatTex(p, [196, 190, 70], 0.12);
      for (let i = 0; i < 18; i++) { const x = p.ri(S), y = p.ri(S); p.set(x, y, [150, 140, 40]); if (p.r() < 0.5) p.set(x + 1, y, [165, 155, 45]); }
    });
    tex('sea_lantern', (p) => {
      p.each((x, y) => {
        const cx = Math.abs((x % 8) - 3.5), cy = Math.abs((y % 8) - 3.5);
        const f = 0.85 + (cx + cy < 3 ? 0.15 : 0) + p.r() * 0.05;
        p.set(x, y, sh([205, 228, 222], f));
      });
      for (let i = 0; i < S; i++) { p.set(i, 0, [150, 180, 170]); p.set(0, i, [150, 180, 170]); p.set(i, 15, [150, 180, 170]); p.set(15, i, [150, 180, 170]); p.set(i, 7, [170, 200, 190]); p.set(7, i, [170, 200, 190]); }
    });
    tex('glowstone', (p) => {
      voronoiTex(p, [230, 175, 90], 9, { mortar: 1.1, mortarColor: [140, 95, 40], mortarShade: 0.9 });
      for (let i = 0; i < 12; i++) p.set(p.ri(S), p.ri(S), [255, 240, 190]);
    });
    tex('prismarine', (p) => {
      const n = p.tnoise(4);
      p.each((x, y) => p.set(x, y, mixc([70, 130, 120], [120, 185, 165], n(x, y) * 0.7 + p.r() * 0.3)));
    });
    tex('dark_prismarine', (p) => {
      p.each((x, y) => {
        let c = sh([50, 90, 75], 0.9 + p.r() * 0.15);
        if (x % 8 === 0 || y % 8 === 0) c = [35, 65, 55];
        p.set(x, y, c);
      });
    });
    tex('podzol_top', (p) => {
      noiseTex(p, [[92, 60, 26], [110, 74, 32], [124, 86, 40], [140, 98, 48], [96, 72, 30]], { w: [0.35, 0.25, 0.4] });
      for (let i = 0; i < 10; i++) p.set(p.ri(S), p.ri(S), [80, 100, 40]);
    });
    tex('podzol_side', (p) => {
      p.copy(cache.dirt);
      for (let x = 0; x < S; x++) { const d = 3 + p.ri(2); for (let y = 0; y < d; y++) p.set(x, y, sh([110, 74, 32], 0.85 + p.r() * 0.25)); }
    });
    tex('coarse_dirt', (p) => {
      p.copy(cache.dirt);
      for (let i = 0; i < 22; i++) p.set(p.ri(S), p.ri(S), sh([110, 104, 100], 0.8 + p.r() * 0.4));
    });
    tex('moss_block', (p) => noiseTex(p, [[70, 92, 34], [80, 104, 38], [89, 112, 44], [100, 124, 50], [112, 136, 58]], { w: [0.3, 0.3, 0.4] }));

    tex('cactus_side', (p) => {
      p.each((x, y) => {
        let c = [80, 125, 40];
        if (x === 0 || x === 15) c = [0, 0, 0];
        else if (x % 4 === 1) c = [55, 95, 30];
        else if (x % 4 === 3) c = [100, 150, 55];
        p.set(x, y, sh(c, 0.92 + p.r() * 0.12), x === 0 || x === 15 ? 0 : 255);
      });
      for (let i = 0; i < 10; i++) { const x = 1 + p.ri(14), y = p.ri(S); p.set(x, y, [230, 230, 200]); }
    });
    tex('cactus_top', (p) => {
      p.each((x, y) => {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        let c = d > 6.5 ? [60, 100, 30] : Math.floor(d) % 2 ? [85, 132, 45] : [100, 148, 55];
        p.set(x, y, sh(c, 0.92 + p.r() * 0.1));
      });
    });
    tex('cactus_bottom', (p) => flatTex(p, [140, 170, 90], 0.1));

    // Piante
    tex('tall_grass', (p) => {
      p.clear();
      for (let i = 0; i < 11; i++) {
        let x = 1 + p.ri(14);
        const h = 5 + p.ri(10);
        let fx = x;
        for (let k = 0; k < h; k++) {
          const y = 15 - k;
          p.set(Math.round(fx), y, sh([160, 160, 160], 0.7 + (k / h) * 0.5 + p.r() * 0.1));
          fx += (p.r() - 0.5) * 0.6;
        }
      }
    });
    tex('fern', (p) => {
      p.clear();
      for (let b = 0; b < 3; b++) {
        const bx = 3 + b * 5, h = 9 + p.ri(5);
        for (let k = 0; k < h; k++) {
          const y = 15 - k;
          const x = bx + Math.round(Math.sin(k * 0.3 + b) * 1);
          p.set(x, y, [120, 120, 120]);
          if (k > 2 && k % 2 === 0) { p.set(x - 1, y, [150, 150, 150]); p.set(x + 1, y - 1, [150, 150, 150]); if (k < h - 2) { p.set(x - 2, y + 1, [140, 140, 140]); p.set(x + 2, y, [140, 140, 140]); } }
        }
      }
    });
    tex('dandelion', (p) => flower(p, [250, 220, 30], [255, 180, 0], null, 7, [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]));
    tex('poppy', (p) => {
      flower(p, [220, 30, 30], [40, 20, 10], null, 6, [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [-2, -1], [2, -1]]);
      p.set(7, 6, [30, 30, 20]);
    });
    tex('blue_orchid', (p) => flower(p, [60, 170, 230], [220, 230, 255], null, 6));
    tex('oxeye_daisy', (p) => flower(p, [245, 245, 240], [240, 200, 30], null, 6));
    tex('cornflower', (p) => flower(p, [70, 100, 230], [40, 50, 160], null, 6, [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -2], [1, -2], [-2, -1], [2, -1], [0, -2]]));
    tex('allium', (p) => {
      p.clear();
      stem(p, 7, 7, 15, [58, 120, 40]);
      for (let y = 2; y < 7; y++) for (let x = 5; x < 10; x++) {
        const d = Math.hypot(x - 7, y - 4.2);
        if (d < 2.6) p.set(x, y, sh([180, 100, 230], 0.8 + p.r() * 0.35));
      }
    });
    tex('pink_tulip', (p) => {
      p.clear();
      stem(p, 7, 8, 15, [58, 120, 40]);
      p.set(6, 12, [70, 140, 50]); p.set(5, 11, [70, 140, 50]); p.set(9, 11, [70, 140, 50]);
      for (let y = 4; y < 8; y++) for (let x = 6; x < 9; x++) p.set(x, y, sh([240, 160, 200], 0.85 + p.r() * 0.25));
      p.set(6, 3, [240, 170, 210]); p.set(8, 3, [240, 170, 210]);
    });
    tex('lily_of_the_valley', (p) => {
      p.clear();
      stem(p, 7, 4, 15, [58, 120, 40]);
      for (let y = 5; y < 12; y += 2) { p.set(8, y, [58, 120, 40]); p.set(9, y + 1, [245, 245, 245]); p.set(6, y + 1, [58, 120, 40]); p.set(5, y + 2, [245, 245, 245]); }
      p.set(8, 3, [245, 245, 245]);
      for (let y = 10; y < 16; y++) { p.set(5, y, [70, 140, 50]); p.set(10, y - 1, [70, 140, 50]); }
    });
    tex('dead_bush', (p) => {
      p.clear();
      const col = [130, 90, 40];
      const branch = (x, y, dx, len) => { for (let k = 0; k < len; k++) { p.set(x, y, sh(col, 0.85 + p.r() * 0.3)); y--; if (k % 2) x += dx; } };
      branch(7, 15, 0, 5); branch(7, 11, -1, 6); branch(8, 11, 1, 6); branch(7, 13, -1, 8); branch(8, 12, 1, 8); branch(6, 8, 0, 3);
    });
    tex('brown_mushroom', (p) => {
      p.clear();
      for (let y = 11; y < 16; y++) { p.set(7, y, [220, 205, 180]); p.set(8, y, [200, 185, 160]); }
      for (let y = 8; y < 11; y++) for (let x = 4; x < 12; x++) if (!(y === 8 && (x === 4 || x === 11))) p.set(x, y, sh([150, 110, 80], 0.85 + p.r() * 0.2));
    });
    tex('red_mushroom', (p) => {
      p.clear();
      for (let y = 11; y < 16; y++) { p.set(7, y, [230, 220, 200]); p.set(8, y, [210, 200, 180]); }
      for (let y = 6; y < 11; y++) for (let x = 4; x < 12; x++) if (!((y === 6) && (x < 6 || x > 9))) p.set(x, y, sh([200, 30, 30], 0.85 + p.r() * 0.2));
      p.set(6, 7, [255, 255, 255]); p.set(9, 8, [255, 255, 255]); p.set(5, 9, [255, 255, 255]); p.set(10, 10, [255, 255, 255]);
    });
    tex('sugar_cane', (p) => {
      p.clear();
      for (const bx of [3, 8, 12]) {
        for (let y = 0; y < S; y++) {
          const seg = (y + bx) % 5 === 0;
          p.set(bx, y, sh([150, 150, 150], seg ? 1.2 : 0.9 + p.r() * 0.1));
          p.set(bx + 1, y, sh([150, 150, 150], seg ? 1.1 : 0.75));
        }
        p.set(bx - 1, (bx * 3) % 12 + 2, [170, 170, 170]); p.set(bx + 2, (bx * 5) % 12 + 3, [170, 170, 170]);
      }
    });
    tex('torch', (p) => {
      p.clear();
      for (let y = 8; y < 16; y++) { p.set(7, y, [120, 90, 50]); p.set(8, y, [95, 70, 38]); }
      p.set(7, 6, [255, 250, 200]); p.set(8, 6, [255, 230, 120]);
      p.set(7, 7, [255, 200, 60]); p.set(8, 7, [250, 160, 30]);
    });

    // ---------------- Nuovi blocchi ----------------
    tex('farmland', (p) => {
      p.each((x, y) => {
        let f = 0.8 + p.r() * 0.15;
        if (y % 4 === 0) f *= 0.72;
        p.set(x, y, sh([110, 76, 48], f));
      });
    });
    tex('path_top', (p) => noiseTex(p, [[150, 122, 66], [160, 131, 72], [170, 140, 80], [140, 115, 62], [180, 150, 88]], { w: [0.3, 0.3, 0.4] }));
    tex('path_side', (p) => {
      p.copy(cache.dirt);
      for (let x = 0; x < S; x++) { const d = 1 + (p.r() < 0.4 ? 1 : 0); for (let y = 0; y <= d; y++) p.set(x, y, sh([160, 131, 72], 0.9 + p.r() * 0.15)); }
    });
    for (let st = 0; st < 8; st++) {
      tex('wheat_' + st, (p) => {
        p.clear();
        const hgt = 3 + st * 1.6;
        const green = [60 + st * 10, 150 - st * 4, 40], gold = [200, 175, 70];
        for (const bx of [2, 5, 8, 11, 13]) {
          const hh = Math.floor(hgt * (0.8 + p.r() * 0.25));
          for (let k = 0; k < hh; k++) {
            const y = 15 - k, x = bx + (k > hh * 0.6 ? (bx % 2 ? 1 : 0) : 0);
            const c = st >= 6 && k > hh - 4 ? gold : green;
            p.set(x, y, sh(st === 7 ? mixc(c, gold, 0.7) : c, 0.85 + p.r() * 0.25));
            if (st >= 5 && k > hh - 4 && k % 2) p.set(x + 1, y, sh(gold, 0.8));
          }
        }
      });
    }
    const saplingCols = { oak: [[70, 130, 40], [104, 82, 50]], birch: [[110, 150, 70], [216, 215, 210]], spruce: [[40, 90, 50], [58, 38, 18]], jungle: [[50, 140, 30], [86, 68, 26]], acacia: [[110, 130, 30], [104, 97, 88]] };
    for (const w in saplingCols) {
      tex(w + '_sapling', (p) => {
        p.clear();
        const [lc, tc] = saplingCols[w];
        for (let y = 9; y < 16; y++) p.set(7, y, tc);
        for (let i = 0; i < 26; i++) {
          const a = p.r() * Math.PI * 2, r = p.r() * 4.5;
          p.set(Math.round(7.5 + Math.cos(a) * r), Math.round(6 + Math.sin(a) * r * 0.9), sh(lc, 0.75 + p.r() * 0.45));
        }
      });
    }
    const doorTex = (p, top) => {
      p.copy(cache.oak_planks);
      for (let i = 0; i < S; i++) { p.set(0, i, [90, 66, 38]); p.set(15, i, [90, 66, 38]); if (top) p.set(i, 0, [90, 66, 38]); else p.set(i, 15, [90, 66, 38]); }
      if (top) { for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (x !== 7 && x !== 8 && y !== 7 && y !== 8) p.set(x, y, [150, 200, 220], 0); }
      else { for (let y = 3; y < 13; y++) { p.set(3, y, [120, 92, 55]); p.set(12, y, [120, 92, 55]); } for (let x = 3; x < 13; x++) { p.set(x, 3, [120, 92, 55]); p.set(x, 12, [120, 92, 55]); } p.set(12, 1, [60, 60, 60]); }
    };
    tex('door_bottom', (p) => doorTex(p, false));
    tex('door_top', (p) => doorTex(p, true));
    tex('ladder', (p) => {
      p.clear();
      for (let y = 0; y < S; y++) { p.set(2, y, [120, 90, 50]); p.set(3, y, [100, 74, 40]); p.set(12, y, [120, 90, 50]); p.set(13, y, [100, 74, 40]); }
      for (const y of [2, 6, 10, 14]) for (let x = 4; x < 12; x++) { p.set(x, y, [140, 108, 62]); p.set(x, y + 1, [95, 70, 40]); }
    });
    const chestBase = (p) => { planks(p, [150, 105, 50]); for (let i = 0; i < S; i++) { p.set(i, 0, [70, 45, 20]); p.set(i, 15, [70, 45, 20]); p.set(0, i, [70, 45, 20]); p.set(15, i, [70, 45, 20]); } };
    tex('chest_top', (p) => chestBase(p));
    tex('chest_side', (p) => { chestBase(p); for (let x = 0; x < S; x++) { p.set(x, 5, [60, 40, 18]); p.set(x, 6, [70, 45, 20]); } });
    tex('chest_front', (p) => {
      chestBase(p);
      for (let x = 0; x < S; x++) { p.set(x, 5, [60, 40, 18]); p.set(x, 6, [70, 45, 20]); }
      for (let y = 4; y < 9; y++) for (let x = 7; x < 9; x++) p.set(x, y, y === 4 ? [230, 230, 220] : [180, 180, 170]);
    });
    tex('lantern', (p) => {
      p.clear();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 0 || x === 15 || y === 0 || y === 15 || x === 7 || y === 7;
        p.set(x, y, edge ? [60, 60, 70] : mixc([255, 200, 80], [255, 240, 170], p.r()));
      }
    });
    tex('bed_top', (p) => {
      p.each((x, y) => p.set(x, y, y < 5 ? sh([235, 235, 235], 0.92 + p.r() * 0.08) : sh([170, 40, 40], 0.9 + p.r() * 0.12)));
      for (let x = 0; x < S; x++) p.set(x, 5, [120, 25, 25]);
    });
    tex('bed_side', (p) => {
      p.clear();
      p.each((x, y) => { if (y >= 7 && y <= 12) p.set(x, y, y < 9 ? sh([235, 235, 235], 0.95) : sh([160, 35, 35], 0.9 + p.r() * 0.1)); if (y > 12) p.set(x, y, [150, 115, 70]); });
    });

    // ---------------- Oggetti ----------------
    const plot = (p, pts, c, a) => { for (const [x, y] of pts) p.set(x, y, c, a); };
    const line = (p, x0, y0, x1, y1, c) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) p.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
    };
    const outline = (p, col) => {
      // bordo scuro attorno ai pixel opachi (stile oggetti)
      const src = new Uint8Array(p.d);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (src[(y * S + x) * 4 + 3]) continue;
        let near = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < S && ny < S && src[(ny * S + nx) * 4 + 3] > 0 && !(src[(ny * S + nx) * 4] < 40 && src[(ny * S + nx) * 4 + 1] < 40)) near = true;
        }
        if (near) p.set(x, y, col || [30, 24, 18]);
      }
    };
    const HANDLE = [[137, 103, 39], [104, 78, 30], [73, 54, 21]];
    const handle = (p, len) => {
      for (let i = 0; i < len; i++) {
        const x = 2 + i, y = 13 - i;
        p.set(x, y, HANDLE[1]); p.set(x + 1, y, HANDLE[0]);
      }
    };
    tex('stick', (p) => { p.clear(); for (let i = 0; i < 11; i++) { p.set(3 + i, 13 - i, HANDLE[1]); p.set(4 + i, 13 - i, HANDLE[0]); } outline(p); });
    const MAT = { wooden: [[160, 120, 70], [120, 88, 48], [190, 150, 95]], stone: [[130, 130, 130], [95, 95, 95], [165, 165, 165]], iron: [[216, 216, 216], [160, 160, 160], [255, 255, 255]], golden: [[250, 215, 60], [200, 150, 20], [255, 250, 150]], diamond: [[80, 230, 215], [30, 160, 150], [200, 255, 250]] };
    for (const m in MAT) {
      const [c, dk, lt] = MAT[m];
      tex(m + '_pickaxe', (p) => {
        p.clear(); handle(p, 9);
        for (let x = 3; x <= 13; x++) {
          const y = Math.round(2.2 + Math.pow(x - 8, 2) / 9);
          if (x >= 4 && x <= 12) { p.set(x, y, c); p.set(x, y + 1, dk); }
          if (x === 3 || x === 13) p.set(x, y, dk);
          if (x > 5 && x < 11) p.set(x, y - 1, lt);
        }
        outline(p);
      });
      tex(m + '_axe', (p) => {
        p.clear(); handle(p, 10);
        const pts = [[8, 2], [9, 2], [10, 2], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5], [11, 6], [12, 6]];
        plot(p, pts, c);
        plot(p, [[8, 2], [7, 3], [7, 4]], lt);
        plot(p, [[11, 6], [12, 6], [12, 5]], dk);
        outline(p);
      });
      tex(m + '_shovel', (p) => {
        p.clear(); handle(p, 8);
        const pts = [[11, 1], [12, 1], [10, 2], [11, 2], [12, 2], [13, 2], [10, 3], [11, 3], [12, 3], [13, 3], [11, 4], [12, 4]];
        plot(p, pts, c); plot(p, [[11, 1], [10, 2]], lt); plot(p, [[13, 3], [12, 4]], dk);
        outline(p);
      });
      tex(m + '_sword', (p) => {
        p.clear();
        for (let i = 0; i < 9; i++) { p.set(13 - i, 2 + i, c); p.set(14 - i, 2 + i, lt); p.set(13 - i, 3 + i, dk); }
        plot(p, [[3, 9], [4, 10], [6, 12], [7, 13], [5, 11]], [80, 60, 30]);
        plot(p, [[4, 11], [3, 12], [2, 13]], HANDLE[1]);
        p.set(1, 14, dk);
        outline(p);
      });
      tex(m + '_hoe', (p) => {
        p.clear(); handle(p, 10);
        plot(p, [[8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [12, 4]], c);
        plot(p, [[8, 2], [9, 2], [10, 2]], lt);
        outline(p);
      });
    }
    const blob = (p, cx, cy, rx, ry, cols, rough) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.pow((x + 0.5 - cx) / rx, 2) + Math.pow((y + 0.5 - cy) / ry, 2);
        if (d < 1 - (rough ? p.r() * rough : 0)) {
          const shade = 1 - ((x - cx) + (y - cy)) / (rx + ry) * 0.5;
          p.set(x, y, pal(cols, Math.min(0.99, Math.max(0, shade * 0.5 + p.r() * 0.3))));
        }
      }
    };
    tex('coal', (p) => { p.clear(); blob(p, 8, 8.5, 5.5, 5, [[20, 20, 20], [35, 35, 38], [50, 50, 55], [70, 70, 75]], 0.35); outline(p, [10, 10, 10]); });
    const ingot = (p, c, dk, lt) => {
      p.clear();
      for (let y = 5; y < 12; y++) {
        const x0 = 2 + Math.max(0, 7 - y) * 0 + (11 - y) * 0.5, x1 = 14 - (11 - y) * 0.5;
        for (let x = Math.floor(x0); x < Math.ceil(x1); x++) p.set(x, y, y === 5 ? lt : y > 9 ? dk : c);
      }
      outline(p, sh(dk, 0.5));
    };
    tex('iron_ingot', (p) => ingot(p, [215, 215, 215], [150, 150, 150], [255, 255, 255]));
    tex('gold_ingot', (p) => ingot(p, [250, 220, 70], [200, 150, 20], [255, 255, 170]));
    tex('copper_ingot', (p) => ingot(p, [220, 125, 85], [160, 80, 50], [250, 180, 140]));
    const gem = (p, c, dk, lt) => {
      p.clear();
      for (let y = 3; y < 14; y++) {
        const w = y < 6 ? (y - 3) * 2 + 4 : Math.max(1, (13 - y) * 1.1);
        for (let x = Math.round(8 - w / 2); x < Math.round(8 + w / 2); x++) p.set(x, y, y < 6 ? lt : x < 8 ? c : dk);
      }
      p.set(6, 4, [255, 255, 255]);
      outline(p, sh(dk, 0.4));
    };
    tex('diamond', (p) => gem(p, [80, 230, 215], [30, 160, 150], [200, 255, 250]));
    tex('emerald', (p) => gem(p, [40, 210, 90], [10, 130, 50], [160, 255, 190]));
    tex('lapis', (p) => { p.clear(); blob(p, 8, 8, 5, 5.5, [[20, 40, 120], [35, 70, 180], [60, 100, 220], [120, 160, 255]], 0.4); outline(p, [10, 20, 60]); });
    tex('redstone', (p) => { p.clear(); for (let i = 0; i < 40; i++) { const a = p.r() * 6.28, r = p.r() * 5; p.set(Math.round(8 + Math.cos(a) * r), Math.round(9 + Math.sin(a) * r * 0.7), [150 + p.r() * 105, 0, 0]); } });
    tex('gunpowder', (p) => { p.clear(); for (let i = 0; i < 40; i++) { const a = p.r() * 6.28, r = p.r() * 5; const g = 60 + p.r() * 60; p.set(Math.round(8 + Math.cos(a) * r), Math.round(9 + Math.sin(a) * r * 0.7), [g, g, g]); } });
    tex('string', (p) => { p.clear(); let x = 3, y = 12; for (let i = 0; i < 18; i++) { p.set(x, y, [240, 240, 240]); x += p.r() < 0.6 ? 1 : 0; y += p.r() < 0.5 ? -1 : (p.r() < 0.5 ? 1 : 0); x = Math.min(13, x); y = Math.max(2, Math.min(14, y)); } });
    tex('bone', (p) => { p.clear(); line(p, 4, 11, 11, 4, [235, 230, 210]); line(p, 5, 11, 11, 5, [210, 205, 185]); plot(p, [[3, 11], [4, 12], [3, 12], [11, 3], [12, 4], [12, 3]], [240, 235, 220]); outline(p, [90, 85, 70]); });
    tex('feather', (p) => { p.clear(); line(p, 3, 13, 12, 2, [200, 200, 200]); for (let i = 0; i < 8; i++) { p.set(5 + i, 10 - i, [250, 250, 250]); p.set(6 + i, 11 - i, [235, 235, 235]); p.set(4 + i, 9 - i, [245, 245, 245]); } });
    tex('leather', (p) => { p.clear(); blob(p, 8, 8, 6, 5.5, [[110, 60, 30], [140, 80, 40], [160, 95, 50], [180, 110, 60]], 0.25); outline(p, [60, 30, 15]); });
    tex('flint', (p) => { p.clear(); blob(p, 8, 8.5, 4.5, 5.5, [[30, 30, 30], [55, 55, 55], [80, 80, 80], [110, 110, 110]], 0.3); outline(p, [15, 15, 15]); });
    tex('wheat_item', (p) => { p.clear(); for (let i = 0; i < 5; i++) { line(p, 4 + i, 14, 6 + i * 2, 3, [200, 170, 60]); p.set(6 + i * 2, 3, [230, 200, 90]); p.set(6 + i * 2, 4, [220, 190, 80]); } line(p, 4, 11, 12, 11, [150, 110, 40]); });
    tex('wheat_seeds', (p) => { p.clear(); for (let i = 0; i < 9; i++) { const x = 3 + Math.floor(p.r() * 10), y = 4 + Math.floor(p.r() * 9); p.set(x, y, [90, 150, 40]); p.set(x + 1, y, [60, 110, 30]); } });
    tex('arrow', (p) => {
      p.clear();
      line(p, 3, 12, 12, 3, [120, 90, 50]);
      plot(p, [[11, 3], [12, 3], [12, 4], [13, 2], [12, 2], [13, 3]], [180, 180, 180]);
      plot(p, [[2, 12], [3, 13], [2, 13], [1, 13], [2, 14], [4, 13], [3, 11]], [240, 240, 240]);
    });
    tex('bow', (p) => {
      p.clear();
      for (let i = 0; i < 12; i++) { const a = -0.3 + (i / 11) * 2.2; p.set(Math.round(3 + Math.cos(a - 0.6) * 9), Math.round(12 - Math.sin(a + 0.6) * 9), [120, 90, 50]); }
      line(p, 3, 3, 12, 12, [230, 230, 230]);
      outline(p, [60, 45, 25]);
    });
    tex('flint_and_steel', (p) => { p.clear(); plot(p, [[3, 5], [4, 4], [5, 4], [6, 5], [6, 6], [5, 7], [4, 8]], [180, 180, 180]); blob(p, 10.5, 10.5, 3, 3, [[30, 30, 30], [60, 60, 60], [90, 90, 90]], 0.2); outline(p, [20, 20, 20]); });
    // cibo
    tex('apple', (p) => { p.clear(); blob(p, 8, 9.5, 5.5, 5, [[150, 10, 10], [200, 25, 20], [230, 50, 40], [255, 120, 110]], 0); plot(p, [[8, 3], [8, 4]], [100, 70, 30]); plot(p, [[9, 3], [10, 2], [10, 3]], [60, 150, 40]); outline(p, [60, 5, 5]); });
    tex('golden_apple', (p) => { p.clear(); blob(p, 8, 9.5, 5.5, 5, [[200, 150, 10], [240, 200, 40], [255, 230, 90], [255, 255, 200]], 0); plot(p, [[8, 3], [8, 4]], [100, 70, 30]); plot(p, [[9, 3], [10, 2], [10, 3]], [60, 150, 40]); outline(p, [90, 60, 5]); });
    tex('bread', (p) => { p.clear(); blob(p, 8, 9, 7, 3.5, [[150, 90, 30], [180, 115, 45], [200, 140, 60], [220, 170, 90]], 0); for (const x of [5, 8, 11]) p.set(x, 7, [235, 200, 130]); outline(p, [80, 45, 15]); });
    const meat = (p, base, fat, dk) => { p.clear(); blob(p, 8, 8.5, 6, 4.5, [dk, base, sh(base, 1.15), fat], 0.1); line(p, 3, 7, 5, 5, fat); outline(p, sh(dk, 0.5)); };
    tex('porkchop', (p) => meat(p, [230, 130, 130], [250, 220, 220], [190, 90, 90]));
    tex('cooked_porkchop', (p) => meat(p, [190, 130, 90], [230, 200, 160], [140, 90, 60]));
    tex('beef', (p) => meat(p, [200, 40, 40], [240, 220, 220], [150, 20, 20]));
    tex('steak', (p) => meat(p, [130, 80, 45], [190, 150, 110], [90, 50, 25]));
    tex('mutton', (p) => meat(p, [210, 70, 70], [245, 230, 230], [160, 40, 40]));
    tex('cooked_mutton', (p) => meat(p, [150, 95, 60], [210, 180, 150], [100, 60, 35]));
    tex('rotten_flesh', (p) => meat(p, [140, 90, 60], [110, 130, 60], [90, 60, 40]));
    const drum = (p, c, dk) => { p.clear(); blob(p, 9.5, 6.5, 4.5, 4, [dk, c, sh(c, 1.1), sh(c, 1.2)], 0.1); line(p, 6, 9, 3, 12, [240, 235, 220]); plot(p, [[2, 12], [3, 13], [2, 13]], [250, 250, 240]); outline(p, sh(dk, 0.5)); };
    tex('chicken', (p) => drum(p, [245, 200, 180], [210, 160, 140]));
    tex('cooked_chicken', (p) => drum(p, [200, 140, 70], [150, 95, 40]));
    tex('carrot', (p) => { p.clear(); for (let i = 0; i < 9; i++) { p.set(4 + i, 12 - i, [240, 130, 20]); p.set(5 + i, 12 - i, [220, 110, 15]); p.set(4 + i, 11 - i, [250, 160, 40]); } plot(p, [[13, 2], [14, 1], [12, 1], [14, 3]], [60, 150, 40]); outline(p, [100, 50, 5]); });
    // uova generatrici
    for (const [m, , c1, c2] of MC.EGG_COLORS) {
      tex('egg_' + m, (p) => {
        p.clear();
        for (let y = 2; y < 15; y++) {
          const ty = (y - 2) / 12;
          const w = Math.sqrt(Math.max(0, 1 - Math.pow((ty - 0.58) / 0.62, 2))) * 5.2 * (ty < 0.5 ? 0.85 + ty * 0.3 : 1);
          for (let x = Math.round(8 - w); x < Math.round(8 + w); x++) {
            const shd = 1.08 - (x - 5) * 0.03 - ty * 0.1;
            p.set(x, y, sh(c1, shd));
          }
        }
        for (let i = 0; i < 9; i++) {
          const x = 4 + Math.floor(p.r() * 8), y = 4 + Math.floor(p.r() * 9);
          if (p.alpha(x, y) && p.alpha(x + 1, y)) { p.set(x, y, c2); if (p.r() < 0.6) p.set(x + 1, y, sh(c2, 0.9)); }
        }
        outline(p, sh(c1, 0.35));
      });
    }

    // Crepe di rottura (10 stadi)
    const crackRng = mulberry32(12345);
    const pts = [];
    for (let i = 0; i < 4; i++) {
      let x = 4 + crackRng() * 8, y = 4 + crackRng() * 8;
      const ang = crackRng() * Math.PI * 2;
      for (let k = 0; k < 40; k++) {
        const a = ang + Math.sin(k * 0.7 + i) * 0.9 + (crackRng() - 0.5) * 1.2;
        x += Math.cos(a) * 0.8; y += Math.sin(a) * 0.8;
        pts.push([Math.floor(x), Math.floor(y), k + crackRng() * 12]);
      }
    }
    for (let s = 0; s < 10; s++) {
      tex('destroy_' + s, (p) => {
        p.clear();
        const lim = (s + 1) * 5.2;
        for (const [x, y, k] of pts) {
          if (k < lim && x >= 0 && y >= 0 && x < S && y < S) p.set(x, y, [20, 20, 20], 200);
        }
      });
    }

    // Texture per le creature
    const skin = (name, base, amt) => tex(name, (p) => flatTex(p, base, amt || 0.12));
    skin('pig_skin', [240, 160, 160]);
    tex('pig_face', (p) => {
      flatTex(p, [240, 160, 160], 0.1);
      p.set(3, 6, [255, 255, 255]); p.set(4, 6, [20, 20, 20]); p.set(11, 6, [20, 20, 20]); p.set(12, 6, [255, 255, 255]);
      for (let y = 9; y < 13; y++) for (let x = 5; x < 11; x++) p.set(x, y, [250, 180, 180]);
      p.set(6, 10, [150, 80, 80]); p.set(9, 10, [150, 80, 80]);
    });
    tex('cow_skin', (p) => {
      flatTex(p, [70, 50, 35], 0.15);
      const n = p.tnoise(4);
      p.each((x, y) => { if (n(x, y) > 0.62) p.set(x, y, sh([230, 230, 225], 0.9 + p.r() * 0.1)); });
    });
    tex('cow_face', (p) => {
      flatTex(p, [70, 50, 35], 0.12);
      for (let y = 4; y < 9; y++) for (let x = 5; x < 11; x++) p.set(x, y, [230, 230, 225]);
      p.set(3, 6, [20, 20, 20]); p.set(12, 6, [20, 20, 20]);
      for (let y = 10; y < 14; y++) for (let x = 4; x < 12; x++) p.set(x, y, [180, 150, 140]);
      p.set(6, 11, [60, 40, 40]); p.set(9, 11, [60, 40, 40]);
    });
    skin('sheep_wool', [235, 235, 230], 0.1);
    skin('sheep_skin', [220, 200, 180]);
    tex('sheep_face', (p) => {
      flatTex(p, [220, 200, 180], 0.1);
      p.set(3, 7, [255, 255, 255]); p.set(4, 7, [20, 20, 20]); p.set(11, 7, [20, 20, 20]); p.set(12, 7, [255, 255, 255]);
      for (let x = 6; x < 10; x++) p.set(x, 11, [200, 150, 150]);
    });
    skin('chicken_skin', [245, 245, 245], 0.08);
    tex('chicken_face', (p) => {
      flatTex(p, [245, 245, 245], 0.08);
      p.set(3, 5, [20, 20, 20]); p.set(12, 5, [20, 20, 20]);
      for (let y = 8; y < 11; y++) for (let x = 5; x < 11; x++) p.set(x, y, [240, 170, 40]);
      for (let y = 11; y < 14; y++) for (let x = 6; x < 10; x++) p.set(x, y, [200, 30, 30]);
    });
    skin('chicken_leg', [240, 170, 40]);
    skin('zombie_skin', [80, 140, 70]);
    tex('zombie_face', (p) => {
      flatTex(p, [80, 140, 70], 0.12);
      p.set(4, 7, [20, 40, 20]); p.set(5, 7, [20, 40, 20]); p.set(10, 7, [20, 40, 20]); p.set(11, 7, [20, 40, 20]);
      for (let x = 6; x < 10; x++) p.set(x, 11, [40, 70, 35]);
      for (let x = 4; x < 12; x++) p.set(x, 2, [50, 90, 45]);
    });
    skin('zombie_shirt', [40, 160, 170]);
    skin('zombie_pants', [60, 50, 140]);
    skin('hoof', [80, 60, 50]);
    skin('white', [255, 255, 255], 0);
  }

  function build() {
    if (layers.length) return;
    buildAll();
  }

  // Colore medio (per particelle e mappe)
  function averageColor(name) {
    const d = cache[name];
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    return n ? [r / n, g / n, b / n] : [128, 128, 128];
  }

  MC.textures = { build, layers, index, cache, size: S, averageColor };
})();
