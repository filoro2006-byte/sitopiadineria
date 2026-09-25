// Mondo: chunk, luce, aggiornamenti dei blocchi, fluidi
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const B = MC.B;
  const { OPAQUE, SOLID, LIGHT_OPACITY, EMIT, FLUID, REPLACEABLE } = MC.BL;
  const WH = MC.WH, NS = WH / 16;
  const VOL = 16 * 16 * WH;

  const ST = { NONE: 0, TERRAIN: 1, POPULATED: 2, LIT: 3, READY: 4 };
  const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
  const DOWN = 3;

  function ckey(cx, cz) { return (cx & 0xffff) * 65536 + (cz & 0xffff); }

  class Chunk {
    constructor(cx, cz) {
      this.cx = cx; this.cz = cz;
      this.blocks = new Uint8Array(VOL);
      this.light = new Uint8Array(VOL);
      this.meta = null;
      this.state = ST.NONE;
      this.biome = new Uint8Array(256);
      this.grass = new Uint8Array(768);
      this.foliage = new Uint8Array(768);
      this.surf = new Uint8Array(256);
      this.surfId = new Uint8Array(256);
      this.dirty = new Uint8Array(NS); // 1 = da rifare, 2 = urgente
      this.meshes = new Array(NS).fill(null);
      this.modified = false;
      this.fromSave = false;
    }
    getMeta(i) { return this.meta ? this.meta[i] : 0; }
    setMeta(i, v) {
      if (!this.meta) { if (!v) return; this.meta = new Uint8Array(VOL); }
      this.meta[i] = v;
    }
  }

  // Codifica RLE per i salvataggi
  function rleEncode(arr) {
    const out = [];
    let i = 0;
    while (i < arr.length) {
      const v = arr[i];
      let n = 1;
      while (i + n < arr.length && arr[i + n] === v && n < 65535) n++;
      out.push(v, n);
      i += n;
    }
    return new Uint16Array(out);
  }
  function rleDecode(rle, target) {
    let p = 0;
    for (let i = 0; i < rle.length; i += 2) {
      const v = rle[i], n = rle[i + 1];
      target.fill(v, p, p + n);
      p += n;
    }
  }

  class World {
    constructor(opts) {
      this.seed = opts.seed >>> 0;
      this.type = opts.type || 'normal';
      this.gen = new MC.Generator(this.seed, this.type);
      this.chunks = new Map();
      this.saved = opts.saved || new Map(); // key -> {b, m, s, si}
      this.renderDist = opts.renderDist || 8;
      this.tickCount = 0;
      this.updates = new Map();
      this.urgent = false;
      this.onDrop = null; // (id, x, y, z)
      this.onUnload = null; // (chunk)
      this.onSaveChunk = null; // (key, data)
      this.onBlockChange = null; // (x,y,z,old,new)
      this._lcx = NaN; this._lcz = NaN; this._lc = null;
      this.offsets = [];
      this._buildOffsets(32);
      this.dirtySave = new Set();
      this.worker = null;
      this.pending = new Map(); // chiave -> tempo della richiesta
    }

    // Generazione del terreno in un Web Worker (se disponibile)
    attachWorker(worker) {
      this.worker = worker;
      worker.onmessage = (e) => {
        const d = e.data;
        const k = ckey(d.cx, d.cz);
        if (!this.pending.has(k)) return;
        this.pending.delete(k);
        if (this.chunks.has(k)) return;
        const c = new Chunk(d.cx, d.cz);
        c.blocks = d.blocks; c.biome = d.biome; c.grass = d.grass; c.foliage = d.foliage; c.surf = d.surf; c.surfId = d.surfId;
        c.state = ST.TERRAIN;
        this.chunks.set(k, c);
        this._resetCache();
      };
      worker.onerror = () => { this.worker = null; this.pending.clear(); };
    }
    destroy() {
      if (this.worker) { try { this.worker.terminate(); } catch (e) { /* ignora */ } this.worker = null; }
    }

    _buildOffsets(r) {
      this.offsets = [];
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d <= r + 0.5) this.offsets.push([dx, dz, d]);
      }
      this.offsets.sort((a, b) => a[2] - b[2]);
    }

    getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }

    _c(x, z) {
      const cx = x >> 4, cz = z >> 4;
      if (cx === this._lcx && cz === this._lcz) return this._lc;
      const c = this.chunks.get(ckey(cx, cz));
      this._lcx = cx; this._lcz = cz; this._lc = c;
      return c;
    }
    _resetCache() { this._lcx = NaN; this._lcz = NaN; this._lc = null; }

    getBlock(x, y, z) {
      if (y < 0 || y >= WH) return 0;
      const c = this._c(x, z);
      if (!c || c.state < ST.TERRAIN) return 0;
      return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
    }
    getMeta(x, y, z) {
      if (y < 0 || y >= WH) return 0;
      const c = this._c(x, z);
      if (!c || !c.meta) return 0;
      return c.meta[(y << 8) | ((z & 15) << 4) | (x & 15)];
    }
    getSky(x, y, z) {
      if (y >= WH) return 15;
      if (y < 0) return 0;
      const c = this._c(x, z);
      if (!c || c.state < ST.LIT) return 15;
      return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] >> 4;
    }
    getBlockLight(x, y, z) {
      if (y < 0 || y >= WH) return 0;
      const c = this._c(x, z);
      if (!c) return 0;
      return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] & 15;
    }
    isReady(x, z) {
      const c = this._c(Math.floor(x), Math.floor(z));
      return !!c && c.state === ST.READY;
    }
    biomeAt(x, z) {
      const c = this._c(x, z);
      if (c && c.state >= 1) return c.biome[((z & 15) << 4) | (x & 15)];
      return this.gen.biomeAt(x, z);
    }

    // ---------------- Gestione chunk ----------------
    _neighborsAtLeast(c, st) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const n = this.chunks.get(ckey(c.cx + dx, c.cz + dz));
        if (!n || n.state < st) return false;
      }
      return true;
    }

    _createChunk(cx, cz) {
      const c = new Chunk(cx, cz);
      const k = ckey(cx, cz);
      const sv = this.saved.get(k);
      if (sv) {
        rleDecode(sv.b, c.blocks);
        if (sv.m) { c.meta = new Uint8Array(VOL); rleDecode(sv.m, c.meta); }
        c.surf.set(sv.s); c.surfId.set(sv.si);
        this.gen.fillClimate(c);
        c.fromSave = true;
        c.state = ST.POPULATED;
      } else {
        this.gen.generateTerrain(c);
        c.state = ST.TERRAIN;
      }
      this.chunks.set(k, c);
      this._resetCache();
      return c;
    }

    // Avanza la pipeline di generazione con un budget di tempo
    updateLoading(px, pz, budgetMs) {
      const t0 = performance.now();
      const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
      const R = this.renderDist;
      let work = 0;
      if (this.pending.size) {
        const now = performance.now();
        for (const [k, t] of this.pending) if (now - t > 15000) this.pending.delete(k);
      }
      for (let oi = 0; oi < this.offsets.length; oi++) {
        const o = this.offsets[oi];
        const d = o[2];
        if (d > R + 3) break;
        const cx = pcx + o[0], cz = pcz + o[1];
        const key = ckey(cx, cz);
        let c = this.chunks.get(key);
        if (!c) {
          if (this.worker && !this.saved.has(key)) {
            if (!this.pending.has(key) && this.pending.size < 12) {
              this.pending.set(key, performance.now());
              this.worker.postMessage({ cx, cz });
            }
            continue;
          }
          c = this._createChunk(cx, cz);
          work++;
          if (performance.now() - t0 > budgetMs) return work;
          continue;
        }
        if (c.state === ST.TERRAIN && d <= R + 2 && this._neighborsAtLeast(c, ST.TERRAIN)) {
          this.gen.populate(this, c);
          c.state = ST.POPULATED;
          work++;
          if (performance.now() - t0 > budgetMs) return work;
        }
        if (c.state === ST.POPULATED && d <= R + 1 && this._neighborsAtLeast(c, ST.POPULATED)) {
          this._lightChunk(c);
          c.state = ST.LIT;
          work++;
          if (performance.now() - t0 > budgetMs) return work;
        }
        if (c.state === ST.LIT && d <= R && this._neighborsAtLeast(c, ST.LIT)) {
          c.state = ST.READY;
          c.dirty.fill(1);
        }
      }
      return work;
    }

    unloadFar(px, pz) {
      const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
      const lim = this.renderDist + 4.5;
      const rm = [];
      for (const [k, c] of this.chunks) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (dx * dx + dz * dz > lim * lim) rm.push(k);
      }
      for (const k of rm) {
        const c = this.chunks.get(k);
        if (c.modified) this.saveChunk(c);
        if (this.onUnload) this.onUnload(c);
        this.chunks.delete(k);
      }
      if (rm.length) this._resetCache();
    }

    serializeChunk(c) {
      return {
        b: rleEncode(c.blocks),
        m: c.meta ? rleEncode(c.meta) : null,
        s: new Uint8Array(c.surf),
        si: new Uint8Array(c.surfId),
      };
    }
    saveChunk(c) {
      const k = ckey(c.cx, c.cz);
      const data = this.serializeChunk(c);
      this.saved.set(k, data);
      c.modified = false;
      this.dirtySave.delete(c);
      if (this.onSaveChunk) this.onSaveChunk(k, data);
    }
    saveAll() {
      for (const c of this.chunks.values()) if (c.modified) this.saveChunk(c);
    }

    // ---------------- Luce ----------------
    _markLight(c, x, y, z) {
      if (c.state !== ST.READY) return;
      this._markDirtyAround(x, y, z);
    }

    _markDirtyAround(x, y, z) {
      const lx = x & 15, lz = z & 15, ly = y & 15;
      const x0 = lx === 0 ? -1 : 0, x1 = lx === 15 ? 1 : 0;
      const z0 = lz === 0 ? -1 : 0, z1 = lz === 15 ? 1 : 0;
      const y0 = ly === 0 ? -1 : 0, y1 = ly === 15 ? 1 : 0;
      const cx = x >> 4, cz = z >> 4, sy = y >> 4;
      const v = this.urgent ? 2 : 1;
      for (let oz = z0; oz <= z1; oz++) for (let ox = x0; ox <= x1; ox++) {
        const c = (ox === 0 && oz === 0) ? this._c(x, z) : this.chunks.get(ckey(cx + ox, cz + oz));
        if (!c || c.state !== ST.READY) continue;
        for (let oy = y0; oy <= y1; oy++) {
          const s = sy + oy;
          if (s < 0 || s >= NS) continue;
          if (c.dirty[s] < v) c.dirty[s] = v;
        }
      }
    }

    _lightChunk(c) {
      const bx = c.cx * 16, bz = c.cz * 16;
      const blocks = c.blocks, light = c.light;
      const skyQ = [], blkQ = [];
      const top15 = new Int16Array(256);
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        let level = 15;
        let y = WH - 1;
        let t15 = WH;
        for (; y >= 0; y--) {
          const i = (y << 8) | (z << 4) | x;
          const op = LIGHT_OPACITY[blocks[i]];
          if (level === 15 && op === 0) { light[i] = 0xf0 | (light[i] & 15); t15 = y; continue; }
          if (op >= 15) break;
          level -= op > 1 ? op : 1;
          if (level <= 0) break;
          if ((light[i] >> 4) < level) light[i] = (level << 4) | (light[i] & 15);
          skyQ.push(bx + x, y, bz + z);
        }
        top15[(z << 4) | x] = t15;
      }
      const colTop15 = (ch, x, z) => {
        let y = WH - 1;
        const b = ch.blocks;
        for (; y >= 0; y--) if (LIGHT_OPACITY[b[(y << 8) | (z << 4) | x]] !== 0) break;
        return y + 1;
      };
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const t = top15[(z << 4) | x];
        for (let d = 0; d < 4; d++) {
          const ddx = [1, -1, 0, 0][d], ddz = [0, 0, 1, -1][d];
          const nx = x + ddx, nz = z + ddz;
          let tn;
          if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16) tn = top15[(nz << 4) | nx];
          else {
            const ch = this.chunks.get(ckey(c.cx + (nx < 0 ? -1 : nx > 15 ? 1 : 0), c.cz + (nz < 0 ? -1 : nz > 15 ? 1 : 0)));
            if (!ch || ch.state < ST.POPULATED) continue;
            tn = colTop15(ch, nx & 15, nz & 15);
          }
          for (let y = t; y < tn && y < WH; y++) skyQ.push(bx + x, y, bz + z);
        }
      }
      // luce dei blocchi emissivi
      for (let i = 0; i < VOL; i++) {
        const e = EMIT[blocks[i]];
        if (e > 0) {
          if ((light[i] & 15) < e) light[i] = (light[i] & 0xf0) | e;
          blkQ.push(bx + (i & 15), i >> 8, bz + ((i >> 4) & 15));
        }
      }
      // luce dai vicini già illuminati
      // luce dai vicini già illuminati: solo le celle di bordo che possono aumentare la nostra
      const pull = (ch, nx, nz, ox, oz) => {
        const nbx = ch.cx * 16, nbz = ch.cz * 16;
        const nl = ch.light;
        for (let k = 0; k < 16; k++) {
          const x = nx < 0 ? k : nx, z = nz < 0 ? k : nz;
          const lx = ox < 0 ? k : ox, lz = oz < 0 ? k : oz;
          for (let y = 0; y < WH; y++) {
            const v = nl[(y << 8) | (z << 4) | x];
            if (v < 0x20 && (v & 15) < 2) continue;
            const o = light[(y << 8) | (lz << 4) | lx];
            if ((v >> 4) - 1 > (o >> 4)) skyQ.push(nbx + x, y, nbz + z);
            if ((v & 15) - 1 > (o & 15)) blkQ.push(nbx + x, y, nbz + z);
          }
        }
      };
      let n = this.chunks.get(ckey(c.cx + 1, c.cz)); if (n && n.state >= ST.LIT) pull(n, 0, -1, 15, -1);
      n = this.chunks.get(ckey(c.cx - 1, c.cz)); if (n && n.state >= ST.LIT) pull(n, 15, -1, 0, -1);
      n = this.chunks.get(ckey(c.cx, c.cz + 1)); if (n && n.state >= ST.LIT) pull(n, -1, 0, -1, 15);
      n = this.chunks.get(ckey(c.cx, c.cz - 1)); if (n && n.state >= ST.LIT) pull(n, -1, 15, -1, 0);
      this._propagate(skyQ, true);
      this._propagate(blkQ, false);
    }

    _propagate(q, sky) {
      let head = 0;
      while (head < q.length) {
        const x = q[head++], y = q[head++], z = q[head++];
        const c = this._c(x, z);
        if (!c || c.state < ST.POPULATED) continue;
        const v = c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];
        const L = sky ? v >> 4 : v & 15;
        if (L <= 1) continue;
        for (let d = 0; d < 6; d++) {
          const ny = y + DY[d];
          if (ny < 0 || ny >= WH) continue;
          const nx = x + DX[d], nz = z + DZ[d];
          const nc = (d === 2 || d === 3) ? c : this._c(nx, nz);
          if (!nc || nc.state < ST.POPULATED) continue;
          const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
          const op = LIGHT_OPACITY[nc.blocks[ni]];
          if (op >= 15) continue;
          const nl = (sky && d === DOWN && L === 15 && op === 0) ? 15 : L - (op > 1 ? op : 1);
          if (nl <= 0) continue;
          const nv = nc.light[ni];
          if (sky) {
            if ((nv >> 4) >= nl) continue;
            nc.light[ni] = (nl << 4) | (nv & 15);
          } else {
            if ((nv & 15) >= nl) continue;
            nc.light[ni] = (nv & 0xf0) | nl;
          }
          if (nc.state === ST.READY) this._markDirtyAround(nx, ny, nz);
          q.push(nx, ny, nz);
        }
      }
    }

    _getL(c, i, sky) { return sky ? c.light[i] >> 4 : c.light[i] & 15; }
    _setL(c, i, sky, v) {
      if (sky) c.light[i] = (v << 4) | (c.light[i] & 15);
      else c.light[i] = (c.light[i] & 0xf0) | v;
    }

    _relight(x, y, z) {
      for (let pass = 0; pass < 2; pass++) {
        const sky = pass === 0;
        const c = this._c(x, z);
        const i = (y << 8) | ((z & 15) << 4) | (x & 15);
        const old = this._getL(c, i, sky);
        const rq = [], aq = [];
        if (old > 0) { this._setL(c, i, sky, 0); rq.push(x, y, z, old); }
        let h = 0;
        while (h < rq.length) {
          const px = rq[h++], py = rq[h++], pz = rq[h++], pl = rq[h++];
          for (let d = 0; d < 6; d++) {
            const ny = py + DY[d];
            if (ny < 0 || ny >= WH) continue;
            const nx = px + DX[d], nz = pz + DZ[d];
            const nc = this._c(nx, nz);
            if (!nc || nc.state < ST.POPULATED) continue;
            const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
            const nl = this._getL(nc, ni, sky);
            if (nl === 0) continue;
            if (nl < pl || (sky && d === DOWN && pl === 15 && nl === 15)) {
              this._setL(nc, ni, sky, 0);
              this._markDirtyAround(nx, ny, nz);
              rq.push(nx, ny, nz, nl);
              if (!sky) {
                const e = EMIT[nc.blocks[ni]];
                if (e > 0) { this._setL(nc, ni, false, e); aq.push(nx, ny, nz); }
              }
            } else {
              aq.push(nx, ny, nz);
            }
          }
        }
        const b = c.blocks[i];
        if (!sky && EMIT[b] > 0) { this._setL(c, i, false, EMIT[b]); aq.push(x, y, z); }
        if (sky && y === WH - 1 && LIGHT_OPACITY[b] === 0) { this._setL(c, i, true, 15); aq.push(x, y, z); }
        for (let d = 0; d < 6; d++) {
          const ny = y + DY[d];
          if (ny < 0 || ny >= WH) continue;
          aq.push(x + DX[d], ny, z + DZ[d]);
        }
        this._propagate(aq, sky);
      }
    }

    // ---------------- Modifica blocchi ----------------
    setBlock(x, y, z, id, meta, opts) {
      if (y < 0 || y >= WH) return false;
      const c = this._c(x, z);
      if (!c || c.state < ST.POPULATED) return false;
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      const old = c.blocks[i];
      const oldMeta = c.getMeta(i);
      meta = meta | 0;
      if (old === id && oldMeta === meta) return false;
      c.blocks[i] = id;
      c.setMeta(i, meta);
      c.modified = true;
      if (c.state >= ST.LIT && (LIGHT_OPACITY[old] !== LIGHT_OPACITY[id] || EMIT[old] !== EMIT[id])) {
        this._relight(x, y, z);
      }
      if (c.state === ST.READY) this._markDirtyAround(x, y, z);
      if (!opts || !opts.noUpdate) this._notify(x, y, z);
      if (this.onBlockChange) this.onBlockChange(x, y, z, old, id);
      return true;
    }

    // Rompe un blocco generando il drop
    breakBlock(x, y, z, drop) {
      const id = this.getBlock(x, y, z);
      if (!id) return;
      this.setBlock(x, y, z, 0, 0);
      if (drop && this.onDrop) this.onDrop(id, x, y, z);
    }

    // ---------------- Aggiornamenti programmati ----------------
    schedule(x, y, z, delay) {
      const k = x + ',' + y + ',' + z;
      const t = this.tickCount + delay;
      const cur = this.updates.get(k);
      if (cur !== undefined && cur <= t) return;
      this.updates.set(k, t);
    }

    _needsUpdate(id) {
      const d = MC.blocks[id];
      return d && (d.fluid || d.gravity || d.support || d.shape === 'torch' || d.shape === 'cactus');
    }

    _delayFor(id) {
      const f = FLUID[id];
      if (f === 1) return 5;
      if (f === 2) return 30;
      if (MC.blocks[id].gravity) return 2;
      return 1;
    }

    _notify(x, y, z) {
      for (let d = -1; d < 6; d++) {
        const nx = d < 0 ? x : x + DX[d], ny = d < 0 ? y : y + DY[d], nz = d < 0 ? z : z + DZ[d];
        if (ny < 0 || ny >= WH) continue;
        const b = this.getBlock(nx, ny, nz);
        if (b && this._needsUpdate(b)) this.schedule(nx, ny, nz, this._delayFor(b));
      }
    }

    tick() {
      this.tickCount++;
      if (!this.updates.size) return;
      const due = [];
      for (const [k, t] of this.updates) {
        if (t <= this.tickCount) { due.push(k); if (due.length >= 600) break; }
      }
      for (const k of due) {
        this.updates.delete(k);
        const p = k.split(',');
        this._blockUpdate(+p[0], +p[1], +p[2]);
      }
    }

    _blockUpdate(x, y, z) {
      const c = this._c(x, z);
      if (!c || c.state < ST.LIT) return;
      const id = this.getBlock(x, y, z);
      if (!id) return;
      const d = MC.blocks[id];
      if (d.fluid) return this._fluidUpdate(x, y, z, id);
      if (d.gravity) {
        const below = this.getBlock(x, y - 1, z);
        if (y > 0 && (below === 0 || FLUID[below] || (REPLACEABLE[below] && MC.blocks[below].shape === 'cross'))) {
          const meta = this.getMeta(x, y, z);
          this.setBlock(x, y, z, 0, 0);
          this.setBlock(x, y - 1, z, id, meta);
        }
        return;
      }
      if (d.shape === 'torch') {
        const m = this.getMeta(x, y, z);
        let sx = x, sy = y, sz = z;
        if (m === 0) sy = y - 1;
        else if (m === 1) sx = x - 1; else if (m === 2) sx = x + 1; else if (m === 3) sz = z - 1; else if (m === 4) sz = z + 1;
        const s = this.getBlock(sx, sy, sz);
        if (!OPAQUE[s]) this.breakBlock(x, y, z, true);
        return;
      }
      if (d.shape === 'cactus') {
        for (let k = 0; k < 4; k++) {
          const b = this.getBlock(x + DX[k], y, z + DZ[k]);
          if (SOLID[b]) { this.breakBlock(x, y, z, true); return; }
        }
      }
      if (d.support) {
        const below = this.getBlock(x, y - 1, z);
        if (!d.support(below)) this.breakBlock(x, y, z, true);
      }
    }

    _canFlowInto(b) {
      if (b === 0) return true;
      const d = MC.blocks[b];
      return d.shape === 'cross' || d.shape === 'torch';
    }

    _fluidUpdate(x, y, z, id) {
      const F = FLUID[id];
      const meta = this.getMeta(x, y, z);
      const drop = F === 1 ? 1 : 2;
      const other = F === 1 ? B.lava : B.water;
      // interazione lava-acqua
      if (F === 2) {
        for (let d = 0; d < 6; d++) {
          if (d === DOWN) continue;
          if (this.getBlock(x + DX[d], y + DY[d], z + DZ[d]) === B.water) {
            this.setBlock(x, y, z, meta === 0 ? B.obsidian : B.cobblestone, 0);
            return;
          }
        }
      }
      const isSource = meta === 0;
      let level = meta & 7, falling = (meta & 8) !== 0;
      if (!isSource) {
        let newMeta = -1;
        const above = this.getBlock(x, y + 1, z);
        if (FLUID[above] === F) newMeta = 8;
        else {
          let minL = 99, sources = 0;
          for (let d = 0; d < 6; d++) {
            if (d === 2 || d === 3) continue;
            const nx = x + DX[d], nz = z + DZ[d];
            const nb = this.getBlock(nx, y, nz);
            if (FLUID[nb] !== F) continue;
            const nm = this.getMeta(nx, y, nz);
            if (nm === 0) sources++;
            const nlv = (nm & 8) ? 0 : nm & 7;
            if (nlv < minL) minL = nlv;
          }
          const below = this.getBlock(x, y - 1, z);
          if (F === 1 && sources >= 2 && (SOLID[below] || (below === B.water && this.getMeta(x, y - 1, z) === 0))) newMeta = 0;
          else if (minL + drop <= 7) newMeta = minL + drop;
        }
        if (newMeta === -1) { this.setBlock(x, y, z, 0, 0); return; }
        if (newMeta !== meta) {
          this.setBlock(x, y, z, id, newMeta);
          return;
        }
        level = newMeta & 7; falling = (newMeta & 8) !== 0;
      }
      // caduta
      if (y > 0) {
        const below = this.getBlock(x, y - 1, z);
        if (below === other) {
          this.setBlock(x, y - 1, z, F === 1 ? (this.getMeta(x, y - 1, z) === 0 ? B.obsidian : B.cobblestone) : B.stone, 0);
          return;
        }
        if (this._canFlowInto(below)) {
          if (below && this.onDrop) this.onDrop(below, x, y - 1, z);
          this.setBlock(x, y - 1, z, id, 8);
          return;
        }
        if (FLUID[below] === F) {
          const bm = this.getMeta(x, y - 1, z);
          if (bm !== 0 && !(bm & 8)) this.setBlock(x, y - 1, z, id, 8);
          if (bm !== 0) return; // continua a cadere
        }
      }
      // espansione orizzontale
      const myLevel = falling ? 0 : level;
      const nl = myLevel + drop;
      if (nl > 7) return;
      for (let d = 0; d < 6; d++) {
        if (d === 2 || d === 3) continue;
        const nx = x + DX[d], nz = z + DZ[d];
        const nb = this.getBlock(nx, y, nz);
        if (!this._c(nx, nz) || this._c(nx, nz).state < ST.LIT) continue;
        if (nb === other) {
          this.setBlock(nx, y, nz, F === 1 ? (this.getMeta(nx, y, nz) === 0 ? B.obsidian : B.cobblestone) : B.cobblestone, 0);
          continue;
        }
        if (this._canFlowInto(nb)) {
          if (nb && this.onDrop) this.onDrop(nb, nx, y, nz);
          this.setBlock(nx, y, nz, id, nl);
        } else if (FLUID[nb] === F) {
          const m2 = this.getMeta(nx, y, nz);
          if (m2 !== 0 && !(m2 & 8) && (m2 & 7) > nl) this.setBlock(nx, y, nz, id, nl);
        }
      }
    }

    // Tick casuali: erba che si espande, piante che crescono
    randomTicks(px, pz, rng) {
      const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const c = this.chunks.get(ckey(pcx + dx, pcz + dz));
        if (!c || c.state !== ST.READY) continue;
        for (let s = 0; s < NS; s++) {
          for (let k = 0; k < 2; k++) {
            const lx = (rng() * 16) | 0, ly = s * 16 + ((rng() * 16) | 0), lz = (rng() * 16) | 0;
            const i = (ly << 8) | (lz << 4) | lx;
            const b = c.blocks[i];
            if (b !== B.grass && b !== B.dirt && b !== B.sugar_cane && b !== B.cactus) continue;
            const x = c.cx * 16 + lx, z = c.cz * 16 + lz;
            const above = ly + 1 < WH ? c.blocks[i + 256] : 0;
            if (b === B.grass) {
              if (OPAQUE[above] || FLUID[above]) this.setBlock(x, ly, z, B.dirt, 0);
            } else if (b === B.dirt) {
              if (above !== 0 && !(MC.blocks[above].shape === 'cross')) continue;
              if (ly + 1 < WH && (c.light[i + 256] >> 4) < 9) continue;
              let found = false;
              for (let t = 0; t < 6 && !found; t++) {
                const gx = x + ((rng() * 3) | 0) - 1, gy = ly + ((rng() * 3) | 0) - 1, gz = z + ((rng() * 3) | 0) - 1;
                if (this.getBlock(gx, gy, gz) === B.grass) found = true;
              }
              if (found) this.setBlock(x, ly, z, B.grass, 0);
            } else if ((b === B.sugar_cane || b === B.cactus) && above === 0 && rng() < 0.15) {
              let hgt = 1;
              while (hgt < 4 && this.getBlock(x, ly - hgt, z) === b) hgt++;
              if (hgt < 3 && ly + 1 < WH) {
                if (b === B.cactus) {
                  let ok = true;
                  for (let q = 0; q < 4; q++) if (SOLID[this.getBlock(x + DX[q], ly + 1, z + DZ[q])]) ok = false;
                  if (!ok) continue;
                }
                this.setBlock(x, ly + 1, z, b, 0);
              }
            }
          }
        }
      }
    }

    // Altezza del primo blocco solido (per spawn)
    topSolid(x, z) {
      for (let y = WH - 1; y > 0; y--) {
        const b = this.getBlock(x, y, z);
        if (SOLID[b] || FLUID[b]) return y;
      }
      return 0;
    }
  }

  MC.World = World;
  MC.Chunk = Chunk;
  MC.ST = ST;
  MC.ckey = ckey;
  MC.rle = { encode: rleEncode, decode: rleDecode };
})();
