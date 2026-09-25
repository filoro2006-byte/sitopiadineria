// Controller principale
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const B = MC.B;
  const { SOLID, FLUID, OPAQUE, REPLACEABLE } = MC.BL;
  const WH = MC.WH;
  const mat4 = MC.mat4;

  const DEFAULTS = {
    renderDist: 8, fov: 72, sens: 100, volume: 60, bright: 40, scale: 100,
    fancyLeaves: true, clouds: true, bob: true, mobs: true, invert: false, weather: true,
  };

  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyR']);
  const isLeafOrLog = (b) => {
    const d = MC.blocks[b];
    return d && (d.key.endsWith('_leaves') || d.key.endsWith('_log'));
  };

  class Game {
    constructor() {
      this.canvas = document.getElementById('game');
      this.settings = this._loadSettings();
      this.state = 'boot';
      try {
        MC.textures.build();
        this.renderer = new MC.Renderer(this.canvas);
      } catch (e) {
        console.error(e);
        this.audio = new MC.Audio();
        this.ui = new MC.UI(this);
        this.ui.showError('Il tuo browser non supporta WebGL2 o l\'accelerazione grafica è disattivata. Aggiorna Safari/Brave e attiva l\'accelerazione hardware. Dettagli: ' + e.message);
        return;
      }
      this.audio = new MC.Audio();
      this.audio.setVolume(this.settings.volume / 100);
      this.storage = new MC.Storage();
      this.inventory = new MC.Inventory();
      this.player = new MC.Player();
      this.ui = new MC.UI(this);
      this.entities = new MC.Entities(this);
      this.inventory.onChange = () => { this.ui.updateHotbar(); };
      this.player.onHurt = (a, cause) => { this.lastHurt = cause; this.audio.hurt(); };
      this.player.onStep = (id) => this.audio.step(id);
      this.player.onLand = (d, id) => { if (d > 1.2) this.audio.land(id); };
      this.player.onSplash = () => { this.audio.splash(); this.entities.splash(this.player.x, this.player.y + 0.3, this.player.z); };
      this.world = null;
      this.meta = null;
      this.keys = new Set();
      this.mouse = { left: false, right: false };
      this.time = 1000;
      this.frame = 0;
      this.tickAcc = 0;
      this.rain = 0; this.rainTarget = 0; this.weatherTimer = 6000;
      this.breaking = null;
      this.breakCd = 0; this.useCd = 0; this.attackCd = 0;
      this.swing = 0; this.equip = 0;
      this.shake = 0;
      this.locked = false;
      this.hudHidden = false;
      this.showDebug = false;
      this.fps = 0; this._fpsN = 0; this._fpsT = 0;
      this.last = 0;
      this.rng = MC.util.mulberry32((Math.random() * 1e9) | 0);
      this.lastSpace = 0; this.lastW = 0; this.sprintTap = false;
      this.saveTimer = 0; this.unloadTimer = 0; this.debugTimer = 0;
      this.pendingSpawn = false;
      this.wheelAcc = 0;
      this.rainCache = new Map(); this.rainCacheT = 0;
      this._bindInput();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
      this.start();
    }

    // ---------------- Impostazioni ----------------
    _loadSettings() {
      let s = {};
      try { s = JSON.parse(localStorage.getItem('blockcraft-settings') || '{}') || {}; } catch (e) { s = {}; }
      return Object.assign({}, DEFAULTS, s);
    }
    saveSettings() {
      try { localStorage.setItem('blockcraft-settings', JSON.stringify(this.settings)); } catch (e) { /* ignora */ }
      this.applySettings();
    }
    applySettings(remesh) {
      if (this.renderer) this.renderer.renderScale = this.settings.scale / 100;
      if (this.world) {
        this.world.renderDist = this.settings.renderDist;
        if (remesh) for (const c of this.world.chunks.values()) if (c.state === MC.ST.READY) c.dirty.fill(1);
      }
    }

    async start() {
      const ok = await this.storage.open();
      if (!ok) document.getElementById('storage-warn').classList.remove('hidden');
      this.ui.renderWorldList(await this.storage.listWorlds());
      this.state = 'menu';
      this.ui.show('screen-main');
    }

    // ---------------- Input ----------------
    _bindInput() {
      window.addEventListener('keydown', (e) => this._keyDown(e));
      window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'KeyW') this.sprintTap = false; });
      window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
      this.canvas.addEventListener('mousedown', (e) => this._mouseDown(e));
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) { this.mouse.left = false; this.breaking = null; }
        if (e.button === 2) this.mouse.right = false;
      });
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('mousemove', (e) => {
        if (!this.locked || this.state !== 'playing') return;
        let mx = e.movementX || 0, my = e.movementY || 0;
        if (Math.abs(mx) > 400 || Math.abs(my) > 400) return; // salti anomali
        const k = 0.0023 * (this.settings.sens / 100);
        this.player.yaw -= mx * k;
        this.player.pitch -= my * k * (this.settings.invert ? -1 : 1);
        const lim = Math.PI / 2 - 0.001;
        if (this.player.pitch > lim) this.player.pitch = lim;
        if (this.player.pitch < -lim) this.player.pitch = -lim;
      });
      this.canvas.addEventListener('wheel', (e) => {
        if (this.state !== 'playing') return;
        e.preventDefault();
        this.wheelAcc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
        const step = 50;
        while (Math.abs(this.wheelAcc) >= step) {
          const d = Math.sign(this.wheelAcc);
          this.wheelAcc -= d * step;
          this.inventory.selected = (this.inventory.selected + d + 9) % 9;
          this._selChanged();
        }
      }, { passive: false });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === this.canvas;
        if (this.locked) {
          document.getElementById('click-to-play').classList.add('hidden');
        } else if (this.state === 'playing') {
          this.pause();
        }
      });
      document.addEventListener('pointerlockerror', () => {
        if (this.state === 'playing') document.getElementById('click-to-play').classList.remove('hidden');
      });
      window.addEventListener('resize', () => this.renderer && this.renderer.resize());
      const saveNow = () => { if (this.world) this.autosave(); };
      document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
      window.addEventListener('pagehide', saveNow);
      window.addEventListener('beforeunload', (e) => {
        if (this.world && (this.state === 'playing' || this.state === 'inventory')) {
          saveNow();
          e.preventDefault();
          e.returnValue = '';
        }
      });
    }

    lockPointer() {
      if (this.state !== 'playing') return;
      try {
        const p = this.canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => { if (this.state === 'playing' && !this.locked) document.getElementById('click-to-play').classList.remove('hidden'); });
      } catch (e) { document.getElementById('click-to-play').classList.remove('hidden'); }
      setTimeout(() => { if (this.state === 'playing' && !this.locked) document.getElementById('click-to-play').classList.remove('hidden'); }, 400);
    }
    unlockPointer() {
      if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* ignora */ } }
    }

    _keyDown(e) {
      const c = e.code;
      if (e.target && e.target.tagName === 'INPUT') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F3', 'Tab', 'Slash', 'Quote'].includes(c) && this.world) e.preventDefault();
      if (this.state === 'playing') {
        if (MOVE_KEYS.has(c)) this.keys.add(c);
        if (e.repeat) return;
        const now = performance.now();
        if (c === 'Space') {
          if (now - this.lastSpace < 300 && this.player.mode === 'creative') { this.player.flying = !this.player.flying; this.player.vy = 0; this.lastSpace = 0; }
          else this.lastSpace = now;
        }
        if (c === 'KeyW') { if (now - this.lastW < 300) this.sprintTap = true; this.lastW = now; }
        if (c.startsWith('Digit') && c !== 'Digit0') { this.inventory.selected = +c.slice(5) - 1; this._selChanged(); }
        if (c === 'KeyE') this.openInventory(null);
        if (c === 'KeyQ') this.dropHeld(e.ctrlKey || e.metaKey);
        if (c === 'KeyT' || c === 'Enter') { e.preventDefault(); this.openChat(''); }
        if (c === 'Slash') { e.preventDefault(); this.openChat('/'); }
        if (c === 'F3') { this.showDebug = this.ui.toggleDebug(); }
        if (c === 'F1') { this.hudHidden = !this.hudHidden; this.ui.showHUD(!this.hudHidden); }
        if (c === 'Escape' && !this.locked) this.pause();
      } else if (this.state === 'inventory') {
        if (c === 'KeyE' || c === 'Escape') { e.preventDefault(); this.closeInventory(); }
        else if (c.startsWith('Digit') && c !== 'Digit0') this.ui.numberKey(+c.slice(5) - 1);
      } else if (this.state === 'paused') {
        if (c === 'Escape' && !e.repeat) this.resume();
      }
    }

    _mouseDown(e) {
      this.audio.unlock();
      if (this.state !== 'playing') return;
      if (!this.locked) { this.lockPointer(); return; }
      e.preventDefault();
      if (e.button === 0) { this.mouse.left = true; this.breakCd = 0; this.attackCd = Math.min(this.attackCd, 0); }
      if (e.button === 2) { this.mouse.right = true; this.useCd = 0; }
      if (e.button === 1) this.pickBlock();
    }

    _selChanged() { this.ui.updateHotbar(); this.ui.showItemName(); this.equip = 1; }

    // ---------------- Stati ----------------
    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.keys.clear(); this.mouse.left = this.mouse.right = false;
      this.unlockPointer();
      document.getElementById('click-to-play').classList.add('hidden');
      this.ui.show('screen-pause');
      this.autosave();
    }
    resume() {
      this.ui.hideScreens();
      this.state = 'playing';
      this.lockPointer();
    }
    openInventory(station) {
      this.state = 'inventory';
      this.keys.clear(); this.mouse.left = this.mouse.right = false;
      this.unlockPointer();
      document.getElementById('click-to-play').classList.add('hidden');
      this.ui.openInventory(station);
    }
    closeInventory() {
      this.ui.closeInventory();
      this.state = 'playing';
      this.lockPointer();
    }
    openChat(prefix) {
      this.state = 'chat';
      this.keys.clear(); this.mouse.left = this.mouse.right = false;
      this.unlockPointer();
      document.getElementById('click-to-play').classList.add('hidden');
      this.ui.openChat(prefix);
    }
    onChatClosed() {
      if (this.state !== 'chat') return;
      this.state = 'playing';
      this.lockPointer();
    }

    // ---------------- Mondi ----------------
    async createWorld(name, seedText, mode, type) {
      const seed = MC.util.seedFromText(seedText);
      const meta = {
        id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
        name, seed, seedText: seedText || String(seed), mode, type,
        created: Date.now(), lastPlayed: Date.now(), time: 1000, player: null, inventory: null, spawn: null, rain: 0,
      };
      await this.storage.saveWorld(meta);
      this.openWorld(meta);
    }

    async openWorld(meta) {
      this.state = 'loading';
      this.ui.show('screen-loading');
      this.ui.setLoading(0, 'Lettura dei salvataggi...');
      const saved = await this.storage.loadChunks(meta.id);
      this.meta = meta;
      const w = new MC.World({ seed: meta.seed, type: meta.type, saved, renderDist: this.settings.renderDist });
      w.onSaveChunk = (k, data) => this.storage.saveChunk(meta.id, k, data);
      w.onUnload = (c) => this.renderer.freeChunk(c);
      w.onDrop = (id, x, y, z) => this._naturalDrop(id, x, y, z);
      this.world = w;
      const p = this.player;
      p.mode = meta.mode;
      p.dead = false; p.vx = p.vy = p.vz = 0; p.fallDist = 0; p.hurtTime = 0;
      p.air = 300;
      if (!meta.spawn) {
        const sp = w.gen.findSpawn();
        meta.spawn = { x: sp.x + 0.5, z: sp.z + 0.5 };
      }
      if (meta.player) {
        const s = meta.player;
        p.x = s.x; p.y = s.y; p.z = s.z; p.yaw = s.yaw || 0; p.pitch = s.pitch || 0;
        p.health = s.health === undefined ? 20 : s.health; p.flying = !!s.flying;
        this.pendingSpawn = false;
      } else {
        p.x = meta.spawn.x; p.z = meta.spawn.z; p.y = 150; p.yaw = 0; p.pitch = -0.2; p.health = 20; p.flying = false;
        this.pendingSpawn = true;
      }
      if (meta.inventory) this.inventory.load(meta.inventory);
      else this._defaultInventory();
      this.time = meta.time || 1000;
      this.rain = meta.rain || 0; this.rainTarget = this.rain > 0.5 ? 1 : 0;
      this.entities.clear();
      this.breaking = null;
      p.frozen = true;
      this.loadT0 = performance.now();
      this.applySettings();
      this.ui.buildHotbar();
      this.ui.updateHotbar();
    }

    _defaultInventory() {
      this.inventory.slots = new Array(36).fill(null);
      if (this.player.mode === 'creative') {
        const ids = ['grass', 'stone', 'dirt', 'cobblestone', 'oak_planks', 'oak_log', 'glass', 'torch', 'bricks'];
        ids.forEach((k, i) => { this.inventory.slots[i] = { id: B[k], count: 64 }; });
      }
      this.inventory.selected = 0;
      this.inventory._ch();
    }

    _findSafeY(x, z) {
      const w = this.world;
      for (let y = WH - 3; y > 1; y--) {
        const b = w.getBlock(x, y, z);
        if (!b) continue;
        if (FLUID[b]) return null;
        if (isLeafOrLog(b)) continue;
        if (!SOLID[b]) continue;
        if (!SOLID[w.getBlock(x, y + 1, z)] && !SOLID[w.getBlock(x, y + 2, z)] && !FLUID[w.getBlock(x, y + 1, z)]) return y + 1;
        return null;
      }
      return null;
    }

    _placeAtSpawn() {
      const w = this.world, p = this.player;
      const sx = Math.floor(this.meta.spawn.x), sz = Math.floor(this.meta.spawn.z);
      for (let r = 0; r <= 10; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (!w.isReady(sx + dx, sz + dz)) continue;
          const y = this._findSafeY(sx + dx, sz + dz);
          if (y !== null) { p.x = sx + dx + 0.5; p.z = sz + dz + 0.5; p.y = y; p.vy = 0; return true; }
        }
      }
      const y = w.topSolid(sx, sz);
      p.x = sx + 0.5; p.z = sz + 0.5; p.y = y + 1; p.vy = 0;
      return true;
    }

    saveMeta() {
      if (!this.meta || !this.world) return;
      const p = this.player;
      if (!this.pendingSpawn) this.meta.player = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, health: p.health, flying: p.flying };
      this.meta.inventory = this.inventory.serialize();
      this.meta.time = Math.floor(this.time);
      this.meta.mode = p.mode;
      this.meta.rain = this.rainTarget;
      this.meta.lastPlayed = Date.now();
      this.storage.saveWorld(this.meta);
    }

    autosave() {
      if (!this.world) return;
      this.world.saveAll();
      this.saveMeta();
      this.storage.flush();
    }

    async quitToMenu() {
      this.autosave();
      this.unlockPointer();
      if (this.world) for (const c of this.world.chunks.values()) this.renderer.freeChunk(c);
      this.world = null;
      this.meta = null;
      this.entities.clear();
      this.state = 'menu';
      this.ui.showHUD(false);
      this.ui.setFx(false, false, 0);
      document.getElementById('click-to-play').classList.add('hidden');
      this.ui.show('screen-main');
      await this.storage.flush();
      this.ui.renderWorldList(await this.storage.listWorlds());
      this.audio.setRain && this.audio.setRain(0);
    }

    // ---------------- Loop ----------------
    _loop(t) {
      requestAnimationFrame(this._loop);
      const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0.016;
      this.last = t;
      try {
        this._frame(dt, (t / 1000) % 3600);
      } catch (e) {
        console.error(e);
        if (!this._errShown) { this._errShown = true; if (this.ui) this.ui.chat('Errore: ' + e.message); }
      }
    }

    _frame(dt, tsec) {
      if (!this.renderer) return;
      this.frame++;
      this._fpsN++; this._fpsT += dt;
      if (this._fpsT >= 1) { this.fps = Math.round(this._fpsN / this._fpsT); this._fpsN = 0; this._fpsT = 0; }
      if (!this.world) return;
      if (this.state === 'loading') { this._loading(); return; }
      this._update(dt);
      this._render(dt, tsec);
    }

    _loading() {
      const w = this.world, p = this.player;
      w.updateLoading(p.x, p.z, 28);
      this.renderer.updateMeshes(w, p, 12, { fancyLeaves: this.settings.fancyLeaves });
      const R = Math.min(3, w.renderDist);
      const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
      let total = 0, ready = 0;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > R * R) continue;
        total++;
        const c = w.getChunk(pcx + dx, pcz + dz);
        if (c && c.state === MC.ST.READY && !c.dirty.some((v) => v)) ready++;
        else if (c) ready += c.state * 0.2;
      }
      const frac = ready / total;
      this.ui.setLoading(frac, 'Chunk pronti: ' + Math.floor(ready) + ' / ' + total);
      if (frac >= 0.999 || performance.now() - this.loadT0 > 60000) {
        if (this.pendingSpawn) { this._placeAtSpawn(); this.pendingSpawn = false; }
        this.state = 'playing';
        this.ui.hideScreens();
        this.ui.showHUD(!this.hudHidden);
        this.ui.updateHotbar();
        this.ui.updateBars();
        document.getElementById('click-to-play').classList.remove('hidden');
        this.ui.chat('Benvenuto in ' + this.meta.name + '! Premi T per i comandi, E per l\'inventario.');
      }
    }

    _input() {
      if (this.state !== 'playing') return {};
      const k = this.keys;
      return {
        forward: k.has('KeyW') || k.has('ArrowUp'),
        back: k.has('KeyS') || k.has('ArrowDown'),
        left: k.has('KeyA') || k.has('ArrowLeft'),
        right: k.has('KeyD') || k.has('ArrowRight'),
        jump: k.has('Space'),
        sneak: k.has('ShiftLeft') || k.has('ShiftRight'),
        sprint: k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyR') || this.sprintTap,
      };
    }

    _update(dt) {
      const w = this.world, p = this.player;
      const simulate = this.state !== 'paused';
      if (!simulate) return;
      const env = this.renderer.computeEnv(this.time, p.eyeInWater, p.eyeInLava, w.renderDist, this._rainLevel());
      env.gamma = 0.15 + (this.settings.bright / 100) * 0.85;
      this.env = env;

      // attesa della rinascita/spawn
      if (this.pendingSpawn && w.isReady(p.x, p.z)) {
        const c = w.getChunk(Math.floor(p.x) >> 4, Math.floor(p.z) >> 4);
        if (c && !c.dirty.some((v) => v)) { this._placeAtSpawn(); this.pendingSpawn = false; }
      }
      p.frozen = this.pendingSpawn || !w.isReady(p.x, p.z);
      const input = this._input();
      let rem = dt;
      while (rem > 1e-6) { const s = Math.min(rem, 1 / 60); p.update(s, input, w); rem -= s; }

      // tick del mondo (20 al secondo)
      this.tickAcc += dt;
      let n = 0;
      while (this.tickAcc >= 0.05 && n < 5) {
        this.tickAcc -= 0.05; n++;
        w.tick();
        w.randomTicks(p.x, p.z, this.rng);
        this.time += 1;
        this._weatherTick();
      }
      if (n >= 5) this.tickAcc = 0;

      this.entities.update(dt, w, p, env);
      if (this.state === 'playing') this._interact(dt);
      else { this.breaking = null; }
      if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3.5);
      if (this.equip > 0) this.equip = Math.max(0, this.equip - dt * 5);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);

      // caricamento chunk e mesh
      w.updateLoading(p.x, p.z, 5);
      this.renderer.updateMeshes(w, p, 6, { fancyLeaves: this.settings.fancyLeaves });
      this.unloadTimer += dt;
      if (this.unloadTimer > 1) { this.unloadTimer = 0; w.unloadFar(p.x, p.z); }
      this.saveTimer += dt;
      if (this.saveTimer > 30) { this.saveTimer = 0; this.autosave(); }

      // particelle ambientali delle torce
      if ((this.frame & 3) === 0) this._ambientParticles();

      if (p.dead && this.state !== 'dead') this._die();

      this.ui.updateBars();
      this.ui.setFx(p.eyeInWater, p.eyeInLava, p.hurtTime);
      if (this.audio.setRain) this.audio.setRain(this._rainLevel() * this._rainExposure());

      if (this.showDebug) {
        this.debugTimer += dt;
        if (this.debugTimer > 0.25) { this.debugTimer = 0; this.ui.setDebug(this._debugText()); }
      }
    }

    _ambientParticles() {
      const p = this.player, w = this.world;
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(p.x + (this.rng() - 0.5) * 24), y = Math.floor(p.y + (this.rng() - 0.5) * 16), z = Math.floor(p.z + (this.rng() - 0.5) * 24);
        const b = w.getBlock(x, y, z);
        if (b === B.torch) {
          const m = w.getMeta(x, y, z);
          let ox = 0.5, oy = 0.7, oz = 0.5;
          if (m === 1) { ox = 0.28; oy = 0.9; } else if (m === 2) { ox = 0.72; oy = 0.9; } else if (m === 3) { oz = 0.28; oy = 0.9; } else if (m === 4) { oz = 0.72; oy = 0.9; }
          this.entities.flame(x + ox, y + oy, z + oz);
          if (this.rng() < 0.3) this.entities.smoke(x + ox, y + oy + 0.1, z + oz, 1, false);
        } else if (b === B.lava && !w.getBlock(x, y + 1, z) && this.rng() < 0.1) {
          this.entities.addParticle(x + this.rng(), y + 1, z + this.rng(), (this.rng() - 0.5) * 2, 3 + this.rng() * 2, (this.rng() - 0.5) * 2, MC.textures.index.white, [1, 0.5, 0.1], 1.2, 0.05, 12, true);
        }
      }
    }

    // ---------------- Meteo ----------------
    _weatherTick() {
      this.weatherTimer--;
      if (this.weatherTimer <= 0) {
        this.rainTarget = this.rainTarget ? 0 : (this.rng() < 0.5 ? 1 : 0);
        this.weatherTimer = 6000 + Math.floor(this.rng() * 12000);
      }
      this.rain += (this.rainTarget - this.rain) * 0.004;
    }
    _rainLevel() { return this.settings.weather ? this.rain : 0; }
    _rainExposure() {
      const p = this.player, w = this.world;
      const sky = w.getSky(Math.floor(p.x), Math.floor(p.y + 1.6), Math.floor(p.z));
      const b = w.biomeAt(Math.floor(p.x), Math.floor(p.z));
      if (b === MC.BI.DESERT || b === MC.BI.SAVANNA || b === MC.BI.BADLANDS) return 0;
      return sky >= 14 ? 1 : sky / 30;
    }

    // ---------------- Interazione ----------------
    _interact(dt) {
      const p = this.player, w = this.world;
      this.breakCd -= dt; this.useCd -= dt; this.attackCd -= dt;
      if (p.dead) return;
      const eye = p.eye, d = p.dir();
      const reach = p.mode === 'creative' ? 5 : 4.5;
      const hit = MC.raycast(w, eye[0], eye[1], eye[2], d[0], d[1], d[2], reach);
      const mh = this.entities.raycastMobs(eye[0], eye[1], eye[2], d[0], d[1], d[2], 3.5);
      const mobFirst = mh && (!hit || mh.t < hit.t);
      this.target = mobFirst ? null : hit;
      if (this.mouse.left) {
        if (mobFirst) {
          if (this.attackCd <= 0) {
            this.entities.hitMob(mh.mob, 4, p.x, p.z);
            this.attackCd = 0.45;
            this.swing = 1;
          }
          this.breaking = null;
        } else if (hit) {
          const def = MC.blocks[hit.id];
          if (p.mode === 'creative') {
            if (this.breakCd <= 0) { this.breakBlock(hit.x, hit.y, hit.z, false); this.breakCd = 0.25; this.swing = 1; }
          } else if (def.hardness >= 0) {
            if (!this.breaking || this.breaking.x !== hit.x || this.breaking.y !== hit.y || this.breaking.z !== hit.z || this.breaking.id !== hit.id) {
              this.breaking = { x: hit.x, y: hit.y, z: hit.z, id: hit.id, p: 0, t: 0 };
            }
            const b = this.breaking;
            const time = Math.max(0.05, def.hardness);
            b.p += dt / time;
            b.t -= dt;
            if (b.t <= 0) { b.t = 0.22; this.audio.hit(hit.id); this.entities.hitParticles(hit.id, hit.x, hit.y, hit.z, hit.n); this.swing = 1; }
            if (b.p >= 1) {
              this.breakBlock(hit.x, hit.y, hit.z, true);
              this.breaking = null;
              this.breakCd = 0.15;
            }
          }
        } else this.breaking = null;
      } else this.breaking = null;
      if (this.mouse.right && this.useCd <= 0) {
        this.useCd = 0.22;
        this._use(hit);
      }
    }

    breakBlock(x, y, z, drop) {
      const w = this.world;
      const id = w.getBlock(x, y, z);
      if (!id) return;
      const def = MC.blocks[id];
      w.urgent = true;
      if (id === B.ice && this.player.mode === 'survival' && SOLID[w.getBlock(x, y - 1, z)] !== undefined && w.getBlock(x, y - 1, z) !== 0) w.setBlock(x, y, z, B.water, 0);
      else w.setBlock(x, y, z, 0, 0);
      w.urgent = false;
      this.entities.breakParticles(id, x, y, z);
      this.audio.dig(id);
      if (drop && this.player.mode === 'survival' && def.drop) this.entities.dropItem(def.drop, 1, x + 0.5, y + 0.4, z + 0.5);
    }

    _naturalDrop(id, x, y, z) {
      this.entities.breakParticles(id, x, y, z, 10);
      const def = MC.blocks[id];
      if (this.player.mode === 'survival' && def && def.drop) this.entities.dropItem(def.drop, 1, x + 0.5, y + 0.3, z + 0.5);
    }

    _use(hit) {
      const w = this.world, p = this.player;
      if (!hit) return;
      const def = MC.blocks[hit.id];
      if (!p.sneaking) {
        if (def.interact === 'craft') { this.swing = 1; this.openInventory(hit.id === B.furnace ? 'furnace' : 'table'); return; }
        if (hit.id === B.tnt) {
          w.urgent = true; w.setBlock(hit.x, hit.y, hit.z, 0, 0); w.urgent = false;
          this.entities.primeTNT(hit.x, hit.y, hit.z, 4);
          this.audio.fuse();
          this.swing = 1;
          return;
        }
      }
      const held = this.inventory.held();
      if (!held) return;
      if (this._place(held.id, hit)) {
        this.swing = 1;
        if (p.mode === 'survival') this.inventory.consumeHeld(1);
      }
    }

    _place(id, hit) {
      const w = this.world, p = this.player;
      const hd = MC.blocks[id];
      const n = hit.n;
      let tx = hit.x, ty = hit.y, tz = hit.z;
      const cur = w.getBlock(tx, ty, tz);
      const inPlace = REPLACEABLE[cur] && !FLUID[cur] && cur !== id;
      if (!inPlace) { tx += n[0]; ty += n[1]; tz += n[2]; }
      if (ty < 0 || ty >= WH) return false;
      const existing = w.getBlock(tx, ty, tz);
      if (!REPLACEABLE[existing] || existing === id) return false;
      if (FLUID[existing] && (hd.shape === 'cross' || hd.shape === 'torch')) return false;
      let meta = 0;
      if (hd.shape === 'torch') {
        if (inPlace || n[1] === 1) { if (!OPAQUE[w.getBlock(tx, ty - 1, tz)]) return false; meta = 0; }
        else if (n[1] === -1) { if (!OPAQUE[w.getBlock(tx, ty - 1, tz)]) return false; meta = 0; }
        else {
          if (!OPAQUE[hit.id]) return false;
          meta = n[0] === 1 ? 1 : n[0] === -1 ? 2 : n[2] === 1 ? 3 : 4;
        }
      }
      if (hd.support && !hd.support(w.getBlock(tx, ty - 1, tz))) return false;
      if (hd.shape === 'cactus') {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (SOLID[w.getBlock(tx + dx, ty, tz + dz)]) return false;
      }
      if (hd.axis) meta = n[0] ? 1 : n[2] ? 2 : 0;
      if (hd.facing) {
        const d = p.dir();
        meta = Math.abs(d[0]) > Math.abs(d[2]) ? (d[0] > 0 ? 1 : 0) : (d[2] > 0 ? 5 : 4);
      }
      if (SOLID[id]) {
        const cb = MC.getCollisionBox(id);
        const bx0 = tx + cb[0], by0 = ty + cb[1], bz0 = tz + cb[2], bx1 = tx + cb[3], by1 = ty + cb[4], bz1 = tz + cb[5];
        const pb = p.bbox();
        if (pb[3] > bx0 && pb[0] < bx1 && pb[4] > by0 && pb[1] < by1 && pb[5] > bz0 && pb[2] < bz1) return false;
        for (const m of this.entities.mobs) {
          const hw = m.M.w / 2;
          if (m.x + hw > bx0 && m.x - hw < bx1 && m.y + m.M.h > by0 && m.y < by1 && m.z + hw > bz0 && m.z - hw < bz1) return false;
        }
      }
      w.urgent = true;
      const ok = w.setBlock(tx, ty, tz, id, meta);
      w.urgent = false;
      if (ok) this.audio.place(id);
      return ok;
    }

    pickBlock() {
      const hit = this.target;
      if (!hit) return;
      const id = hit.id;
      const inv = this.inventory;
      const hi = inv.slots.slice(0, 9).findIndex((s) => s && s.id === id);
      if (hi >= 0) { inv.selected = hi; this._selChanged(); return; }
      if (this.player.mode === 'creative') {
        let slot = inv.slots.slice(0, 9).findIndex((s) => !s);
        if (slot < 0) slot = inv.selected;
        inv.set(slot, { id, count: 64 });
        inv.selected = slot;
      } else {
        const mi = inv.slots.findIndex((s, i) => i >= 9 && s && s.id === id);
        if (mi < 0) return;
        const a = inv.slots[inv.selected];
        inv.slots[inv.selected] = inv.slots[mi];
        inv.slots[mi] = a;
        inv._ch();
      }
      this._selChanged();
    }

    dropHeld(all) {
      const s = this.inventory.held();
      if (!s) return;
      const n = all ? s.count : 1;
      this.throwStack(s.id, n);
      if (this.player.mode === 'survival') this.inventory.consumeHeld(n);
      this.swing = 1;
    }

    throwStack(id, n) {
      const p = this.player, d = p.dir();
      const e = p.eye;
      this.entities.dropItem(id, n, e[0] + d[0] * 0.3, e[1] - 0.3, e[2] + d[2] * 0.3, d[0] * 6 + p.vx, d[1] * 6 + 2, d[2] * 6 + p.vz, 1.2);
    }

    // ---------------- Esplosioni ----------------
    explode(x, y, z, power) {
      const w = this.world, p = this.player;
      const r = Math.ceil(power);
      w.urgent = true;
      const survival = p.mode === 'survival';
      for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > power * (0.75 + this.rng() * 0.35)) continue;
        const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
        if (by < 0 || by >= WH) continue;
        const b = w.getBlock(bx, by, bz);
        if (!b) continue;
        const def = MC.blocks[b];
        if (def.blast >= 100 && !def.explosive) continue;
        if (def.blast >= 6 && d > power * 0.6 && this.rng() < 0.5) continue;
        if (b === B.tnt) { w.setBlock(bx, by, bz, 0, 0); this.entities.primeTNT(bx, by, bz, 0.4 + this.rng() * 0.8); continue; }
        w.setBlock(bx, by, bz, 0, 0);
        if (survival && def.drop && this.rng() < 0.3) this.entities.dropItem(def.drop, 1, bx + 0.5, by + 0.5, bz + 0.5);
      }
      w.urgent = false;
      this.entities.smoke(x, y, z, 45, true);
      for (let i = 0; i < 20; i++) this.entities.flame(x + (this.rng() - 0.5) * 3, y + (this.rng() - 0.5) * 3, z + (this.rng() - 0.5) * 3);
      const pd = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
      this.audio.explode(pd);
      this.shake = Math.max(this.shake, Math.max(0, 1 - pd / 30));
      if (pd < power * 2) {
        const k = 1 - pd / (power * 2);
        const nx = (p.x - x) / (pd || 1), nz = (p.z - z) / (pd || 1);
        p.vx += nx * 14 * k; p.vz += nz * 14 * k; p.vy += 9 * k;
        p.damage(Math.floor(k * 22), 'explosion');
      }
      for (const m of this.entities.mobs) {
        const md = Math.hypot(m.x - x, m.y + 0.5 - y, m.z - z);
        if (md < power * 2) {
          const k = 1 - md / (power * 2);
          m.vx += ((m.x - x) / (md || 1)) * 12 * k; m.vz += ((m.z - z) / (md || 1)) * 12 * k; m.vy += 8 * k;
          m.hp -= k * 20; m.hurt = 0.5;
          if (m.hp <= 0 && !m.dead) m.dead = 0.001;
        }
      }
      // gli oggetti vengono spinti via
      for (const it of this.entities.items) {
        const id2 = Math.hypot(it.x - x, it.y - y, it.z - z);
        if (id2 < power * 2) { const k = 1 - id2 / (power * 2); it.vx += ((it.x - x) / (id2 || 1)) * 10 * k; it.vy += 6 * k; it.vz += ((it.z - z) / (id2 || 1)) * 10 * k; }
      }
    }

    // ---------------- Morte ----------------
    _die() {
      this.state = 'dead';
      this.keys.clear(); this.mouse.left = this.mouse.right = false;
      this.unlockPointer();
      const p = this.player;
      // perde l'inventario
      for (let i = 0; i < 36; i++) {
        const s = this.inventory.slots[i];
        if (s) this.entities.dropItem(s.id, s.count, p.x, p.y + 1, p.z, (this.rng() - 0.5) * 5, 3 + this.rng() * 3, (this.rng() - 0.5) * 5, 2);
      }
      this.inventory.slots = new Array(36).fill(null);
      this.inventory._ch();
      const msgs = { fall: 'Sei caduto da troppo in alto', drown: 'Sei annegato', lava: 'Hai provato a nuotare nella lava', explosion: 'Sei saltato in aria', zombie: 'Sei stato ucciso da uno zombie', cactus: 'Sei stato punto a morte', void: 'Sei caduto fuori dal mondo', kill: 'Sei morto' };
      this.ui.showDeath(msgs[this.lastHurt] || 'Sei morto');
      document.getElementById('click-to-play').classList.add('hidden');
    }

    respawn() {
      const p = this.player;
      p.dead = false; p.health = 20; p.air = 300; p.vx = p.vy = p.vz = 0; p.fallDist = 0; p.hurtTime = 0; p.flying = false;
      p.x = this.meta.spawn.x; p.z = this.meta.spawn.z; p.y = 150;
      this.pendingSpawn = true;
      this.ui.hideScreens();
      this.state = 'playing';
      this.lockPointer();
    }

    // ---------------- Comandi ----------------
    command(text) {
      const p = this.player;
      if (text[0] !== '/') { this.ui.chat('<Tu> ' + text); return; }
      const a = text.slice(1).split(/\s+/);
      const cmd = (a[0] || '').toLowerCase();
      const say = (m) => this.ui.chat(m);
      switch (cmd) {
        case 'time': {
          const v = (a[2] || a[1] || '').toLowerCase();
          const map = { day: 1000, giorno: 1000, noon: 6000, mezzogiorno: 6000, night: 13000, notte: 13000, midnight: 18000, mezzanotte: 18000, sunset: 12000, tramonto: 12000, sunrise: 23500, alba: 23500 };
          let t = map[v] !== undefined ? map[v] : parseInt(v, 10);
          if (isNaN(t)) { say('Uso: /time set day|night|noon|<numero>'); return; }
          if (a[1] === 'add') this.time += t; else this.time = Math.floor(this.time / 24000) * 24000 + t;
          say('Ora impostata a ' + t);
          break;
        }
        case 'gamemode': case 'gm': {
          const v = (a[1] || '').toLowerCase();
          const m = ['creative', 'c', '1', 'creativa'].includes(v) ? 'creative' : ['survival', 's', '0', 'sopravvivenza'].includes(v) ? 'survival' : null;
          if (!m) { say('Uso: /gamemode creative|survival'); return; }
          p.mode = m; if (m === 'survival') p.flying = false;
          this.meta.mode = m;
          this.ui._lastBars = null;
          this.ui.hotEls && this.ui.hotEls.forEach((e) => { e.n = -1; });
          this.ui.updateHotbar();
          say('Modalità: ' + (m === 'creative' ? 'Creativa' : 'Sopravvivenza'));
          break;
        }
        case 'tp': {
          const rel = (s, base) => (s && s[0] === '~' ? base + (parseFloat(s.slice(1)) || 0) : parseFloat(s));
          const x = rel(a[1], p.x), y = rel(a[2], p.y), z = rel(a[3], p.z);
          if ([x, y, z].some((v) => isNaN(v))) { say('Uso: /tp x y z (anche ~ relativo)'); return; }
          p.x = x; p.y = Math.max(1, Math.min(WH + 20, y)); p.z = z; p.vx = p.vy = p.vz = 0;
          say('Teletrasportato a ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + z.toFixed(1));
          break;
        }
        case 'seed': say('Seme: ' + this.meta.seedText + ' (' + this.meta.seed + ')'); break;
        case 'weather': {
          const v = (a[1] || '').toLowerCase();
          if (v === 'rain' || v === 'pioggia') { this.rainTarget = 1; this.weatherTimer = 12000; say('Arriva la pioggia'); }
          else if (v === 'clear' || v === 'sereno') { this.rainTarget = 0; this.weatherTimer = 12000; say('Cielo sereno'); }
          else say('Uso: /weather clear|rain');
          break;
        }
        case 'give': {
          const q = (a[1] || '').toLowerCase();
          const n = Math.max(1, Math.min(640, parseInt(a[2], 10) || 64));
          let id = B[q];
          if (id === undefined) { const d = MC.blocks.find((b) => b.name.toLowerCase() === q.replace(/_/g, ' ') || b.name.toLowerCase().includes(q.replace(/_/g, ' '))); if (d) id = d.id; }
          if (!id) { say('Blocco sconosciuto: ' + q); return; }
          const left = this.inventory.add(id, n);
          say('Dati ' + (n - left) + ' × ' + MC.blocks[id].name);
          break;
        }
        case 'spawn': case 'summon': {
          const t = (a[1] || '').toLowerCase();
          if (!MC.MOB_MODELS[t]) { say('Creature: pig, cow, sheep, chicken, zombie'); return; }
          const d = p.dir();
          this.entities.spawnMob(t, p.x + d[0] * 3, p.y + 0.5, p.z + d[2] * 3);
          say('Evocato: ' + t);
          break;
        }
        case 'kill': if (p.mode === 'survival') { this.lastHurt = 'kill'; p.health = 0; p.dead = true; } else say('Solo in sopravvivenza'); break;
        case 'help': case 'aiuto':
          say('/time set day|night · /gamemode creative|survival · /tp x y z · /seed · /weather clear|rain · /give blocco n · /spawn creatura · /kill');
          break;
        default: say('Comando sconosciuto. Scrivi /help');
      }
    }

    _debugText() {
      const p = this.player, w = this.world, r = this.renderer;
      const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
      const yawDeg = ((((-p.yaw * 180) / Math.PI) % 360) + 360) % 360;
      const dirs = ['Nord (-Z)', 'Est (+X)', 'Sud (+Z)', 'Ovest (-X)'];
      const facing = dirs[Math.round(yawDeg / 90) % 4];
      const b = w.biomeAt(bx, bz);
      const t = this.target;
      const tod = Math.floor(((this.time + 6000) % 24000) / 1000);
      const mins = Math.floor((((this.time + 6000) % 1000) / 1000) * 60);
      return [
        'BlockCraft  ' + this.fps + ' fps',
        'XYZ: ' + p.x.toFixed(2) + ' / ' + p.y.toFixed(2) + ' / ' + p.z.toFixed(2),
        'Blocco: ' + bx + ' ' + by + ' ' + bz + '   Chunk: ' + (bx >> 4) + ' ' + (bz >> 4),
        'Direzione: ' + facing + '  (' + yawDeg.toFixed(0) + '°, ' + ((p.pitch * 180) / Math.PI).toFixed(0) + '°)',
        'Bioma: ' + (MC.BIOMES[b] ? MC.BIOMES[b].name : '?'),
        'Luce: cielo ' + w.getSky(bx, Math.floor(p.y + 1), bz) + '  blocchi ' + w.getBlockLight(bx, Math.floor(p.y + 1), bz),
        'Ora: ' + String(tod).padStart(2, '0') + ':' + String(mins).padStart(2, '0') + '  (tick ' + Math.floor(this.time % 24000) + ')  pioggia ' + (this._rainLevel() * 100).toFixed(0) + '%',
        'Chunk caricati: ' + w.chunks.size + '  sezioni visibili: ' + r.stats.sections + '  triangoli: ' + Math.round(r.stats.tris / 1000) + 'k',
        'Entità: ' + this.entities.mobs.length + ' creature, ' + this.entities.items.length + ' oggetti, ' + this.entities.particles.length + ' particelle',
        'Aggiornamenti in coda: ' + w.updates.size,
        'Seme: ' + this.meta.seedText,
        t ? 'Mira: ' + MC.blocks[t.id].name + ' @ ' + t.x + ' ' + t.y + ' ' + t.z : 'Mira: -',
      ].join('\n');
    }

    // ---------------- Disegno ----------------
    _render(dt, tsec) {
      const r = this.renderer, gl = r.gl, p = this.player, w = this.world;
      r.renderScale = this.settings.scale / 100;
      r.resize();
      const env = this.env || r.computeEnv(this.time, p.eyeInWater, p.eyeInLava, w.renderDist, this._rainLevel());
      const bobA = this.settings.bob ? p.bobAmt : 0;
      const bx = Math.sin(p.bob * Math.PI) * 0.04 * bobA, by = -Math.abs(Math.cos(p.bob * Math.PI)) * 0.06 * bobA;
      const e = p.eye;
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const sh = this.shake * 0.25;
      const cam = {
        x: e[0] + rx * bx + (this.rng() - 0.5) * sh, y: e[1] + by + (this.rng() - 0.5) * sh, z: e[2] + rz * bx + (this.rng() - 0.5) * sh,
        yaw: p.yaw, pitch: p.pitch,
        roll: Math.sin(p.bob * Math.PI) * 0.008 * bobA + (p.hurtTime > 0 ? Math.sin(p.hurtTime * 12) * 0.06 : 0),
        fov: this.settings.fov * p.fovMod,
        brightness: this.settings.bright / 100,
      };
      gl.clearColor(env.fogCol[0], env.fogCol[1], env.fogCol[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      r.setupCamera(cam);
      r.drawSky(env);
      r.drawWorld(w, env, cam, tsec);
      this.entities.render(r, env, cam, w, tsec);

      // crepe di rottura
      if (this.breaking && this.target) {
        const st = Math.min(9, Math.floor(this.breaking.p * 10));
        const bx0 = this.target.box;
        const M = mat4.translate(mat4.create(), -cam.x, -cam.y, -cam.z);
        r.batch.box(M, bx0[0] - 0.002, bx0[1] - 0.002, bx0[2] - 0.002, bx0[3] + 0.002, bx0[4] + 0.002, bx0[5] + 0.002, MC.textures.index['destroy_' + st], 1, [1, 1, 1, 0.9]);
        r.beginEnt(env);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(-1, -1);
        gl.depthMask(false);
        r.batch.flush();
        gl.depthMask(true);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.disable(gl.BLEND);
      }

      r.drawTranslucent(env, cam, tsec);
      if (this.settings.clouds) r.drawClouds(env, cam, tsec);
      this._renderWeather(env, cam, tsec);
      if (this.target && this.state !== 'dead' && !this.hudHidden) r.drawSelection(this.target.box, cam);
      if (!this.hudHidden && this.state !== 'dead') this._renderHand(env, cam, dt);
    }

    _renderWeather(env, cam, tsec) {
      const rain = this._rainLevel();
      if (rain < 0.02) return;
      const r = this.renderer, gl = r.gl, w = this.world;
      const bt = r.batchT;
      const now = performance.now();
      if (now - this.rainCacheT > 500) { this.rainCache.clear(); this.rainCacheT = now; }
      const R = 10;
      const cx = Math.floor(cam.x), cz = Math.floor(cam.z);
      const L = MC.textures.index.white;
      const count = Math.floor(rain * 2);
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > R * R) continue;
        const x = cx + dx, z = cz + dz;
        const key = x * 73856093 ^ z * 19349663;
        let info = this.rainCache.get(key);
        if (!info) {
          const top = w.topSolid(x, z);
          const b = w.biomeAt(x, z);
          const dry = b === MC.BI.DESERT || b === MC.BI.SAVANNA || b === MC.BI.BADLANDS;
          const snow = b === MC.BI.SNOWY_PLAINS || b === MC.BI.SNOWY_TAIGA || b === MC.BI.PEAKS || b === MC.BI.FROZEN_OCEAN || top > MC.SEA + 85;
          info = { top, dry, snow };
          this.rainCache.set(key, info);
        }
        if (info.dry) continue;
        const h = MC.util.hash2(99, x, z);
        for (let k = 0; k < count; k++) {
          const hk = (h * (k + 1) * 7.13) % 1;
          const speed = info.snow ? 2.5 : 16 + hk * 6;
          const span = 24;
          const yy = cam.y + 12 - ((tsec * speed + hk * span) % span);
          if (yy < info.top + 1) continue;
          const ox = x + 0.2 + hk * 0.6 + (info.snow ? Math.sin(tsec + hk * 10) * 0.3 : 0), oz = z + 0.3 + ((hk * 13.7) % 1) * 0.5;
          const px = ox - cam.x, py = yy - cam.y, pz = oz - cam.z;
          const dist = Math.hypot(px, pz);
          if (dist < 0.8) continue;
          const l = MC.lightAt(w, ox, Math.max(yy, info.top + 1), oz, env);
          // quad rivolto verso la camera (asse verticale)
          const nx = -pz / (dist || 1) * (info.snow ? 0.06 : 0.02), nz = px / (dist || 1) * (info.snow ? 0.06 : 0.02);
          const hh = info.snow ? 0.06 : 0.7;
          const col = info.snow ? [l, l, l, 0.9] : [0.55 * l, 0.62 * l, 0.8 * l, 0.45];
          bt.quad([px - nx, py - hh, pz - nz, px + nx, py - hh, pz + nz, px + nx, py + hh, pz + nz, px - nx, py + hh, pz - nz], 0, 0, 1, 1, L, col[0], col[1], col[2], col[3]);
        }
      }
      r.beginEnt(env);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      bt.flush();
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
    }

    _renderHand(env, cam, dt) {
      const r = this.renderer, gl = r.gl, p = this.player, w = this.world;
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const aspect = r.canvas.width / r.canvas.height;
      const proj = mat4.perspective(mat4.create(), (70 * Math.PI) / 180, aspect, 0.01, 10);
      const l = MC.lightAt(w, p.x, p.y + 1.6, p.z, env);
      const held = this.inventory.held();
      const s = this.swing;
      const sp = Math.sin((1 - s) * Math.PI) * (s > 0 ? 1 : 0);
      const bobA = this.settings.bob ? p.bobAmt : 0;
      const hx = Math.sin(p.bob * Math.PI) * 0.03 * bobA, hy = -Math.abs(Math.cos(p.bob * Math.PI)) * 0.03 * bobA;
      const M = mat4.create();
      const T = mat4.create();
      const drop = this.equip * 0.4;
      mat4.translate(M, 0.56 + hx - sp * 0.25, -0.58 + hy - drop + sp * 0.15, -0.9 - sp * 0.2);
      mat4.rotY(T, -0.72 + sp * 0.5); mat4.mul(M, M, T);
      mat4.rotX(T, -sp * 0.9); mat4.mul(M, M, T);
      mat4.rotZ(T, sp * 0.3); mat4.mul(M, M, T);
      const hEnv = { fogCol: env.fogCol, fog: [100, 200] };
      if (held) {
        const d = MC.blocks[held.id];
        if (d.shape === 'cross' || d.shape === 'torch') {
          mat4.rotY(T, 0.72); mat4.mul(M, M, T);
          MC.drawItemModel(r.batch, M, held.id, 0.55, l);
        } else {
          mat4.translate(T, 0, -0.1, 0); mat4.mul(M, M, T);
          MC.drawItemModel(r.batch, M, held.id, 0.42, l);
        }
      } else {
        // braccio
        mat4.rotX(T, 1.1); mat4.mul(M, M, T);
        const L = MC.textures.index.white;
        r.batch.box(M, -0.1, -0.7, -0.1, 0.1, 0.1, 0.1, L, l, [0.93, 0.72, 0.58, 1]);
      }
      r.beginEnt(hEnv, mat4.mul(mat4.create(), proj, mat4.create()));
      gl.disable(gl.CULL_FACE);
      r.batch.flush();
      gl.enable(gl.CULL_FACE);
    }
  }

  // Avvio
  function boot() {
    try { MC.game = new Game(); } catch (e) {
      console.error(e);
      const eb = document.getElementById('error-box');
      if (eb) { eb.classList.remove('hidden'); document.getElementById('error-msg').textContent = e.message; }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
