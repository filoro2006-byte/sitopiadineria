// Giocatore: fisica, collisioni, raycast
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const B = MC.B;
  const { SOLID, FLUID } = MC.BL;
  const WH = MC.WH;

  // --- Collisioni con i blocchi ---
  const connGet = (world) => (x, y, z) => world.getBlock(x, y, z);
  function collectBoxes(world, x0, y0, z0, x1, y1, z1, out) {
    out.length = 0;
    const ix0 = Math.floor(x0), iy0 = Math.floor(y0) - 1, iz0 = Math.floor(z0);
    const ix1 = Math.floor(x1), iy1 = Math.floor(y1), iz1 = Math.floor(z1);
    for (let x = ix0; x <= ix1; x++) for (let z = iz0; z <= iz1; z++) {
      const ready = world.isReady(x + 0.5, z + 0.5);
      for (let y = iy0; y <= iy1; y++) {
        if (!ready) { out.push([x, y, z, x + 1, y + 1, z + 1]); continue; }
        if (y < 0 || y >= WH) continue;
        const id = world.getBlock(x, y, z);
        if (!SOLID[id]) continue;
        const d = MC.blocks[id];
        if (d.shape === 'model') {
          const bs = MC.getCollisionBoxes(id, world.getMeta(x, y, z), d.conn ? MC.connMask(connGet(world), x, y, z, id) : 0);
          for (const b of bs) out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]);
          continue;
        }
        const b = MC.getCollisionBox(id);
        if (!b) continue;
        out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]);
      }
    }
    return out;
  }

  const EPS = 1e-7;
  function clipY(boxes, bb, dy) {
    for (const b of boxes) {
      if (bb[3] <= b[0] + EPS || bb[0] >= b[3] - EPS || bb[5] <= b[2] + EPS || bb[2] >= b[5] - EPS) continue;
      if (dy > 0 && bb[4] <= b[1] + EPS) { const d = b[1] - bb[4]; if (d < dy) dy = d; }
      else if (dy < 0 && bb[1] >= b[4] - EPS) { const d = b[4] - bb[1]; if (d > dy) dy = d; }
    }
    return dy;
  }
  function clipX(boxes, bb, dx) {
    for (const b of boxes) {
      if (bb[4] <= b[1] + EPS || bb[1] >= b[4] - EPS || bb[5] <= b[2] + EPS || bb[2] >= b[5] - EPS) continue;
      if (dx > 0 && bb[3] <= b[0] + EPS) { const d = b[0] - bb[3]; if (d < dx) dx = d; }
      else if (dx < 0 && bb[0] >= b[3] - EPS) { const d = b[3] - bb[0]; if (d > dx) dx = d; }
    }
    return dx;
  }
  function clipZ(boxes, bb, dz) {
    for (const b of boxes) {
      if (bb[4] <= b[1] + EPS || bb[1] >= b[4] - EPS || bb[3] <= b[0] + EPS || bb[0] >= b[3] - EPS) continue;
      if (dz > 0 && bb[5] <= b[2] + EPS) { const d = b[2] - bb[5]; if (d < dz) dz = d; }
      else if (dz < 0 && bb[2] >= b[5] - EPS) { const d = b[5] - bb[2]; if (d > dz) dz = d; }
    }
    return dz;
  }

  // Sposta un AABB con collisioni; restituisce info
  const tmpBoxes = [];
  function moveBox(world, bb, dx, dy, dz, sneakGuard) {
    const boxes = collectBoxes(world, Math.min(bb[0], bb[0] + dx) - 0.01, Math.min(bb[1], bb[1] + dy) - 0.01, Math.min(bb[2], bb[2] + dz) - 0.01,
      Math.max(bb[3], bb[3] + dx) + 0.01, Math.max(bb[4], bb[4] + dy) + 0.01, Math.max(bb[5], bb[5] + dz) + 0.01, tmpBoxes);
    const ody = dy, odx = dx, odz = dz;
    // protezione dal bordo in modalità furtiva
    if (sneakGuard) {
      const hasGround = (ox, oz) => {
        const g = collectBoxes(world, bb[0] + ox + 0.001, bb[1] - 0.6, bb[2] + oz + 0.001, bb[3] + ox - 0.001, bb[1] - 0.001, bb[5] + oz - 0.001, []);
        const t = [bb[0] + ox, bb[1] - 0.6, bb[2] + oz, bb[3] + ox, bb[1], bb[5] + oz];
        return g.some((b) => !(t[3] <= b[0] || t[0] >= b[3] || t[5] <= b[2] || t[2] >= b[5] || t[4] <= b[1] || t[1] >= b[4]));
      };
      const step = 0.05;
      while (dx !== 0 && !hasGround(dx, 0)) { if (Math.abs(dx) < step) dx = 0; else dx -= Math.sign(dx) * step; }
      while (dz !== 0 && !hasGround(0, dz)) { if (Math.abs(dz) < step) dz = 0; else dz -= Math.sign(dz) * step; }
      while (dx !== 0 && dz !== 0 && !hasGround(dx, dz)) {
        if (Math.abs(dx) < step) dx = 0; else dx -= Math.sign(dx) * step;
        if (Math.abs(dz) < step) dz = 0; else dz -= Math.sign(dz) * step;
      }
    }
    dy = clipY(boxes, bb, dy);
    bb[1] += dy; bb[4] += dy;
    dx = clipX(boxes, bb, dx);
    bb[0] += dx; bb[3] += dx;
    dz = clipZ(boxes, bb, dz);
    bb[2] += dz; bb[5] += dz;
    return {
      dx, dy, dz,
      hitX: dx !== odx && !sneakGuard ? true : Math.abs(dx - odx) > 1e-9,
      hitY: dy !== ody,
      hitZ: Math.abs(dz - odz) > 1e-9,
      onGround: ody < 0 && dy !== ody,
    };
  }

  // --- Raycast sui blocchi ---
  function rayBox(ox, oy, oz, dx, dy, dz, b) {
    let tmin = -Infinity, tmax = Infinity, face = -1;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    for (let a = 0; a < 3; a++) {
      const lo = b[a], hi = b[a + 3];
      if (Math.abs(d[a]) < 1e-12) {
        if (o[a] < lo || o[a] > hi) return null;
        continue;
      }
      let t1 = (lo - o[a]) / d[a], t2 = (hi - o[a]) / d[a];
      let f1 = a * 2 + 1, f2 = a * 2; // faccia -a, +a
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; const f = f1; f1 = f2; f2 = f; }
      if (t1 > tmin) { tmin = t1; face = f1; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (tmax < 0) return null;
    return { t: Math.max(0, tmin), face };
  }
  // facce: 0 +X,1 -X,2 +Y,3 -Y,4 +Z,5 -Z (indice asse*2 + (0 per +, 1 per -))
  const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  function raycast(world, ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ox : ox - x) * tdx;
    let ty = dy === 0 ? Infinity : (dy > 0 ? y + 1 - oy : oy - y) * tdy;
    let tz = dz === 0 ? Infinity : (dz > 0 ? z + 1 - oz : oz - z) * tdz;
    for (let i = 0; i < 64; i++) {
      if (y >= 0 && y < WH) {
        const id = world.getBlock(x, y, z);
        if (id) {
          const d = MC.blocks[id];
          const sbs = MC.getSelectionBoxes(id, world.getMeta(x, y, z), d.conn ? MC.connMask(connGet(world), x, y, z, id) : 0);
          if (sbs) {
            let best = null, bbox = null;
            for (const sb of sbs) {
              const box = [x + sb[0], y + sb[1], z + sb[2], x + sb[3], y + sb[4], z + sb[5]];
              const h = rayBox(ox, oy, oz, dx, dy, dz, box);
              if (h && h.t <= maxDist && (!best || h.t < best.t)) { best = h; bbox = box; }
            }
            if (best) {
              // per l'evidenziazione usa l'unione delle scatole
              const u = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
              for (const sb of sbs) for (let i = 0; i < 3; i++) { u[i] = Math.min(u[i], sb[i]); u[i + 3] = Math.max(u[i + 3], sb[i + 3]); }
              const hx = ox + dx * best.t, hy = oy + dy * best.t, hz = oz + dz * best.t;
              return { x, y, z, id, face: best.face, n: FACE_N[best.face], t: best.t, box: [x + u[0], y + u[1], z + u[2], x + u[3], y + u[4], z + u[5]], hit: [hx - x, hy - y, hz - z], part: bbox };
            }
          }
        }
      }
      if (tx < ty && tx < tz) { if (tx > maxDist) break; x += sx; tx += tdx; }
      else if (ty < tz) { if (ty > maxDist) break; y += sy; ty += tdy; }
      else { if (tz > maxDist) break; z += sz; tz += tdz; }
    }
    return null;
  }

  // --- Giocatore ---
  class Player {
    constructor() {
      this.x = 0; this.y = 100; this.z = 0;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.yaw = 0; this.pitch = 0;
      this.onGround = false;
      this.flying = false;
      this.sneaking = false;
      this.sprinting = false;
      this.inWater = false; this.inLava = false; this.eyeInWater = false; this.eyeInLava = false;
      this.health = 20; this.air = 300;
      this.food = 20; this.sat = 5; this.exh = 0; this.foodTimer = 0; this.hungerFx = 0;
      this.mode = 'creative';
      this.fallDist = 0;
      this.bob = 0; this.bobAmt = 0;
      this.hurtTime = 0; this.regenTimer = 0; this.drownTimer = 0; this.lavaTimer = 0; this.cactusTimer = 0;
      this.dead = false;
      this.stepDist = 0;
      this.width = 0.6; this.height = 1.8;
      this.fovMod = 1;
      this.lastJump = 0;
      this.frozen = true;
      this.spawn = null;
      this.onLand = null; this.onStep = null; this.onHurt = null; this.onSplash = null;
      this.horizCollide = false;
    }

    get eyeHeight() { return this.eyeH === undefined ? 1.62 : this.eyeH; }
    get eye() { return [this.x, this.y + this.eyeHeight, this.z]; }
    dir() {
      const cp = Math.cos(this.pitch);
      return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
    }
    bbox() {
      const w = this.width / 2;
      return [this.x - w, this.y, this.z - w, this.x + w, this.y + this.height, this.z + w];
    }

    exhaust(v) { if (this.mode === 'survival') this.exh += v * (this.hungerFx > 0 ? 3 : 1); }
    eat(h, sat) { this.food = Math.min(20, this.food + h); this.sat = Math.min(this.food, this.sat + sat); }

    damage(amount, cause, kx, kz) {
      if (this.mode !== 'survival' || this.dead || amount <= 0) return;
      if (this.hurtTime > 0.45) return;
      if (this.reduceDamage) amount = this.reduceDamage(amount, cause);
      if (amount <= 0) { this.hurtTime = 0.5; return; }
      this.health = Math.max(0, this.health - amount);
      this.hurtTime = 0.5;
      if (kx !== undefined) { this.vx += kx * 6; this.vz += kz * 6; this.vy = Math.max(this.vy, 4.5); }
      if (this.onHurt) this.onHurt(amount, cause);
      if (this.health <= 0) this.dead = true;
    }

    _fluidAt(world, x, y, z) {
      const id = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      return FLUID[id];
    }

    update(dt, input, world) {
      if (this.frozen || this.dead) return;
      if (this.hurtTime > 0) this.hurtTime -= dt;
      // stato fluidi
      const wasInWater = this.inWater;
      const f1 = this._fluidAt(world, this.x, this.y + 0.1, this.z), f2 = this._fluidAt(world, this.x, this.y + 0.9, this.z);
      this.inWater = f1 === 1 || f2 === 1;
      this.inLava = f1 === 2 || f2 === 2;
      const fe = this._fluidAt(world, this.x, this.y + this.eyeHeight, this.z);
      this.eyeInWater = fe === 1;
      this.eyeInLava = fe === 2;
      const lb = world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.2), Math.floor(this.z)), lb2 = world.getBlock(Math.floor(this.x), Math.floor(this.y + 1.2), Math.floor(this.z));
      this.onLadder = !this.flying && ((MC.blocks[lb] && MC.blocks[lb].ladder) || (MC.blocks[lb2] && MC.blocks[lb2].ladder));
      if (this.inWater && !wasInWater && this.vy < -6 && this.onSplash) this.onSplash();

      const creative = this.mode === 'creative';
      const targetEye = this.sneaking && !this.flying ? 1.27 : 1.62;
      if (this.eyeH === undefined) this.eyeH = targetEye;
      this.eyeH += (targetEye - this.eyeH) * Math.min(1, dt * 14);
      if (!creative) this.flying = false;
      this.sneaking = !!input.sneak && !this.flying;

      // input movimento
      let fw = input.fw || 0;
      let st = input.st || 0;
      if (input.sprint && fw > 0 && !this.sneaking && (this.mode !== 'survival' || this.food > 6)) this.sprinting = true;
      if (fw <= 0 || this.sneaking || this.horizCollide) this.sprinting = false;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      let mx = -s * fw + c * st, mz = -c * fw - s * st;
      const ml = Math.hypot(mx, mz);
      if (ml > 1) { mx /= ml; mz /= ml; }

      let speed;
      if (this.flying) speed = this.sprinting ? 21.6 : 10.9;
      else if (this.inLava) speed = 1.5;
      else if (this.inWater) speed = this.sprinting ? 3.9 : 2.2;
      else if (this.sneaking) speed = 1.31;
      else if (this.sprinting) speed = 5.612;
      else speed = 4.317;
      const under = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.05), Math.floor(this.z));
      const ud = MC.blocks[under];
      if (this.onGround && !this.flying && ud && ud.slow) speed *= ud.slow;
      this.underHot = this.onGround && ud && ud.hot;

      const tvx = mx * speed, tvz = mz * speed;
      let k;
      if (this.flying) k = Math.min(1, dt * 7);
      else if (this.onGround) k = Math.min(1, dt * 16);
      else if (this.inWater || this.inLava) k = Math.min(1, dt * 6);
      else k = Math.min(1, dt * 2.6);
      // in aria si mantiene lo slancio se non c'è input
      if (!this.onGround && !this.flying && !this.inWater && ml < 0.01) k = Math.min(1, dt * 0.8);
      this.vx += (tvx - this.vx) * k;
      this.vz += (tvz - this.vz) * k;

      // verticale
      if (this.flying) {
        const tv = ((input.jump ? 1 : 0) - (input.sneak ? 1 : 0)) * (this.sprinting ? 12 : 8);
        this.vy += (tv - this.vy) * Math.min(1, dt * 10);
      } else if (this.inWater || this.inLava) {
        const g = this.inLava ? 5 : 9;
        this.vy -= g * dt;
        this.vy *= Math.max(0, 1 - dt * 3);
        if (input.jump) {
          this.vy += (this.inLava ? 14 : 22) * dt;
          if (this.horizCollide) this.vy = Math.max(this.vy, 4.2);
        }
        if (this.vy < -4.5) this.vy = -4.5;
        if (this.vy > 4.5) this.vy = 4.5;
        this.fallDist = 0;
      } else if (this.onLadder) {
        this.fallDist = 0;
        if (this.horizCollide || input.jump) this.vy = 2.4;
        else if (this.sneaking) this.vy = 0;
        else this.vy = Math.max(this.vy - 28 * dt, -2.4);
      } else {
        this.vy -= 28 * dt;
        if (this.vy < -60) this.vy = -60;
        if (input.jump && this.onGround && performance.now() - this.lastJump > 100) {
          this.vy = 8.4;
          this.lastJump = performance.now();
          this.exhaust(this.sprinting ? 0.2 : 0.05);
          if (this.sprinting) { this.vx += -s * 1.8; this.vz += -c * 1.8; }
        }
      }

      // movimento con collisioni
      const bb = this.bbox();
      const guard = this.sneaking && this.onGround && !this.flying;
      const r = moveBox(world, bb, this.vx * dt, this.vy * dt, this.vz * dt, guard);
      const px = this.x, pz = this.z;
      this.x = (bb[0] + bb[3]) / 2; this.y = bb[1]; this.z = (bb[2] + bb[5]) / 2;
      if (r.hitX && !guard) this.vx = 0;
      if (r.hitZ && !guard) this.vz = 0;
      if (guard) { if (r.hitX) this.vx = 0; if (r.hitZ) this.vz = 0; }
      this.horizCollide = r.hitX || r.hitZ;
      // salto automatico sui gradini di un blocco
      if (this.horizCollide && input.autoJump && this.onGround && !this.flying && !this.inWater && ml > 0.3 && !guard) {
        const ax = Math.floor(this.x + mx * 0.55 / (ml || 1)), az = Math.floor(this.z + mz * 0.55 / (ml || 1));
        const fy = Math.floor(this.y + 0.01);
        const sol = (y) => { const b = world.getBlock(ax, y, az); return SOLID[b] && MC.getCollisionBox(b); };
        if (sol(fy) && !sol(fy + 1) && !sol(fy + 2) && !SOLID[world.getBlock(Math.floor(this.x), fy + 2, Math.floor(this.z))]) {
          this.vy = 8.4; this.lastJump = performance.now();
        }
      }
      const wasGround = this.onGround;
      this.onGround = r.onGround;
      if (r.hitY) {
        if (this.vy < 0 && !wasGround) this._land(world);
        this.vy = 0;
      }
      if (this.onGround && this.flying) this.flying = false;
      if (!this.onGround && this.vy < 0 && !this.flying && !this.inWater) this.fallDist += -this.vy * dt;
      if (this.flying) this.fallDist = 0;

      // passi e oscillazione della visuale
      const hd = Math.hypot(this.x - px, this.z - pz);
      if (this.sprinting && this.onGround) this.exhaust(hd * 0.1);
      else if (this.inWater) this.exhaust(hd * 0.01);
      if (this.onGround && !this.flying) {
        this.stepDist += hd;
        this.bob += hd * 2.2;
        this.bobAmt += (Math.min(1, hd / dt / 4.3) - this.bobAmt) * Math.min(1, dt * 10);
        if (this.stepDist > 1.7) {
          this.stepDist = 0;
          if (this.onStep) this.onStep(world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z)));
        }
      } else {
        this.bobAmt += (0 - this.bobAmt) * Math.min(1, dt * 6);
      }
      const targetFov = (this.sprinting ? 1.12 : 1) * (this.flying && this.sprinting ? 1.05 : 1);
      this.fovMod += (targetFov - this.fovMod) * Math.min(1, dt * 8);

      this._survival(dt, world);
      if (this.y < -60) {
        if (this.mode === 'survival') this.damage(1000, 'void');
        else { this.y = 200; this.vy = 0; }
      }
    }

    _land(world) {
      const d = this.fallDist;
      this.fallDist = 0;
      if (this.onLand) this.onLand(d, world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z)));
      if (this.mode === 'survival' && d > 3.4 && !this.inWater) this.damage(Math.ceil(d - 3), 'fall');
    }

    _survival(dt, world) {
      if (this.mode !== 'survival') { this.health = 20; this.air = 300; this.food = 20; return; }
      // aria
      if (this.eyeInWater) {
        if (!this.respiration || Math.random() < 1 / (this.respiration + 1)) this.air -= dt * 20;
        if (this.air <= 0) {
          this.air = 0;
          this.drownTimer += dt;
          if (this.drownTimer >= 1) { this.drownTimer = 0; this.damage(2, 'drown'); }
        }
      } else {
        this.air = Math.min(300, this.air + dt * 60);
        this.drownTimer = 0;
      }
      // lava
      if (this.inLava) {
        this.lavaTimer += dt;
        if (this.lavaTimer >= 0.5) { this.lavaTimer = 0; this.damage(4, 'lava'); }
      }
      // cactus
      const bb = this.bbox();
      let touch = false;
      for (let x = Math.floor(bb[0] - 0.05); x <= Math.floor(bb[3] + 0.05) && !touch; x++)
        for (let z = Math.floor(bb[2] - 0.05); z <= Math.floor(bb[5] + 0.05) && !touch; z++)
          for (let y = Math.floor(bb[1] - 0.05); y <= Math.floor(bb[4]); y++) {
            if (world.getBlock(x, y, z) === B.cactus) {
              const cb = [x + 0.0625 - 0.05, y, z + 0.0625 - 0.05, x + 0.9375 + 0.05, y + 1, z + 0.9375 + 0.05];
              if (bb[3] > cb[0] && bb[0] < cb[3] && bb[5] > cb[2] && bb[2] < cb[5] && bb[4] > cb[1] && bb[1] < cb[4] + 0.01) { touch = true; break; }
            }
          }
      if (touch) {
        this.cactusTimer += dt;
        if (this.cactusTimer >= 0.5) { this.cactusTimer = 0; this.damage(1, 'cactus'); }
      }
      // magma
      if (this.underHot && !this.sneaking) {
        this.magmaTimer = (this.magmaTimer || 0) + dt;
        if (this.magmaTimer >= 0.5) { this.magmaTimer = 0; this.damage(1, 'magma'); }
      }
      // fuoco addosso
      if (this.fire > 0) {
        this.fire -= dt;
        if (this.inWater) this.fire = 0;
        this.fireTimer = (this.fireTimer || 0) + dt;
        if (this.fireTimer >= 1) { this.fireTimer = 0; this.damage(1, 'fire'); }
      }
      // fame
      if (this.hungerFx > 0) this.hungerFx -= dt;
      while (this.exh >= 4) {
        this.exh -= 4;
        if (this.sat > 0) this.sat = Math.max(0, this.sat - 1);
        else this.food = Math.max(0, this.food - 1);
      }
      this.foodTimer += dt;
      if (this.food >= 18 && this.health < 20) {
        if (this.foodTimer >= (this.food >= 20 && this.sat > 0 ? 0.5 : 4)) { this.foodTimer = 0; this.health = Math.min(20, this.health + 1); this.exh += 6; }
      } else if (this.food <= 0) {
        if (this.foodTimer >= 4) { this.foodTimer = 0; if (this.health > 1) this.damage(1, 'starve'); }
      } else this.foodTimer = Math.min(this.foodTimer, 4);
    }
  }

  MC.Player = Player;
  MC.raycast = raycast;
  MC.rayBox = rayBox;
  MC.moveBox = moveBox;
  MC.collectBoxes = collectBoxes;
  MC.FACE_N = FACE_N;
})();
