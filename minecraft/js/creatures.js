// Creature: comparsa, intelligenza, combattimento, frecce e disegno
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const B = MC.B;
  const { SOLID, OPAQUE, FLUID } = MC.BL;
  const mat4 = MC.mat4;
  const E = MC.Entities.prototype;
  const tA = mat4.create(), tB = mat4.create();

  const SHEEP_COLORS = [
    [[233, 236, 236], 'white_wool', 0.82], [[150, 150, 145], 'light_gray_wool', 0.05], [[80, 85, 88], 'gray_wool', 0.05],
    [[35, 35, 38], 'black_wool', 0.05], [[120, 80, 50], 'brown_wool', 0.03], [[240, 160, 180], 'pink_wool', 0.002],
  ];

  // Scambi dei villici per mestiere: [[ingredienti], [risultato, quantità]]
  const TRADES = {
    farmer: [[[['wheat_item', 20]], ['emerald', 1]], [[['emerald', 1]], ['bread', 6]], [[['emerald', 1]], ['apple', 4]], [[['carrot', 22]], ['emerald', 1]], [[['emerald', 1]], ['pumpkin', 2]], [[['emerald', 3]], ['golden_apple', 1]]],
    librarian: [[[['emerald', 1]], ['bookshelf', 1]], [[['string', 24]], ['emerald', 1]], [[['emerald', 1]], ['glass', 16]], [[['emerald', 2]], ['lantern', 2]], [[['emerald', 1]], ['torch', 16]]],
    cleric: [[[['rotten_flesh', 32]], ['emerald', 1]], [[['emerald', 1]], ['redstone', 4]], [[['emerald', 1]], ['lapis', 2]], [[['emerald', 4]], ['glowstone', 3]], [[['bone', 16]], ['emerald', 1]]],
    smith: [[[['coal', 15]], ['emerald', 1]], [[['iron_ingot', 4]], ['emerald', 1]], [[['emerald', 3]], ['iron_pickaxe', 1]], [[['emerald', 4]], ['iron_sword', 1]], [[['emerald', 12]], ['diamond_pickaxe', 1]], [[['emerald', 1]], ['flint_and_steel', 1]]],
    butcher: [[[['chicken', 14]], ['emerald', 1]], [[['porkchop', 7]], ['emerald', 1]], [[['emerald', 1]], ['cooked_porkchop', 5]], [[['emerald', 1]], ['steak', 5]], [[['emerald', 1]], ['cooked_chicken', 8]]],
  };
  MC.TRADES = TRADES;

  function shortAngle(d) { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

  // ---------------- Creazione ----------------
  E.spawnMob = function (type, x, y, z, opts) {
    const D = MC.mobs.DEFS[type];
    if (!D) return null;
    opts = opts || {};
    let variant = 'default';
    let prof = null;
    if (type === 'villager') {
      const ps = Object.keys(MC.mobs.PROFESSIONS);
      prof = opts.prof || ps[Math.floor(this.rng() * ps.length)];
      variant = prof;
    }
    const m = {
      type, D, M: D, skin: 1000 + MC.mobs.skinIndex[type + ':' + variant], parts: MC.mobs.models[type],
      x, y, z, vx: 0, vy: 0, vz: 0, yaw: this.rng() * Math.PI * 2, bodyYaw: 0, headYaw: 0, headPitch: 0,
      hp: D.hp, hurt: 0, dead: 0, onGround: false, walk: 0, walkAmt: 0, timer: 0, dirX: 0, dirZ: 0, panic: 0,
      attackCd: 0, burn: 0, soundTimer: 3 + this.rng() * 10, jumpCd: 0, swing: 0, fuse: 0, shootCd: 1 + this.rng() * 2,
      angry: 0, prof, home: opts.home || null, persistent: !!opts.persistent, strafe: this.rng() < 0.5 ? 1 : -1,
    };
    m.bodyYaw = m.yaw;
    if (type === 'sheep') {
      let r = this.rng(), acc = 0;
      m.color = SHEEP_COLORS[0];
      for (const c of SHEEP_COLORS) { acc += c[2]; if (r < acc) { m.color = c; break; } }
    }
    if (type === 'villager') {
      const list = TRADES[prof].slice();
      m.trades = list.map((t) => ({ ins: t[0].map(([k, n]) => [B[k], n]), out: [B[t[1][0]], t[1][1]] })).filter((t) => t.out[0] && t.ins.every((i) => i[0]));
      m.name = MC.mobs.PROFESSIONS[prof].name;
    }
    this.mobs.push(m);
    return m;
  };

  // ---------------- Combattimento ----------------
  E.hitMob = function (m, dmg, fromX, fromZ, kb) {
    if (m.dead || m.hurt > 0.3) return false;
    m.hp -= dmg;
    m.hurt = 0.5;
    const dx = m.x - fromX, dz = m.z - fromZ, d = Math.hypot(dx, dz) || 1;
    const k = (kb || 1) * (m.D.golem ? 0.2 : 1);
    m.vx += (dx / d) * 7 * k; m.vz += (dz / d) * 7 * k; m.vy = Math.max(m.vy, 5 * k);
    m.panic = 5;
    m.angry = 30;
    this.game.audio.mob(m.type, true);
    if (m.hp <= 0) this.killMob(m);
    return true;
  };

  E.killMob = function (m) {
    if (m.dead) return;
    m.dead = 0.001;
    if (this.game.player.mode !== 'survival') return;
    const r = (a, b) => a + Math.floor(this.rng() * (b - a + 1));
    const drop = (k, n) => { if (n > 0 && B[k]) this.dropItem(B[k], n, m.x, m.y + 0.5, m.z); };
    const cooked = m.burn > 0;
    switch (m.type) {
      case 'pig': drop(cooked ? 'cooked_porkchop' : 'porkchop', r(1, 3)); break;
      case 'cow': drop(cooked ? 'steak' : 'beef', r(1, 3)); drop('leather', r(0, 2)); break;
      case 'sheep': drop(m.color[1], 1); drop(cooked ? 'cooked_mutton' : 'mutton', r(1, 2)); break;
      case 'chicken': drop(cooked ? 'cooked_chicken' : 'chicken', 1); drop('feather', r(0, 2)); break;
      case 'zombie': drop('rotten_flesh', r(0, 2)); if (this.rng() < 0.025) drop('iron_ingot', 1); if (this.rng() < 0.025) drop('carrot', 1); break;
      case 'skeleton': drop('bone', r(0, 2)); drop('arrow', r(0, 2)); break;
      case 'creeper': drop('gunpowder', r(0, 2)); break;
      case 'spider': drop('string', r(0, 2)); break;
      case 'iron_golem': drop('iron_ingot', r(3, 5)); drop('poppy', r(0, 2)); break;
    }
  };

  E.raycastMobs = function (ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const w = m.D.w / 2;
      const h = MC.rayBox(ox, oy, oz, dx, dy, dz, [m.x - w, m.y, m.z - w, m.x + w, m.y + m.D.h, m.z + w]);
      if (h && h.t <= maxDist && (!best || h.t < best.t)) best = { mob: m, t: h.t };
    }
    return best;
  };

  // linea di vista tra due punti (solo blocchi opachi)
  E.lineOfSight = function (world, x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    const hit = MC.raycast(world, x0, y0, z0, dx / d, dy / d, dz / d, d);
    return !hit || !OPAQUE[hit.id];
  };

  // ---------------- Frecce ----------------
  E.shootArrow = function (x, y, z, vx, vy, vz, owner, dmg) {
    this.arrows.push({ x, y, z, vx, vy, vz, owner, dmg: dmg || 3, stuck: false, age: 0 });
    if (this.arrows.length > 200) this.arrows.shift();
  };

  E.updateArrows = function (dt, world, player) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.age += dt;
      if (a.age > 60 || a.y < -40) { this.arrows.splice(i, 1); continue; }
      if (a.stuck) {
        if (a.owner === 'player' && a.age > 0.5 && Math.hypot(player.x - a.x, player.y + 0.8 - a.y, player.z - a.z) < 1.4) {
          if (player.mode === 'survival') { if (this.game.inventory.add(B.arrow, 1) === 0) { this.game.audio.pop(); this.arrows.splice(i, 1); } }
          else this.arrows.splice(i, 1);
        }
        if (!SOLID[world.getBlock(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))]) { a.stuck = false; a.vx = a.vz = 0; }
        continue;
      }
      a.vy -= 20 * dt;
      a.vx *= 1 - dt * 0.2; a.vz *= 1 - dt * 0.2;
      const steps = Math.max(1, Math.ceil(Math.hypot(a.vx, a.vy, a.vz) * dt / 0.25));
      const sdt = dt / steps;
      let done = false;
      for (let k = 0; k < steps && !done; k++) {
        const nx = a.x + a.vx * sdt, ny = a.y + a.vy * sdt, nz = a.z + a.vz * sdt;
        // bersagli
        const hitE = (ex, ey, ez, w, h) => nx > ex - w / 2 - 0.1 && nx < ex + w / 2 + 0.1 && nz > ez - w / 2 - 0.1 && nz < ez + w / 2 + 0.1 && ny > ey && ny < ey + h;
        if (a.owner !== 'player' && !player.dead && hitE(player.x, player.y, player.z, 0.6, 1.8)) {
          const sp = Math.hypot(a.vx, a.vz) || 1;
          player.damage(Math.ceil(a.dmg), 'arrow', a.vx / sp, a.vz / sp);
          this.arrows.splice(i, 1); done = true; break;
        }
        for (const m of this.mobs) {
          if (m.dead || m === a.owner) continue;
          if (hitE(m.x, m.y, m.z, m.D.w, m.D.h)) {
            this.hitMob(m, Math.ceil(a.dmg), a.x - a.vx, a.z - a.vz, 0.6);
            if (a.owner === 'player' || a.owner && a.owner.type === 'skeleton') m.target = a.owner === 'player' ? 'player' : a.owner;
            this.arrows.splice(i, 1); done = true; break;
          }
        }
        if (done) break;
        const b = world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (SOLID[b] && MC.getCollisionBox(b)) { a.stuck = true; a.age = Math.max(a.age, 0); this.game.audio.hit(b); done = true; break; }
        a.x = nx; a.y = ny; a.z = nz;
      }
    }
  };

  E.renderArrows = function (bt, env, cam, world) {
    const L = MC.textures.index.white;
    for (const a of this.arrows) {
      const l = MC.lightAt(world, a.x, a.y, a.z, env);
      const sp = Math.hypot(a.vx, a.vy, a.vz);
      if (!a.stuck && sp > 0.01) { a.yaw = Math.atan2(-a.vx, -a.vz); a.pitch = Math.asin(Math.max(-1, Math.min(1, a.vy / sp))); }
      const M = mat4.translate(mat4.create(), a.x - cam.x, a.y - cam.y, a.z - cam.z);
      mat4.rotY(tA, a.yaw || 0); mat4.mul(M, M, tA);
      mat4.rotX(tA, a.pitch || 0); mat4.mul(M, M, tA);
      bt.box(M, -0.025, -0.025, -0.1, 0.025, 0.025, 0.55, L, l, [0.55, 0.4, 0.22, 1]);
      bt.box(M, -0.045, -0.045, -0.2, 0.045, 0.045, -0.08, L, l, [0.6, 0.6, 0.62, 1]);
      bt.box(M, -0.08, -0.01, 0.4, 0.08, 0.01, 0.55, L, l, [0.95, 0.95, 0.95, 1]);
      bt.box(M, -0.01, -0.08, 0.4, 0.01, 0.08, 0.55, L, l, [0.95, 0.95, 0.95, 1]);
    }
  };

  // ---------------- Comparsa ----------------
  E._spawnLogic = function (dt, world, player, env) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 1.0;
    this._villageSpawns(world, player);
    if (!this.game.settings.mobs) return;
    let passive = 0, hostile = 0;
    for (const m of this.mobs) { if (m.D.hostile) hostile++; else if (!m.persistent) passive++; }
    const night = env.dayF < 0.3;
    for (let i = 0; i < 4; i++) {
      const a = this.rng() * Math.PI * 2, r = 24 + this.rng() * 40;
      const x = Math.floor(player.x + Math.cos(a) * r), z = Math.floor(player.z + Math.sin(a) * r);
      if (!world.isReady(x, z)) continue;
      const wantHostile = night ? this.rng() < 0.75 : this.rng() < 0.25;
      if (wantHostile) {
        if (hostile >= 10) continue;
        let y = world.topSolid(x, z);
        if (!night || this.rng() < 0.4) {
          // grotte
          y = 8 + Math.floor(this.rng() * 50);
          let ok = false;
          for (let k = 0; k < 12; k++, y++) {
            if (OPAQUE[world.getBlock(x, y, z)] && !world.getBlock(x, y + 1, z) && !world.getBlock(x, y + 2, z)) { ok = true; break; }
          }
          if (!ok) continue;
        }
        const b = world.getBlock(x, y, z);
        if (!OPAQUE[b] || world.getBlock(x, y + 1, z) || world.getBlock(x, y + 2, z)) continue;
        if (b === B.oak_planks && world.getBlock(x, y - 1, z) === B.cobblestone) continue;
        const sky = world.getSky(x, y + 1, z) * env.day, blk = world.getBlockLight(x, y + 1, z);
        if (sky > 6 || blk > 6) continue;
        const rr = this.rng();
        const t = rr < 0.4 ? 'zombie' : rr < 0.7 ? 'skeleton' : rr < 0.9 ? 'creeper' : 'spider';
        if (t === 'spider' && (world.getBlock(x + 1, y + 1, z) || world.getBlock(x - 1, y + 1, z))) continue;
        this.spawnMob(t, x + 0.5, y + 1, z + 0.5);
        hostile++;
      } else {
        if (passive >= 12) continue;
        const y = world.topSolid(x, z);
        if (world.getBlock(x, y, z) !== B.grass || world.getBlock(x, y + 1, z) !== 0) continue;
        const types = ['pig', 'cow', 'sheep', 'chicken', 'sheep', 'cow'];
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
  };

  // popola i villaggi caricati
  E._villageSpawns = function (world, player) {
    const gen = world.gen;
    if (!gen.villagesNear) return;
    for (const v of gen.villagesNear(player.x, player.z, 96)) {
      if (!world.isReady(v.x, v.z)) continue;
      const key = v.x + ',' + v.z;
      if (this.mobs.some((m) => m.home === key && !m.dead)) continue;
      const cy = world.topSolid(v.x, v.z) + 1;
      const n = 4 + (v.size || 0);
      const profs = Object.keys(MC.mobs.PROFESSIONS);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, r = 5 + this.rng() * 4;
        const x = Math.floor(v.x + Math.cos(a) * r), z = Math.floor(v.z + Math.sin(a) * r);
        const y = world.topSolid(x, z) + 1;
        this.spawnMob('villager', x + 0.5, y, z + 0.5, { home: key, persistent: true, prof: profs[i % profs.length] });
      }
      this.spawnMob('iron_golem', v.x + 3.5, cy, v.z + 0.5, { home: key, persistent: true });
    }
  };

  // ---------------- Intelligenza ----------------
  E._walkToward = function (m, tx, tz, speed, dt) {
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz) || 1;
    m.dirX = dx / d; m.dirZ = dz / d;
    m.wantSpeed = speed;
  };

  E._mobAI = function (m, dt, world, player, env) {
    const D = m.D;
    m.timer -= dt; m.attackCd -= dt; m.jumpCd -= dt; m.shootCd -= dt;
    if (m.angry > 0) m.angry -= dt;
    if (m.swing > 0) m.swing -= dt;
    m.wantSpeed = 0;
    let lookAt = null;
    const pdx = player.x - m.x, pdz = player.z - m.z, pd = Math.hypot(pdx, pdz);
    const survival = player.mode === 'survival' && !player.dead;
    const eyeY = m.y + D.eye;
    const canSee = () => this.lineOfSight(world, m.x, eyeY, m.z, player.x, player.y + 1.6, player.z);

    const wander = (speedMul, home) => {
      if (m.timer <= 0) {
        m.timer = 2 + this.rng() * 6;
        if (home && Math.hypot(home[0] - m.x, home[1] - m.z) > 20) { const a = Math.atan2(home[1] - m.z, home[0] - m.x); m.wx = Math.cos(a); m.wz = Math.sin(a); m.timer = 4; }
        else if (this.rng() < 0.55) { const a = this.rng() * 6.28; m.wx = Math.cos(a); m.wz = Math.sin(a); }
        else { m.wx = 0; m.wz = 0; }
      }
      if (m.wx || m.wz) { m.dirX = m.wx; m.dirZ = m.wz; m.wantSpeed = D.speed * speedMul; }
    };

    if (D.hostile) {
      // bersaglio: giocatore (sopravvivenza) oppure villici per gli zombie
      let target = null;
      const neutralSpider = m.type === 'spider' && env.dayF > 0.5 && m.angry <= 0;
      if (survival && pd < 20 && Math.abs(player.y - m.y) < 12 && !neutralSpider) target = 'player';
      if (!target && m.type === 'zombie') {
        let best = 16;
        for (const o of this.mobs) if (o.type === 'villager' && !o.dead) { const d = Math.hypot(o.x - m.x, o.z - m.z); if (d < best) { best = d; target = o; } }
      }
      if (m.target && m.target !== 'player' && !m.target.dead) target = m.target;
      if (target) {
        const tx = target === 'player' ? player.x : target.x, tz = target === 'player' ? player.z : target.z;
        const ty = target === 'player' ? player.y : target.y;
        const dist = Math.hypot(tx - m.x, tz - m.z);
        lookAt = [tx, ty + 1.5, tz];
        if (m.type === 'skeleton') {
          const see = target === 'player' ? canSee() : true;
          if (dist > 12 || !see) this._walkToward(m, tx, tz, D.speed, dt);
          else if (dist < 5) { this._walkToward(m, m.x - (tx - m.x), m.z - (tz - m.z), D.speed * 0.9, dt); }
          else { const a = Math.atan2(tz - m.z, tx - m.x) + (Math.PI / 2) * m.strafe; m.dirX = Math.cos(a); m.dirZ = Math.sin(a); m.wantSpeed = D.speed * 0.5; if (this.rng() < dt * 0.3) m.strafe *= -1; }
          m.aiming = see && dist < 16;
          if (m.aiming && m.shootCd <= 0) {
            m.shootCd = 1.6 + this.rng() * 1.2;
            const sx = m.x, sy = eyeY - 0.1, sz = m.z;
            const dx = tx - sx, dz = tz - sz, dy = ty + 1.0 - sy, hd = Math.hypot(dx, dz);
            const speed = 26, t = hd / speed;
            const vy = (dy + 0.5 * 20 * t * t) / Math.max(0.05, t);
            const inacc = 0.06;
            this.shootArrow(sx + dx / hd * 0.6, sy, sz + dz / hd * 0.6, (dx / hd + (this.rng() - 0.5) * inacc) * speed, vy, (dz / hd + (this.rng() - 0.5) * inacc) * speed, m, 2 + this.rng() * 2);
            this.game.audio.bow(Math.max(0.1, 1 - pd / 24));
          }
        } else if (m.type === 'creeper') {
          const see = target === 'player' ? canSee() : false;
          if (dist < 3 && see) {
            if (m.fuse === 0) this.game.audio.hiss(Math.max(0.2, 1 - pd / 16));
            m.fuse += dt;
          } else {
            m.fuse = Math.max(0, m.fuse - dt);
            this._walkToward(m, tx, tz, D.speed, dt);
          }
          if (m.fuse >= 1.5) {
            m.dead = 99; m.removeNow = true;
            this.game.explode(m.x, m.y + 0.8, m.z, 3);
          }
        } else {
          this._walkToward(m, tx, tz, D.speed * (m.type === 'spider' ? 1 : 1), dt);
          const reach = m.type === 'spider' ? 1.6 : 1.3;
          if (dist < reach + 0.4 && Math.abs(ty - m.y) < 1.8 && m.attackCd <= 0) {
            m.attackCd = 1;
            m.swing = 0.3;
            if (target === 'player') player.damage(m.type === 'spider' ? 2 : 3, m.type, (tx - m.x) / (dist || 1), (tz - m.z) / (dist || 1));
            else this.hitMob(target, 3, m.x, m.z);
          }
          if (m.type === 'spider' && dist < 4 && dist > 1.8 && m.onGround && m.jumpCd <= 0) { m.vy = 5.5; m.vx += (tx - m.x) / dist * 3; m.vz += (tz - m.z) / dist * 3; m.jumpCd = 1.5; }
        }
      } else {
        m.fuse = Math.max(0, m.fuse - dt);
        m.aiming = false;
        wander(0.4);
      }
      // brucia al sole
      if (D.burns) {
        const sky = world.getSky(Math.floor(m.x), Math.floor(m.y + 1.7), Math.floor(m.z));
        if (sky >= 15 && env.dayF > 0.6 && !m.inWater && !FLUID[world.getBlock(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z))]) {
          m.burn += dt;
          if (this.rng() < 0.5) this.flame(m.x + (this.rng() - 0.5) * 0.5, m.y + this.rng() * 1.9, m.z + (this.rng() - 0.5) * 0.5);
          if (m.burn > 1) { m.burn = 0.01; m.hp -= 1; m.hurt = 0.3; if (m.hp <= 0) this.killMob(m); }
        }
      }
    } else if (m.type === 'villager') {
      // scappa dagli zombie, altrimenti gironzola vicino a casa
      let threat = null;
      for (const o of this.mobs) if (o.type === 'zombie' && !o.dead && Math.hypot(o.x - m.x, o.z - m.z) < 8) { threat = o; break; }
      const home = m.home ? m.home.split(',').map(Number) : null;
      if (threat) { this._walkToward(m, m.x - (threat.x - m.x), m.z - (threat.z - m.z), D.speed * 1.6, dt); }
      else if (env.dayF < 0.25 && home) { if (Math.hypot(home[0] - m.x, home[1] - m.z) > 6) this._walkToward(m, home[0] + 0.5, home[1] + 0.5, D.speed, dt); }
      else wander(0.7, home);
      if (pd < 6) lookAt = [player.x, player.y + 1.6, player.z];
    } else if (m.type === 'iron_golem') {
      let target = null, best = 16;
      for (const o of this.mobs) if (o.D.hostile && !o.dead) { const d = Math.hypot(o.x - m.x, o.z - m.z); if (d < best) { best = d; target = o; } }
      if (m.angry > 0 && survival && pd < 20) target = 'player';
      const home = m.home ? m.home.split(',').map(Number) : null;
      if (target) {
        const tx = target === 'player' ? player.x : target.x, tz = target === 'player' ? player.z : target.z, ty = target === 'player' ? player.y : target.y;
        const dist = Math.hypot(tx - m.x, tz - m.z);
        lookAt = [tx, ty + 1, tz];
        this._walkToward(m, tx, tz, D.speed * 1.2, dt);
        if (dist < 2.3 && m.attackCd <= 0) {
          m.attackCd = 1.2; m.swing = 0.5;
          if (target === 'player') { player.damage(10, 'golem', (tx - m.x) / dist, (tz - m.z) / dist); player.vy = 9; }
          else { this.hitMob(target, 12, m.x, m.z, 1.5); target.vy = 9; }
          this.game.audio.mob('iron_golem', false, 1);
        }
      } else wander(0.5, home);
    } else {
      // animali
      if (m.panic > 0) {
        m.panic -= dt;
        if (m.timer <= 0) { m.timer = 0.6 + this.rng(); const a = this.rng() * 6.28; m.wx = Math.cos(a); m.wz = Math.sin(a); }
        m.dirX = m.wx || 0; m.dirZ = m.wz || 0; m.wantSpeed = D.speed * 2;
      } else {
        // seguono il giocatore che tiene il cibo preferito
        const held = this.game.inventory.held();
        const lure = { pig: B.carrot, cow: B.wheat_item, sheep: B.wheat_item, chicken: B.wheat_seeds }[m.type];
        if (held && held.id === lure && pd < 10 && pd > 2) { this._walkToward(m, player.x, player.z, D.speed * 1.1, dt); lookAt = [player.x, player.y + 1.6, player.z]; }
        else wander(0.6);
      }
      if (!lookAt && pd < 6 && m.wantSpeed === 0) lookAt = [player.x, player.y + 1.6, player.z];
    }

    // evita dirupi, lava e acqua profonda (non per chi insegue)
    if (m.wantSpeed > 0 && !D.hostile) {
      const ax = Math.floor(m.x + m.dirX * 0.9), az = Math.floor(m.z + m.dirZ * 0.9);
      let drop = 0;
      for (let k = 0; k < 4; k++) { if (SOLID[world.getBlock(ax, Math.floor(m.y) - 1 - k, az)]) break; drop++; }
      const lava = world.getBlock(ax, Math.floor(m.y) - 1, az) === B.lava || world.getBlock(ax, Math.floor(m.y), az) === B.lava;
      if ((drop >= 3 && m.panic <= 0) || lava) { m.wx = -(m.wx || 0); m.wz = -(m.wz || 0); m.wantSpeed = 0; m.timer = 0.5; }
    }

    // movimento
    if (m.wantSpeed > 0) {
      const want = Math.atan2(-m.dirX, -m.dirZ);
      m.yaw += shortAngle(want - m.yaw) * Math.min(1, dt * 8);
      const k = Math.min(1, dt * (m.onGround ? 10 : 2));
      m.vx += (m.dirX * m.wantSpeed - m.vx) * k;
      m.vz += (m.dirZ * m.wantSpeed - m.vz) * k;
      if (m.hitH && m.jumpCd <= 0) {
        if (D.climbs) { m.vy = 3.2; }
        else if (m.onGround) { m.vy = 8.2; m.jumpCd = 0.4; }
      }
      if (m.inWater) { m.vy = Math.max(m.vy, m.hitH ? 4 : 1.5); }
    } else if (m.onGround) {
      m.vx *= Math.max(0, 1 - dt * 10); m.vz *= Math.max(0, 1 - dt * 10);
    }
    if (m.type === 'chicken' && !m.onGround && m.vy < -2) m.vy = -2;
    // corpo e testa
    m.bodyYaw += shortAngle(m.yaw - m.bodyYaw) * Math.min(1, dt * 6);
    if (lookAt) {
      const want = Math.atan2(-(lookAt[0] - m.x), -(lookAt[2] - m.z));
      m.headYaw += (Math.max(-1.2, Math.min(1.2, shortAngle(want - m.bodyYaw))) - m.headYaw) * Math.min(1, dt * 6);
      const hd = Math.hypot(lookAt[0] - m.x, lookAt[2] - m.z);
      m.headPitch += (Math.max(-0.8, Math.min(0.8, -Math.atan2(lookAt[1] - eyeY, hd))) - m.headPitch) * Math.min(1, dt * 6);
    } else { m.headYaw *= 1 - Math.min(1, dt * 3); m.headPitch *= 1 - Math.min(1, dt * 3); }
    if (m.inLava) { m.hp -= dt * 4; m.hurt = 0.2; m.burn = 1; if (m.hp <= 0) this.killMob(m); }
    // versi
    m.soundTimer -= dt;
    if (m.soundTimer <= 0) {
      m.soundTimer = 6 + this.rng() * 14;
      const d = Math.hypot(player.x - m.x, player.y - m.y, player.z - m.z);
      if (d < 16 && m.type !== 'creeper') this.game.audio.mob(m.type, false, 1 - d / 16);
    }
  };

  E.updateMobs = function (dt, world, player, env) {
    this._spawnLogic(dt, world, player, env);
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const pd = Math.hypot(player.x - m.x, player.z - m.z);
      if (m.removeNow || pd > (m.persistent ? 130 : 110) || m.y < -40 || (!m.persistent && m.D.hostile && pd > 72 && this.rng() < dt * 0.05)) { this.mobs.splice(i, 1); continue; }
      if (!world.isReady(m.x, m.z)) continue;
      if (m.dead) {
        m.dead += dt;
        if (m.dead > 0.9) { this.smoke(m.x, m.y + 0.5, m.z, 12, false); this.mobs.splice(i, 1); continue; }
        this._physics(m, m.D.w, m.D.h, dt, world);
        continue;
      }
      if (m.hurt > 0) m.hurt -= dt;
      this._mobAI(m, dt, world, player, env);
      this._physics(m, m.D.w, m.D.h, dt, world);
      const hs = Math.hypot(m.vx, m.vz);
      m.walkAmt += (Math.min(1, hs / 2) - m.walkAmt) * Math.min(1, dt * 8);
      m.walk += hs * dt * 2.4;
      if (m.hp <= 0 && !m.dead) this.killMob(m);
    }
    // spinta tra entità
    for (const m of this.mobs) {
      if (m.dead) continue;
      const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz);
      const min = (m.D.w + 0.6) / 2;
      if (d < min && d > 0.001 && Math.abs(m.y - player.y) < 1.5) {
        const push = (min - d) * 4;
        m.vx += (dx / d) * push; m.vz += (dz / d) * push;
      }
    }
  };

  // ---------------- Disegno ----------------
  E.renderMobs = function (bt, env, cam, world, time) {
    const px = 1 / 16;
    for (const m of this.mobs) {
      const dcam = Math.hypot(m.x - cam.x, m.z - cam.z);
      if (dcam > 96) continue;
      const l = MC.lightAt(world, m.x, m.y + Math.min(1.2, m.D.h * 0.6), m.z, env);
      const hurt = m.hurt > 0 || (m.dead && m.dead < 90);
      const flash = m.type === 'creeper' && m.fuse > 0 && Math.floor(m.fuse * 8) % 2 === 0;
      const base = mat4.translate(mat4.create(), m.x - cam.x, m.y - cam.y, m.z - cam.z);
      mat4.rotY(tA, m.bodyYaw); mat4.mul(base, base, tA);
      if (m.dead) { mat4.rotZ(tA, Math.min(1, m.dead * 3) * Math.PI / 2); mat4.mul(base, base, tA); }
      let sc = px;
      if (m.type === 'creeper' && m.fuse > 0) sc *= 1 + Math.min(0.25, m.fuse * 0.15);
      mat4.scale(tA, sc, sc, sc); mat4.mul(base, base, tA);
      const sw = Math.sin(m.walk * 2.2) * 0.75 * m.walkAmt;
      const sw2 = Math.sin(m.walk * 3.2);
      for (const p of m.parts) {
        let M = base;
        if (p.pv) {
          M = mat4.create();
          mat4.translate(tA, p.pv[0], p.pv[1], p.pv[2]); mat4.mul(M, base, tA);
          const a = p.a;
          if (a === 'head') {
            mat4.rotY(tB, m.headYaw); mat4.mul(M, M, tB);
            mat4.rotX(tB, m.headPitch); mat4.mul(M, M, tB);
          } else if (a === 'legA' || a === 'legB') {
            mat4.rotX(tB, a === 'legA' ? sw : -sw); mat4.mul(M, M, tB);
          } else if (a === 'armA' || a === 'armB') {
            let ang = (a === 'armA' ? -sw : sw) * 0.8;
            if (m.aiming) ang = -Math.PI / 2 + m.headPitch * 0.5;
            if (m.swing > 0 && a === 'armB') ang -= Math.sin(m.swing * 10) * 1.2;
            mat4.rotX(tB, ang); mat4.mul(M, M, tB);
            if (m.aiming && a === 'armA') { mat4.rotY(tB, -0.4); mat4.mul(M, M, tB); }
          } else if (a === 'armFA' || a === 'armFB') {
            const ang = -Math.PI / 2 + Math.sin(time * 1.5 + (a === 'armFA' ? 0 : 1)) * 0.06 - (m.swing > 0 ? Math.sin(m.swing * 10) * 0.5 : 0);
            mat4.rotX(tB, ang); mat4.mul(M, M, tB);
          } else if (a === 'golemArmA' || a === 'golemArmB') {
            let ang = (a === 'golemArmA' ? sw : -sw) * 0.6;
            if (m.swing > 0) ang = -Math.sin((m.swing / 0.5) * Math.PI) * 2;
            mat4.rotX(tB, ang); mat4.mul(M, M, tB);
          } else if (a === 'wingL' || a === 'wingR') {
            const f = m.onGround ? 0 : Math.abs(Math.sin(time * 22)) * 1.1;
            mat4.rotZ(tB, a === 'wingL' ? -f : f); mat4.mul(M, M, tB);
          } else if (a && a.startsWith('spider')) {
            const right = a[6] === 'R', i = +a[7];
            const yawBase = [0.78, 0.39, -0.39, -0.78][i], droop = [0.78, 0.58, 0.58, 0.78][i];
            const ph = Math.sin(m.walk * 3 + i * 1.6 + (right ? 0 : Math.PI)) * 0.35 * m.walkAmt;
            const lift = Math.max(0, Math.cos(m.walk * 3 + i * 1.6 + (right ? 0 : Math.PI))) * 0.3 * m.walkAmt;
            mat4.rotY(tB, (right ? yawBase : -yawBase) + ph); mat4.mul(M, M, tB);
            mat4.rotZ(tB, right ? -droop + lift : droop - lift); mat4.mul(M, M, tB);
          }
          if (p.r) {
            if (p.r[0]) { mat4.rotX(tB, p.r[0]); mat4.mul(M, M, tB); }
            if (p.r[1]) { mat4.rotY(tB, p.r[1]); mat4.mul(M, M, tB); }
            if (p.r[2]) { mat4.rotZ(tB, p.r[2]); mat4.mul(M, M, tB); }
          }
          mat4.translate(tA, -p.pv[0], -p.pv[1], -p.pv[2]); mat4.mul(M, M, tA);
        }
        const b = p.b, inf = p.inf || 0;
        let col = [1, 1, 1, 1];
        if (p.tint && m.color) col = [m.color[0][0] / 255, m.color[0][1] / 255, m.color[0][2] / 255, 1];
        if (hurt) col = [col[0] * 1.0, col[1] * 0.45, col[2] * 0.45, 1];
        if (flash) col = [2.2, 2.2, 2.2, 1];
        bt.box(M, b[0] - inf, b[1] - inf, b[2] - inf, b[3] + inf, b[4] + inf, b[5] + inf, m.skin, l, col, p.uvs);
      }
      // arco in mano allo scheletro
      if (m.type === 'skeleton' && !m.dead) {
        const arm = m.parts[3];
        const M = mat4.create();
        mat4.translate(tA, arm.pv[0], arm.pv[1], arm.pv[2]); mat4.mul(M, base, tA);
        const ang = m.aiming ? -Math.PI / 2 + m.headPitch * 0.5 : sw * 0.8;
        mat4.rotX(tB, ang); mat4.mul(M, M, tB);
        mat4.translate(tA, 0, -11, -1); mat4.mul(M, M, tA);
        mat4.rotX(tB, Math.PI / 2); mat4.mul(M, M, tB);
        mat4.rotY(tB, Math.PI / 2); mat4.mul(M, M, tB);
        mat4.scale(tA, 16, 16, 16); mat4.mul(M, M, tA);
        MC.drawItemModel(bt, M, B.bow, 0.7, l);
      }
    }
  };
})();
