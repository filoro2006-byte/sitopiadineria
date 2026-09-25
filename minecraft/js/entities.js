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

  const tmpM = mat4.create(), tmpA = mat4.create(), tmpB = mat4.create();

  // Modelli delle creature (unità: blocchi). Fronte = -Z
  const MODELS = {
    pig: {
      w: 0.9, h: 0.9, hp: 10, speed: 1.1,
      parts: [
        { n: 'body', box: [-0.3125, 0.375, -0.5, 0.3125, 0.875, 0.5], tex: 'pig_skin' },
        { n: 'head', box: [-0.25, 0.5, -0.9, 0.25, 1.0, -0.4], tex: 'pig_skin', front: 'pig_face', head: true, pivot: [0, 0.75, -0.45] },
        { n: 'leg', box: [-0.3125, 0, -0.4375, -0.0625, 0.375, -0.1875], tex: 'pig_skin', leg: 0, pivot: [0, 0.375, 0] },
        { n: 'leg', box: [0.0625, 0, -0.4375, 0.3125, 0.375, -0.1875], tex: 'pig_skin', leg: 1, pivot: [0, 0.375, 0] },
        { n: 'leg', box: [-0.3125, 0, 0.1875, -0.0625, 0.375, 0.4375], tex: 'pig_skin', leg: 1, pivot: [0, 0.375, 0] },
        { n: 'leg', box: [0.0625, 0, 0.1875, 0.3125, 0.375, 0.4375], tex: 'pig_skin', leg: 0, pivot: [0, 0.375, 0] },
      ],
    },
    cow: {
      w: 0.9, h: 1.4, hp: 10, speed: 1.0,
      parts: [
        { n: 'body', box: [-0.375, 0.75, -0.5625, 0.375, 1.375, 0.5625], tex: 'cow_skin' },
        { n: 'head', box: [-0.25, 1.0, -0.9375, 0.25, 1.5, -0.5625], tex: 'cow_skin', front: 'cow_face', head: true, pivot: [0, 1.25, -0.56] },
        { n: 'horn', box: [-0.3125, 1.5, -0.8125, -0.1875, 1.625, -0.75], tex: 'white', head: true, pivot: [0, 1.25, -0.56] },
        { n: 'horn', box: [0.1875, 1.5, -0.8125, 0.3125, 1.625, -0.75], tex: 'white', head: true, pivot: [0, 1.25, -0.56] },
        { n: 'leg', box: [-0.375, 0, -0.5, -0.125, 0.75, -0.25], tex: 'cow_skin', leg: 0, pivot: [0, 0.75, 0] },
        { n: 'leg', box: [0.125, 0, -0.5, 0.375, 0.75, -0.25], tex: 'cow_skin', leg: 1, pivot: [0, 0.75, 0] },
        { n: 'leg', box: [-0.375, 0, 0.25, -0.125, 0.75, 0.5], tex: 'cow_skin', leg: 1, pivot: [0, 0.75, 0] },
        { n: 'leg', box: [0.125, 0, 0.25, 0.375, 0.75, 0.5], tex: 'cow_skin', leg: 0, pivot: [0, 0.75, 0] },
      ],
    },
    sheep: {
      w: 0.9, h: 1.3, hp: 8, speed: 1.0,
      parts: [
        { n: 'body', box: [-0.375, 0.7, -0.5, 0.375, 1.3, 0.5], tex: 'sheep_wool' },
        { n: 'head', box: [-0.1875, 0.95, -0.8125, 0.1875, 1.375, -0.4375], tex: 'sheep_skin', front: 'sheep_face', head: true, pivot: [0, 1.1, -0.45] },
        { n: 'leg', box: [-0.3125, 0, -0.4375, -0.0625, 0.75, -0.1875], tex: 'sheep_skin', leg: 0, pivot: [0, 0.75, 0] },
        { n: 'leg', box: [0.0625, 0, -0.4375, 0.3125, 0.75, -0.1875], tex: 'sheep_skin', leg: 1, pivot: [0, 0.75, 0] },
        { n: 'leg', box: [-0.3125, 0, 0.1875, -0.0625, 0.75, 0.4375], tex: 'sheep_skin', leg: 1, pivot: [0, 0.75, 0] },
        { n: 'leg', box: [0.0625, 0, 0.1875, 0.3125, 0.75, 0.4375], tex: 'sheep_skin', leg: 0, pivot: [0, 0.75, 0] },
      ],
    },
    chicken: {
      w: 0.4, h: 0.7, hp: 4, speed: 1.0,
      parts: [
        { n: 'body', box: [-0.1875, 0.3125, -0.25, 0.1875, 0.6875, 0.25], tex: 'chicken_skin' },
        { n: 'head', box: [-0.125, 0.5625, -0.4375, 0.125, 0.9375, -0.25], tex: 'chicken_skin', front: 'chicken_face', head: true, pivot: [0, 0.7, -0.25] },
        { n: 'wing', box: [-0.25, 0.375, -0.1875, -0.1875, 0.625, 0.1875], tex: 'chicken_skin', wing: -1, pivot: [-0.1875, 0.625, 0] },
        { n: 'wing', box: [0.1875, 0.375, -0.1875, 0.25, 0.625, 0.1875], tex: 'chicken_skin', wing: 1, pivot: [0.1875, 0.625, 0] },
        { n: 'leg', box: [-0.125, 0, -0.0625, -0.0625, 0.3125, 0], tex: 'chicken_leg', leg: 0, pivot: [0, 0.3125, 0] },
        { n: 'leg', box: [0.0625, 0, -0.0625, 0.125, 0.3125, 0], tex: 'chicken_leg', leg: 1, pivot: [0, 0.3125, 0] },
      ],
    },
    zombie: {
      w: 0.6, h: 1.95, hp: 20, speed: 2.1, hostile: true,
      parts: [
        { n: 'body', box: [-0.25, 0.75, -0.125, 0.25, 1.5, 0.125], tex: 'zombie_shirt' },
        { n: 'head', box: [-0.25, 1.5, -0.25, 0.25, 2.0, 0.25], tex: 'zombie_skin', front: 'zombie_face', head: true, pivot: [0, 1.5, 0] },
        { n: 'arm', box: [-0.5, 1.25, -0.75, -0.25, 1.5, 0.0], tex: 'zombie_skin', arm: 0, pivot: [-0.375, 1.375, 0] },
        { n: 'arm', box: [0.25, 1.25, -0.75, 0.5, 1.5, 0.0], tex: 'zombie_skin', arm: 1, pivot: [0.375, 1.375, 0] },
        { n: 'leg', box: [-0.25, 0, -0.125, 0, 0.75, 0.125], tex: 'zombie_pants', leg: 0, pivot: [0, 0.75, 0] },
        { n: 'leg', box: [0, 0, -0.125, 0.25, 0.75, 0.125], tex: 'zombie_pants', leg: 1, pivot: [0, 0.75, 0] },
      ],
    },
  };

  class Entities {
    constructor(game) {
      this.game = game;
      this.particles = [];
      this.items = [];
      this.tnts = [];
      this.mobs = [];
      this.spawnTimer = 0;
      this.rng = MC.util.mulberry32((Math.random() * 1e9) | 0);
    }

    clear() { this.particles.length = 0; this.items.length = 0; this.tnts.length = 0; this.mobs.length = 0; }

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

    // ---------------- Creature ----------------
    spawnMob(type, x, y, z) {
      const M = MODELS[type];
      const m = {
        type, M, x, y, z, vx: 0, vy: 0, vz: 0, yaw: this.rng() * Math.PI * 2, headYaw: 0, headPitch: 0,
        hp: M.hp, hurt: 0, dead: 0, onGround: false, walk: 0, walkAmt: 0, target: null, timer: 0,
        dirX: 0, dirZ: 0, panic: 0, attackCd: 0, burn: 0, soundTimer: 3 + this.rng() * 10, jumpCd: 0,
      };
      this.mobs.push(m);
      return m;
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

    hitMob(m, dmg, fromX, fromZ) {
      if (m.dead || m.hurt > 0.3) return false;
      m.hp -= dmg;
      m.hurt = 0.5;
      const dx = m.x - fromX, dz = m.z - fromZ, d = Math.hypot(dx, dz) || 1;
      m.vx += (dx / d) * 7; m.vz += (dz / d) * 7; m.vy = 5;
      m.panic = 4;
      this.game.audio.mob(m.type, true);
      if (m.hp <= 0) {
        m.dead = 0.001;
        if (m.type === 'sheep') this.dropItem(B.white_wool, 1, m.x, m.y + 0.5, m.z);
      }
      return true;
    }

    raycastMobs(ox, oy, oz, dx, dy, dz, maxDist) {
      let best = null;
      for (const m of this.mobs) {
        if (m.dead) continue;
        const w = m.M.w / 2;
        const h = MC.rayBox(ox, oy, oz, dx, dy, dz, [m.x - w, m.y, m.z - w, m.x + w, m.y + m.M.h, m.z + w]);
        if (h && h.t <= maxDist && (!best || h.t < best.t)) best = { mob: m, t: h.t };
      }
      return best;
    }

    _spawnLogic(dt, world, player, env) {
      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;
      this.spawnTimer = 1.0;
      if (!this.game.settings.mobs) return;
      let passive = 0, hostile = 0;
      for (const m of this.mobs) { if (m.M.hostile) hostile++; else passive++; }
      const tries = 4;
      for (let i = 0; i < tries; i++) {
        const a = this.rng() * Math.PI * 2, r = 24 + this.rng() * 40;
        const x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
        if (!world.isReady(x, z)) continue;
        const night = env.dayF < 0.3;
        const wantHostile = night ? this.rng() < 0.7 : this.rng() < 0.15;
        if (wantHostile) {
          if (hostile >= 8 || player.mode !== 'survival') continue;
          // cerca un punto buio: superficie di notte o grotta
          let y = world.topSolid(x, z);
          if (!night) {
            // grotte: prova profondità casuali
            y = 10 + Math.floor(this.rng() * 50);
            let ok = false;
            for (let k = 0; k < 10; k++, y++) {
              if (SOLID[world.getBlock(x, y, z)] && !world.getBlock(x, y + 1, z) && !world.getBlock(x, y + 2, z)) { ok = true; break; }
            }
            if (!ok) continue;
          }
          const b = world.getBlock(x, y, z);
          if (!OPAQUE[b] || world.getBlock(x, y + 1, z) || world.getBlock(x, y + 2, z)) continue;
          const sky = world.getSky(x, y + 1, z) * env.day, blk = world.getBlockLight(x, y + 1, z);
          if (sky > 6 || blk > 6) continue;
          this.spawnMob('zombie', x + 0.5, y + 1, z + 0.5);
          hostile++;
        } else {
          if (passive >= 14) continue;
          const y = world.topSolid(x, z);
          if (world.getBlock(x, y, z) !== B.grass || world.getBlock(x, y + 1, z) !== 0) continue;
          const types = ['pig', 'cow', 'sheep', 'chicken'];
          const t = types[Math.floor(this.rng() * types.length)];
          const n = 2 + Math.floor(this.rng() * 3);
          for (let k = 0; k < n; k++) {
            const ox = x + Math.floor(this.rng() * 5) - 2, oz = z + Math.floor(this.rng() * 5) - 2;
            const oy = world.topSolid(ox, oz);
            if (world.getBlock(ox, oy, oz) === B.grass && !world.getBlock(ox, oy + 1, oz)) this.spawnMob(t, ox + 0.5, oy + 1, oz + 0.5);
          }
          passive += n;
        }
      }
    }

    _mobAI(m, dt, world, player, env) {
      const M = m.M;
      m.timer -= dt;
      m.attackCd -= dt;
      m.jumpCd -= dt;
      let speed = M.speed;
      let tx = 0, tz = 0, moving = false;
      if (M.hostile) {
        const dx = player.x - m.x, dz = player.z - m.z, dist = Math.hypot(dx, dz);
        const canTarget = player.mode === 'survival' && !player.dead && dist < 28 && Math.abs(player.y - m.y) < 12;
        if (canTarget) {
          tx = dx / (dist || 1); tz = dz / (dist || 1); moving = dist > 0.8;
          m.headPitch = Math.atan2(player.y + 1.5 - (m.y + 1.6), dist) * -1;
          if (dist < 1.3 && Math.abs(player.y - m.y) < 1.6 && m.attackCd <= 0) {
            m.attackCd = 1;
            player.damage(3, 'zombie', tx, tz);
            m.swing = 0.3;
          }
        } else {
          if (m.timer <= 0) {
            m.timer = 3 + this.rng() * 5;
            if (this.rng() < 0.5) { const a = this.rng() * 6.28; m.dirX = Math.sin(a); m.dirZ = Math.cos(a); } else { m.dirX = 0; m.dirZ = 0; }
          }
          tx = m.dirX; tz = m.dirZ; moving = !!(tx || tz); speed *= 0.4;
        }
        // brucia al sole
        const sky = world.getSky(Math.floor(m.x), Math.floor(m.y + 1.7), Math.floor(m.z));
        if (sky >= 15 && env.dayF > 0.6 && !m.inWater) {
          m.burn += dt;
          if (this.rng() < 0.4) this.flame(m.x + (this.rng() - 0.5) * 0.5, m.y + this.rng() * 1.9, m.z + (this.rng() - 0.5) * 0.5);
          if (m.burn > 1) { m.burn = 0; m.hp -= 2; m.hurt = 0.3; if (m.hp <= 0) m.dead = 0.001; }
        }
      } else {
        if (m.panic > 0) {
          m.panic -= dt;
          speed *= 1.9;
          if (m.timer <= 0) { m.timer = 0.6 + this.rng(); const a = this.rng() * 6.28; m.dirX = Math.sin(a); m.dirZ = Math.cos(a); }
        } else if (m.timer <= 0) {
          m.timer = 2 + this.rng() * 6;
          if (this.rng() < 0.55) { const a = this.rng() * 6.28; m.dirX = Math.sin(a); m.dirZ = Math.cos(a); } else { m.dirX = 0; m.dirZ = 0; }
        }
        tx = m.dirX; tz = m.dirZ; moving = !!(tx || tz);
        // evita dirupi e acqua profonda
        if (moving) {
          const ax = Math.floor(m.x + tx * 0.8), az = Math.floor(m.z + tz * 0.8);
          let drop = 0;
          for (let k = 0; k < 4; k++) { if (SOLID[world.getBlock(ax, Math.floor(m.y) - 1 - k, az)]) break; drop++; }
          if (drop >= 3 || world.getBlock(ax, Math.floor(m.y) - 1, az) === B.lava || world.getBlock(ax, Math.floor(m.y), az) === B.lava) { m.dirX = -m.dirX; m.dirZ = -m.dirZ; tx = 0; tz = 0; moving = false; m.timer = 0.5; }
        }
        // guarda il giocatore se vicino
        const pd = Math.hypot(player.x - m.x, player.z - m.z);
        if (pd < 6 && !moving) {
          const want = Math.atan2(-(player.x - m.x), -(player.z - m.z));
          let dh = want - m.yaw; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
          m.headYaw += (MC.util.clamp(dh, -1.2, 1.2) - m.headYaw) * Math.min(1, dt * 5);
        } else m.headYaw *= 1 - Math.min(1, dt * 4);
      }
      if (moving) {
        const want = Math.atan2(-tx, -tz);
        let d = want - m.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        m.yaw += d * Math.min(1, dt * 6);
        const k = Math.min(1, dt * (m.onGround ? 10 : 2));
        m.vx += (tx * speed - m.vx) * k;
        m.vz += (tz * speed - m.vz) * k;
        if (m.hitH && m.onGround && m.jumpCd <= 0) { m.vy = 8.2; m.jumpCd = 0.4; }
        if (m.inWater && m.hitH) m.vy = 4;
      } else if (m.onGround) {
        m.vx *= Math.max(0, 1 - dt * 10); m.vz *= Math.max(0, 1 - dt * 10);
      }
      if (m.inLava) { m.hp -= dt * 4; m.hurt = 0.2; if (m.hp <= 0 && !m.dead) m.dead = 0.001; }
      // suoni
      m.soundTimer -= dt;
      if (m.soundTimer <= 0) {
        m.soundTimer = 6 + this.rng() * 14;
        const pd = Math.hypot(player.x - m.x, player.y - m.y, player.z - m.z);
        if (pd < 16) this.game.audio.mob(m.type, false, 1 - pd / 16);
      }
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

      // creature
      this._spawnLogic(dt, world, player, env);
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        const m = this.mobs[i];
        const pd = Math.hypot(player.x - m.x, player.z - m.z);
        if (pd > 110 || m.y < -40 || !world.isReady(m.x, m.z) && pd > 40) { this.mobs.splice(i, 1); continue; }
        if (m.dead) {
          m.dead += dt;
          if (m.dead > 0.8) { this.smoke(m.x, m.y + 0.5, m.z, 12, false); this.mobs.splice(i, 1); }
          this._physics(m, m.M.w, m.M.h, dt, world);
          continue;
        }
        if (m.hurt > 0) m.hurt -= dt;
        if (m.swing > 0) m.swing -= dt;
        this._mobAI(m, dt, world, player, env);
        this._physics(m, m.M.w, m.M.h, dt, world);
        const hs = Math.hypot(m.vx, m.vz);
        m.walkAmt += (Math.min(1, hs / 2) - m.walkAmt) * Math.min(1, dt * 8);
        m.walk += hs * dt * 2.2;
        if (m.hp <= 0 && !m.dead) m.dead = 0.001;
      }
      // spinta tra giocatore e creature
      for (const m of this.mobs) {
        const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz);
        const min = (m.M.w + 0.6) / 2;
        if (d < min && d > 0.001 && Math.abs(m.y - player.y) < 1.5) {
          const push = (min - d) * 4;
          m.vx += (dx / d) * push; m.vz += (dz / d) * push;
        }
      }
    }

    // ---------------- Disegno ----------------
    render(renderer, env, cam, world, time) {
      const bt = renderer.batch;
      const T = MC.textures.index;
      // creature
      for (const m of this.mobs) {
        const l = lightAt(world, m.x, m.y + 0.5, m.z, env);
        const red = m.hurt > 0 || m.dead ? [1, 0.45, 0.45, 1] : [1, 1, 1, 1];
        const base = mat4.translate(mat4.create(), m.x - cam.x, m.y - cam.y, m.z - cam.z);
        mat4.rotY(tmpA, m.yaw);
        mat4.mul(base, base, tmpA);
        if (m.dead) { mat4.rotZ(tmpA, Math.min(1, m.dead * 3) * Math.PI / 2); mat4.mul(base, base, tmpA); }
        const sw = Math.sin(m.walk * 2.5) * 0.7 * m.walkAmt;
        for (const p of m.M.parts) {
          let M = base;
          if (p.pivot && (p.head || p.leg !== undefined || p.arm !== undefined || p.wing)) {
            let ang = 0, axis = 'x', yawA = 0;
            if (p.leg !== undefined) ang = p.leg ? sw : -sw;
            if (p.head) { yawA = m.headYaw; ang = m.headPitch || 0; }
            if (p.arm !== undefined) ang = (p.arm ? sw : -sw) * 0.3 + (m.swing > 0 ? -Math.sin(m.swing * 10) * 0.6 : 0);
            if (p.wing) { axis = 'z'; ang = p.wing * (m.onGround ? 0 : Math.abs(Math.sin(time * 20)) * 0.8); }
            M = mat4.create();
            mat4.translate(tmpA, p.pivot[0], p.pivot[1], p.pivot[2]);
            mat4.mul(M, base, tmpA);
            if (yawA) { mat4.rotY(tmpB, yawA); mat4.mul(M, M, tmpB); }
            if (axis === 'x') mat4.rotX(tmpB, ang); else mat4.rotZ(tmpB, ang);
            mat4.mul(M, M, tmpB);
            mat4.translate(tmpA, -p.pivot[0], -p.pivot[1], -p.pivot[2]);
            mat4.mul(M, M, tmpA);
          }
          const L = T[p.tex];
          const layers = [L, L, L, L, L, p.front ? T[p.front] : L];
          const b = p.box;
          bt.box(M, b[0], b[1], b[2], b[3], b[4], b[5], layers, l, red);
        }
      }
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

  // Disegna un oggetto (blocco in miniatura o sprite) con matrice M
  function drawItemModel(bt, M, id, size, light, color) {
    const d = MC.blocks[id];
    if (!d || !d.tex) return;
    const T = MC.textures.index;
    const h = size / 2;
    let col = color || [1, 1, 1, 1];
    const tintC = d.tint === 1 || d.tint === 2 || d.tint === 3 ? [0.55, 0.78, 0.38] : d.tint === 4 ? d.tintColor.map((v) => v / 255) : null;
    if (d.shape === 'cross' || d.shape === 'torch') {
      const L = T[d.tex.side];
      const c = tintC && d.tint !== 2 ? [tintC[0] * col[0], tintC[1] * col[1], tintC[2] * col[2], col[3]] : col;
      const p = (x, y, z) => mat4.transformPoint(M, x, y, z);
      const a = p(-h, -h + h, 0), b = p(h, -h + h, 0), cc = p(h, h + h, 0), dd = p(-h, h + h, 0);
      const l = d.emissive ? 1 : light;
      bt.quad([a[0], a[1], a[2], b[0], b[1], b[2], cc[0], cc[1], cc[2], dd[0], dd[1], dd[2]], 0, 0, 1, 1, L, c[0] * l, c[1] * l, c[2] * l, c[3]);
      return;
    }
    const top = T[d.tex.top], side = T[d.tex.side], bot = T[d.tex.bottom];
    const front = d.tex.front ? T[d.tex.front] : side;
    const layers = [side, side, top, bot, side, front];
    const l = d.emissive ? 1.1 : light;
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
  MC.MOB_MODELS = MODELS;
})();
