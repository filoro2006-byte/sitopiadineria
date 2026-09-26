// Entità: particelle, oggetti, TNT, creature
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const B = MC.B;
  const { SOLID, FLUID, OPAQUE } = MC.BL;
  const mat4 = MC.mat4;

  function lcurve(l, g) {
    const f = Math.min(1, Math.max(0, l / 15));
    const b = f / (3 - 2 * f);
    const bb = 1 - Math.pow(1 - b, 4);
    return b + (bb - b) * g;
  }
  function lightAt(world, x, y, z, env) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const sky = world.getSky(ix, iy, iz), blk = world.getBlockLight(ix, iy, iz);
    const g = env.gamma !== undefined ? env.gamma : 0.45;
    const ls = lcurve(sky, g) * env.day;
    const lb = lcurve(blk, g);
    return Math.max(0.06, ls, lb);
  }
  MC.lcurve = lcurve;
  MC.lightAt = lightAt;

  

  const tmpA = mat4.create();

  class Entities {
    constructor(game) {
      this.game = game;
      this.particles = [];
      this.items = [];
      this.tnts = [];
      this.mobs = [];
      this.arrows = [];
      this.spawnTimer = 0;
      this.rng = MC.util.mulberry32((Math.random() * 1e9) | 0);
    }

    clear() { this.particles.length = 0; this.items.length = 0; this.tnts.length = 0; this.mobs.length = 0; this.arrows.length = 0; }

    // ---------------- Particelle ----------------
    breakParticles(id, x, y, z, count) {
      const d = MC.blocks[id];
      if (!d || !d.tex) return;
      const layer = d.tint === 2 ? MC.textures.index.grass_side_item : MC.textures.index[d.tex.side];
      let tint = [1, 1, 1];
      if (d.tint === 1 || d.tint === 3) tint = [0.5, 0.75, 0.35];
      if (d.tint === 4 && d.tintColor) tint = d.tintColor.map((v) => v / 255);
      count = count || 28;
      for (let i = 0; i < count; i++) {
        const px = x + 0.1 + this.rng() * 0.8, py = y + 0.1 + this.rng() * 0.8, pz = z + 0.1 + this.rng() * 0.8;
        this.addParticle(px, py, pz, (px - x - 0.5) * 3, 1.5 + this.rng() * 2.5, (pz - z - 0.5) * 3, layer, tint, 0.6 + this.rng() * 0.6, 0.06 + this.rng() * 0.05, 18);
      }
    }
    breakParticlesItem(id, p, n) {
      const d = MC.blocks[id];
      if (!d || !d.tex) return;
      const e = p.eye, dir = p.dir();
      const layer = MC.textures.index[d.tex.side];
      for (let i = 0; i < n; i++) this.addParticle(e[0] + dir[0] * 0.4, e[1] - 0.25, e[2] + dir[2] * 0.4, (this.rng() - 0.5) * 1.5 + dir[0], 1 + this.rng(), (this.rng() - 0.5) * 1.5 + dir[2], layer, [1, 1, 1], 0.5, 0.05, 18);
    }
    hitParticles(id, x, y, z, n) {
      const d = MC.blocks[id];
      if (!d || !d.tex) return;
      const layer = d.tint === 2 ? MC.textures.index.grass_side_item : MC.textures.index[d.tex.side];
      const tint = d.tint && d.tint !== 2 ? (d.tint === 4 ? d.tintColor.map((v) => v / 255) : [0.5, 0.75, 0.35]) : [1, 1, 1];
      const px = x + n[0] * 0.51 + 0.5 + (n[0] ? 0 : (this.rng() - 0.5) * 0.9);
      const py = y + n[1] * 0.51 + 0.5 + (n[1] ? 0 : (this.rng() - 0.5) * 0.9);
      const pz = z + n[2] * 0.51 + 0.5 + (n[2] ? 0 : (this.rng() - 0.5) * 0.9);
      this.addParticle(px, py, pz, n[0] * 1.5 + (this.rng() - 0.5), 1 + this.rng(), n[2] * 1.5 + (this.rng() - 0.5), layer, tint, 0.4 + this.rng() * 0.3, 0.05, 18);
    }
    addParticle(x, y, z, vx, vy, vz, layer, tint, life, size, grav, color) {
      if (this.particles.length > 2500) this.particles.shift();
      const u = Math.floor(this.rng() * 12) / 16, v = Math.floor(this.rng() * 12) / 16;
      this.particles.push({ x, y, z, vx, vy, vz, layer, tint, life, max: life, size, grav: grav === undefined ? 18 : grav, u, v, color });
    }
    smoke(x, y, z, n, big) {
      const layer = MC.textures.index.white;
      for (let i = 0; i < n; i++) {
        const g = 0.3 + this.rng() * 0.4;
        this.addParticle(x + (this.rng() - 0.5) * (big ? 3 : 0.6), y + this.rng() * (big ? 2 : 0.6), z + (this.rng() - 0.5) * (big ? 3 : 0.6),
          (this.rng() - 0.5) * (big ? 6 : 1), 0.5 + this.rng() * (big ? 3 : 1), (this.rng() - 0.5) * (big ? 6 : 1), layer, [g, g, g], 0.8 + this.rng() * 1.2, big ? 0.25 + this.rng() * 0.3 : 0.08, -1.5, true);
      }
    }
    flame(x, y, z) {
      const layer = MC.textures.index.white;
      this.addParticle(x, y, z, (this.rng() - 0.5) * 0.2, 0.3 + this.rng() * 0.3, (this.rng() - 0.5) * 0.2, layer, [1, 0.6 + this.rng() * 0.3, 0.1], 0.35 + this.rng() * 0.3, 0.05, -0.5, true);
    }
    splash(x, y, z) {
      const layer = MC.textures.index.white;
      for (let i = 0; i < 30; i++) {
        this.addParticle(x + (this.rng() - 0.5), y, z + (this.rng() - 0.5), (this.rng() - 0.5) * 3, 3 + this.rng() * 3, (this.rng() - 0.5) * 3, layer, [0.5, 0.7, 1], 0.6, 0.05, 18, true);
      }
    }

    // ---------------- Oggetti a terra ----------------
    dropItem(id, count, x, y, z, vx, vy, vz, delay) {
      if (!id) return;
      this.items.push({
        id, count, x, y, z,
        vx: vx !== undefined ? vx : (this.rng() - 0.5) * 2.5,
        vy: vy !== undefined ? vy : 3 + this.rng() * 1.5,
        vz: vz !== undefined ? vz : (this.rng() - 0.5) * 2.5,
        age: 0, delay: delay !== undefined ? delay : 0.4, rot: this.rng() * 6.28, onGround: false,
      });
      if (this.items.length > 400) this.items.shift();
    }

    // ---------------- TNT ----------------
    primeTNT(x, y, z, fuse) {
      this.tnts.push({ x: x + 0.5, y, z: z + 0.5, vx: (this.rng() - 0.5) * 1.5, vy: 3, vz: (this.rng() - 0.5) * 1.5, fuse: fuse || 4 });
    }

    _physics(e, w, h, dt, world) {
      if (!world.isReady(e.x, e.z)) return;
      const inW = FLUID[world.getBlock(Math.floor(e.x), Math.floor(e.y + 0.2), Math.floor(e.z))];
      if (inW) {
        e.vy += (inW === 1 ? 6 : 2) * dt; // galleggiamento
        e.vy *= Math.max(0, 1 - dt * 3);
        if (e.vy > 2.5) e.vy = 2.5;
      } else {
        e.vy -= 28 * dt;
        if (e.vy < -50) e.vy = -50;
      }
      const bb = [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2];
      const r = MC.moveBox(world, bb, e.vx * dt, e.vy * dt, e.vz * dt, false);
      e.x = (bb[0] + bb[3]) / 2; e.y = bb[1]; e.z = (bb[2] + bb[5]) / 2;
      if (r.hitY) { e.vy = 0; }
      e.hitH = r.hitX || r.hitZ;
      if (r.hitX) e.vx = 0;
      if (r.hitZ) e.vz = 0;
      e.onGround = r.onGround;
      e.inWater = !!inW;
      e.inLava = inW === 2;
    }

    update(dt, world, player, env) {
      // particelle
      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
        p.vy -= p.grav * dt;
        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
        if (p.grav > 0 && SOLID[world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) {
          if (SOLID[world.getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z))]) { p.vy = 0; } else { p.y = ny; }
          p.vx *= 0.5; p.vz *= 0.5;
        } else { p.x = nx; p.y = ny; p.z = nz; }
        if (!p.color) { p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5; }
      }

      // oggetti
      const its = this.items;
      for (let i = its.length - 1; i >= 0; i--) {
        const it = its[i];
        it.age += dt; it.delay -= dt;
        if (it.age > 300 || it.y < -64) { its.splice(i, 1); continue; }
        const dx = player.x - it.x, dy = player.y + 0.8 - it.y, dz = player.z - it.z;
        const dist = Math.hypot(dx, dy, dz);
        if (it.delay <= 0 && !player.dead && dist < 1.8) {
          // attrazione
          if (dist < 0.9) {
            const left = this.game.inventory.add(it.id, it.count);
            if (left < it.count) this.game.audio.pop();
            if (left === 0) { its.splice(i, 1); continue; }
            it.count = left;
          } else {
            it.vx += (dx / dist) * 30 * dt; it.vy += (dy / dist) * 30 * dt; it.vz += (dz / dist) * 30 * dt;
          }
        }
        this._physics(it, 0.25, 0.25, dt, world);
        if (it.onGround) { it.vx *= Math.max(0, 1 - dt * 8); it.vz *= Math.max(0, 1 - dt * 8); }
        it.rot += dt * 1.5;
        // unione di oggetti uguali
        if ((i & 7) === ((this.game.frame | 0) & 7)) {
          for (let j = 0; j < its.length; j++) {
            const o = its[j];
            if (o === it || o.id !== it.id || o.count + it.count > 64) continue;
            if (Math.abs(o.x - it.x) < 0.8 && Math.abs(o.y - it.y) < 0.6 && Math.abs(o.z - it.z) < 0.8) {
              o.count += it.count; its.splice(i, 1); break;
            }
          }
        }
      }

      // TNT
      for (let i = this.tnts.length - 1; i >= 0; i--) {
        const t = this.tnts[i];
        t.fuse -= dt;
        this._physics(t, 0.98, 0.98, dt, world);
        if (t.onGround) { t.vx *= 0.8; t.vz *= 0.8; }
        if (this.rng() < 0.5) this.smoke(t.x, t.y + 1.1, t.z, 1, false);
        if (t.fuse <= 0) {
          this.tnts.splice(i, 1);
          this.game.explode(t.x, t.y + 0.5, t.z, 4);
        }
      }

      this.updateMobs(dt, world, player, env);
      this.updateArrows(dt, world, player);
    }

    // ---------------- Disegno ----------------
    render(renderer, env, cam, world, time) {
      const bt = renderer.batch;
      const T = MC.textures.index;
      this.renderMobs(bt, env, cam, world, time);
      this.renderArrows(bt, env, cam, world);
      // oggetti a terra
      for (const it of this.items) {
        const l = lightAt(world, it.x, it.y + 0.2, it.z, env);
        const bob = Math.sin(it.age * 2.5) * 0.06 + 0.12;
        const n = it.count > 16 ? 3 : it.count > 1 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const M = mat4.translate(mat4.create(), it.x - cam.x + k * 0.07, it.y - cam.y + bob + k * 0.05, it.z - cam.z + k * 0.05);
          mat4.rotY(tmpA, it.rot);
          mat4.mul(M, M, tmpA);
          drawItemModel(bt, M, it.id, 0.25, l);
        }
      }
      // TNT innescata
      for (const t of this.tnts) {
        const l = lightAt(world, t.x, t.y + 0.5, t.z, env);
        const flash = Math.floor(t.fuse * 5) % 2 === 0;
        const s = t.fuse < 0.4 ? 1 + (0.4 - t.fuse) * 0.4 : 1;
        const M = mat4.translate(mat4.create(), t.x - cam.x, t.y - cam.y + 0.5, t.z - cam.z);
        const S = mat4.scale(mat4.create(), s, s, s);
        mat4.mul(M, M, S);
        const d = MC.blocks[B.tnt];
        const layers = [T[d.tex.side], T[d.tex.side], T[d.tex.top], T[d.tex.bottom], T[d.tex.side], T[d.tex.side]];
        bt.box(M, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, layers, flash ? 1.6 : l, flash ? [1.4, 1.4, 1.4, 1] : null);
      }
      renderer.beginEnt(env);
      renderer.gl.disable(renderer.gl.CULL_FACE);
      bt.flush();
      renderer.gl.enable(renderer.gl.CULL_FACE);

      // particelle (billboard)
      if (this.particles.length) {
        const yaw = cam.yaw, pitch = cam.pitch;
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        const ux = Math.sin(yaw) * Math.sin(pitch), uy = Math.cos(pitch), uz = Math.cos(yaw) * Math.sin(pitch);
        for (const p of this.particles) {
          const s = p.size * (p.color ? 0.6 + (1 - p.life / p.max) * 1.2 : 1);
          const x = p.x - cam.x, y = p.y - cam.y, z = p.z - cam.z;
          const l = p.color && p.grav < 0 && p.tint[0] > 0.9 ? 1.2 : lightAt(world, p.x, p.y, p.z, env);
          const a = p.color ? Math.min(1, p.life / p.max * 2) : 1;
          const pts = [
            x - rx * s - ux * s, y - uy * s, z - rz * s - uz * s,
            x + rx * s - ux * s, y - uy * s, z + rz * s - uz * s,
            x + rx * s + ux * s, y + uy * s, z + rz * s + uz * s,
            x - rx * s + ux * s, y + uy * s, z - rz * s + uz * s,
          ];
          bt.quad(pts, p.u, p.v, p.u + 0.25, p.v + 0.25, p.layer, p.tint[0] * l, p.tint[1] * l, p.tint[2] * l, a);
        }
        const gl = renderer.gl;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);
        bt.flush();
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
      }
    }
  }

  // Sprite estruso (oggetto piatto con spessore, come nell'originale)
  const extrudeCache = {};
  function extruded(layerName) {
    if (extrudeCache[layerName]) return extrudeCache[layerName];
    const d = MC.textures.cache[layerName];
    const S = 16, th = 1 / 32;
    const q = [];
    const op = (x, y) => x >= 0 && y >= 0 && x < S && y < S && d[(y * S + x) * 4 + 3] > 100;
    // fronte e retro (un quad ciascuno sull'intera texture)
    q.push({ p: [-0.5, 0, th, 0.5, 0, th, 0.5, 1, th, -0.5, 1, th], uv: [0, 0, 1, 1], s: 1 });
    q.push({ p: [0.5, 0, -th, -0.5, 0, -th, -0.5, 1, -th, 0.5, 1, -th], uv: [1, 0, 0, 1], s: 0.8 });
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!op(x, y)) continue;
      const X0 = x / S - 0.5, X1 = (x + 1) / S - 0.5, Y1 = 1 - y / S, Y0 = 1 - (y + 1) / S;
      const uv = [x / S + 0.01 / S, y / S + 0.01 / S, (x + 0.99) / S, (y + 0.99) / S];
      if (!op(x - 1, y)) q.push({ p: [X0, Y0, -th, X0, Y0, th, X0, Y1, th, X0, Y1, -th], uv, s: 0.7 });
      if (!op(x + 1, y)) q.push({ p: [X1, Y0, th, X1, Y0, -th, X1, Y1, -th, X1, Y1, th], uv, s: 0.7 });
      if (!op(x, y - 1)) q.push({ p: [X0, Y1, th, X1, Y1, th, X1, Y1, -th, X0, Y1, -th], uv, s: 0.95 });
      if (!op(x, y + 1)) q.push({ p: [X0, Y0, -th, X1, Y0, -th, X1, Y0, th, X0, Y0, th], uv, s: 0.55 });
    }
    extrudeCache[layerName] = q;
    return q;
  }
  function drawExtruded(bt, M, layerName, size, light, col) {
    const L = MC.textures.index[layerName];
    const qs = extruded(layerName);
    const pts = new Array(12);
    for (const q of qs) {
      for (let k = 0; k < 4; k++) {
        const r = mat4.transformPoint(M, q.p[k * 3] * size, q.p[k * 3 + 1] * size, q.p[k * 3 + 2] * size);
        pts[k * 3] = r[0]; pts[k * 3 + 1] = r[1]; pts[k * 3 + 2] = r[2];
      }
      const l = light * q.s;
      bt.quad(pts, q.uv[0], q.uv[1], q.uv[2], q.uv[3], L, col[0] * l, col[1] * l, col[2] * l, col[3]);
    }
  }
  MC.drawExtruded = drawExtruded;

  function boxUVs(b) {
    // UV per faccia derivate dalla posizione (come nel mesher)
    const [x0, y0, z0, x1, y1, z1] = b;
    return [
      [1 - z1, 1 - y1, 1 - z0, 1 - y0], [z0, 1 - y1, z1, 1 - y0],
      [x0, z0, x1, z1], [x0, 1 - z1, x1, 1 - z0],
      [x0, 1 - y1, x1, 1 - y0], [1 - x1, 1 - y1, 1 - x0, 1 - y0],
    ];
  }

  // Disegna un oggetto (blocco in miniatura o sprite) con matrice M
  function drawItemModel(bt, M, id, size, light, color) {
    const d = MC.blocks[id];
    if (!d || !d.tex) return;
    const T = MC.textures.index;
    const h = size / 2;
    let col = color || [1, 1, 1, 1];
    const tintC = d.tint === 1 || d.tint === 2 || d.tint === 3 ? [0.55, 0.78, 0.38] : d.tint === 4 ? d.tintColor.map((v) => v / 255) : null;
    if (d.shape === 'cross' || d.shape === 'torch' || d.shape === 'item' || d.shape === 'crop' || d.ladder || d.door || d.conn === 'pane') {
      const c = tintC && d.tint !== 2 ? [tintC[0] * col[0], tintC[1] * col[1], tintC[2] * col[2], col[3]] : col;
      const l = d.emissive ? 1 : light;
      drawExtruded(bt, M, d.door ? 'door_bottom' : d.tex.side, size * 1.25, l, c);
      return;
    }
    const top = T[d.tex.top], side = T[d.tex.side], bot = T[d.tex.bottom];
    const front = d.tex.front ? T[d.tex.front] : side;
    const layers = [side, side, top, bot, side, front];
    const l = d.emissive ? 1.1 : light;
    if (d.shape === 'model') {
      const bed = !!d.bed;
      const s2 = bed ? size * 0.6 : size;
      const S2 = mat4.create();
      mat4.translate(S2, -s2 / 2, 0, bed ? -s2 : -s2 / 2);
      const sc = mat4.scale(mat4.create(), s2, s2, s2);
      const MM = mat4.mul(mat4.create(), M, mat4.mul(mat4.create(), S2, sc));
      let bs = d.model(d.facing ? 4 : 0, d.conn ? 3 : 0);
      if (bed) bs = d.model(2, 0).concat(d.model(6, 0).map((b) => { const c2 = b.slice(); c2[2] += 1; c2[5] += 1; return c2; }));
      for (const b of bs) {
        const ov = b[6] && b[6].f;
        const ls = ov ? ov.map((n, i) => (n ? T[n] : layers[i])) : layers;
        const bb = b.slice(0, 6);
        const uvb = [bb[0], bb[1], bb[2] - Math.floor(bb[2] === 1 ? 0 : bb[2]), bb[3], bb[4], bb[5] - Math.floor(bb[2] >= 1 ? 1 : 0)];
        bt.box(MM, bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], ls, l, col, boxUVs(uvb));
      }
      return;
    }
    if (tintC && d.tint !== 2) {
      bt.box(M, -h, 0, -h, h, size, h, layers, l, [tintC[0] * col[0], tintC[1] * col[1], tintC[2] * col[2], col[3]]);
    } else if (d.tint === 2) {
      const gs = T.grass_side_item, gt = T.grass_top_item;
      bt.box(M, -h, 0, -h, h, size, h, [gs, gs, gt, bot, gs, gs], l, col);
    } else {
      bt.box(M, -h, 0, -h, h, size, h, layers, l, col);
    }
  }

  MC.Entities = Entities;
  MC.drawItemModel = drawItemModel;
})();
