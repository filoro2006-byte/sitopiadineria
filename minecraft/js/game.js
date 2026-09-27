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
    fancyLeaves: true, clouds: true, bob: true, mobs: true, invert: false, weather: true, autoJump: true, shaderLevel: 2, shadows: true,
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
      this.player.reduceDamage = (a, cause) => MC.enchant.reduce(this.inventory, a, cause, Math.random);
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
      this.touchMode = false;
      this.touch = new MC.Touch(this);
      if (MC.Touch.isTouchDevice()) this.touch.enable();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
      this.start();
    }

    // ---------------- Impostazioni ----------------
    _loadSettings() {
      let s = {};
      let raw = null;
      try { raw = localStorage.getItem('blockcraft-settings'); s = JSON.parse(raw || '{}') || {}; } catch (e) { s = {}; }
      const base = Object.assign({}, DEFAULTS);
      if (!raw && MC.Touch && MC.Touch.isTouchDevice()) { base.renderDist = 5; base.scale = 75; base.fancyLeaves = false; base.shaderLevel = 0; base.shadows = false; }
      if (s.shaders !== undefined && s.shaderLevel === undefined) s.shaderLevel = s.shaders ? 2 : 0;
      return Object.assign(base, s);
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
      document.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
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
      if (this.touchMode) { document.getElementById('click-to-play').classList.add('hidden'); return; }
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
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F3', 'F5', 'Tab', 'Slash', 'Quote'].includes(c) && this.world) e.preventDefault();
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
        if (c === 'F5' || c === 'KeyV') this.cycleView();
        if (c === 'Escape' && !this.locked) this.pause();
      } else if (this.state === 'inventory') {
        if (c === 'KeyE' || c === 'Escape') { e.preventDefault(); this.closeInventory(); }
        else if (c.startsWith('Digit') && c !== 'Digit0') this.ui.numberKey(+c.slice(5) - 1);
      } else if (this.state === 'trade') {
        if (c === 'KeyE' || c === 'Escape') { e.preventDefault(); this.closeTrade(); }
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

    // anteprima del personaggio nell'inventario, nella pausa e nel menu (la testa segue il mouse)
    _renderPreviews(tsec) {
      let id = null;
      if (this.state === 'menu') id = 'menu-player';
      else if (this.state === 'paused') id = 'pause-player';
      else if (this.state === 'inventory' && !this.ui.chest && !this.ui.enchant) id = 'inv-player';
      if (!id) return;
      const cv = document.getElementById(id);
      if (!cv || !cv.offsetParent) return;
      const rect = cv.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(rect.width * dpr), H = Math.round(rect.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; cv._img = null; }
      const D = MC.mobs.DEFS.player;
      const pm = this._pvMob || (this._pvMob = { type: 'player', D, M: D, isPlayer: true, parts: MC.mobs.models.player, skin: 1000 + MC.mobs.skinIndex['player:default'], x: 0, y: 0, z: 0, walk: 0, walkAmt: 0, hurt: 0, dead: 0, swing: 0, fullBright: 1, bodyYaw: Math.PI, headYaw: 0, headPitch: 0 });
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height * 0.2;
      const mx = this.mouseX === undefined ? cx : this.mouseX, my = this.mouseY === undefined ? cy : this.mouseY;
      const ax = Math.atan((mx - cx) / 40), ay = Math.atan((my - cy) / 40);
      pm.bodyYaw = Math.PI + ax * 0.25;
      pm.headYaw = ax * 0.4;
      pm.headPitch = -ay * 0.3;
      pm.walk = tsec * 0.6; pm.walkAmt = 0.06;
      const inv = this.inventory;
      pm.held = this.world ? inv.held() : null;
      pm.armor = inv.armor.map((x) => (x ? x.id : 0));
      pm.armorEnch = inv.armor.map((x) => !!(x && x.ench));
      const r = this.renderer;
      const env = { fogCol: [0, 0, 0], fog: [1000, 2000] };
      const proj = mat4.perspective(mat4.create(), (30 * Math.PI) / 180, W / H, 0.1, 50);
      const view = mat4.translate(mat4.create(), 0, -0.95, -5.1);
      const vp = mat4.mul(mat4.create(), proj, view);
      const px = r.renderToPixels(W, H, () => {
        this.entities.renderMobs(r.batch, env, { x: 0, y: 0, z: 0 }, this.world, tsec, [pm]);
        r.beginEnt(env, vp);
        r.batch.flush();
      });
      const ctx = cv.getContext('2d');
      if (!cv._img) cv._img = ctx.createImageData(W, H);
      const d = cv._img.data, row = W * 4;
      for (let y = 0; y < H; y++) d.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      ctx.putImageData(cv._img, 0, 0);
    }

    cycleView() {
      this.thirdPerson = ((this.thirdPerson || 0) + 1) % 3;
      this.ui.chat(['Visuale in prima persona', 'Visuale in terza persona (da dietro)', 'Visuale in terza persona (di fronte)'][this.thirdPerson]);
    }

    // modello del giocatore per la visuale in terza persona
    _updatePlayerModel(dt) {
      const p = this.player, en = this.entities;
      if (!this.thirdPerson || p.dead) { en.playerMob = null; return; }
      let pm = en.playerMob;
      if (!pm) {
        const D = MC.mobs.DEFS.player;
        pm = en.playerMob = { type: 'player', D, M: D, isPlayer: true, parts: MC.mobs.models.player, skin: 1000 + MC.mobs.skinIndex['player:default'], bodyYaw: p.yaw, headYaw: 0, headPitch: 0, walk: 0, walkAmt: 0, hurt: 0, dead: 0, swing: 0 };
      }
      pm.x = p.x; pm.y = p.y - (p.sneaking ? 0.15 : 0); pm.z = p.z;
      let dy = p.yaw - pm.bodyYaw;
      while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      const moving = Math.hypot(p.vx, p.vz) > 0.5;
      if (moving || Math.abs(dy) > 0.9) pm.bodyYaw += dy * Math.min(1, dt * (moving ? 10 : 4));
      dy = p.yaw - pm.bodyYaw;
      while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      pm.headYaw = Math.max(-1.2, Math.min(1.2, dy));
      pm.headPitch = -p.pitch;
      pm.walk = p.bob * 1.1; pm.walkAmt = p.onGround ? p.bobAmt : 0.2;
      pm.swing = this.swing > 0 ? this.swing * 0.314 : 0;
      pm.hurt = p.hurtTime > 0 ? p.hurtTime : 0;
      pm.held = this.inventory.held();
      const a = this.inventory.armor;
      pm.armor = a.map((x) => (x ? x.id : 0));
      pm.armorEnch = a.map((x) => !!(x && x.ench));
      pm.onFire = p.fire > 0 ? p.fire : 0;
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
      this.ui.setLoadingTitle(meta.dim === 'nether' ? 'Entrando nel Nether...' : 'Generazione del mondo...');
      this.ui.setLoading(0, 'Lettura dei salvataggi...');
      this.meta = meta;
      this.dim = meta.dim || 'overworld';
      await this._createDimWorld();
      const w = this.world;
      const p = this.player;
      p.mode = meta.mode;
      p.dead = false; p.vx = p.vy = p.vz = 0; p.fallDist = 0; p.hurtTime = 0;
      p.air = 300;
      if (!meta.spawn) {
        const g = this.dim === 'overworld' ? w.gen : new MC.Generator(meta.seed, meta.type);
        const sp = g.findSpawn();
        meta.spawn = { x: sp.x + 0.5, z: sp.z + 0.5 };
      }
      if (meta.player) {
        const s = meta.player;
        p.x = s.x; p.y = s.y; p.z = s.z; p.yaw = s.yaw || 0; p.pitch = s.pitch || 0;
        p.health = s.health === undefined ? 20 : s.health; p.flying = !!s.flying;
        p.xpLevel = s.xpLevel || 0; p.xp = s.xp || 0; p.xpSeed = s.xpSeed || ((Math.random() * 1e9) | 0);
        this.pendingSpawn = false;
      } else {
        p.x = meta.spawn.x; p.z = meta.spawn.z; p.y = 150; p.yaw = 0; p.pitch = -0.2; p.health = 20; p.flying = false;
        p.xpLevel = 0; p.xp = 0; p.xpSeed = (Math.random() * 1e9) | 0;
        this.pendingSpawn = true;
      }
      this.chests = meta.chests || {};
      p.food = meta.player && meta.player.food !== undefined ? meta.player.food : 20;
      p.sat = meta.player && meta.player.sat !== undefined ? meta.player.sat : 5;
      p.exh = 0;
      if (meta.inventory) this.inventory.load(meta.inventory);
      else this._defaultInventory();
      this.time = meta.time || 1000;
      this.rain = meta.rain || 0; this.rainTarget = this.rain > 0.5 ? 1 : 0;
      this.breaking = null;
      this.portalTime = 0; this.portalCooldown = true; this.portalArrival = null;
      this.loadT0 = performance.now();
      this.applySettings();
      this.ui.buildHotbar();
      this.ui.updateHotbar();
    }

    // crea il mondo della dimensione attuale (i chunk del Nether sono salvati a parte)
    async _createDimWorld() {
      const meta = this.meta;
      const nether = this.dim === 'nether';
      const sid = nether ? meta.id + ':n' : meta.id;
      const saved = await this.storage.loadChunks(sid);
      const type = nether ? 'nether' : meta.type;
      const w = new MC.World({ seed: meta.seed, type, saved, renderDist: this.settings.renderDist });
      w.onSaveChunk = (k, data) => this.storage.saveChunk(sid, k, data);
      w.onUnload = (c) => this.renderer.freeChunk(c);
      w.onDrop = (id, x, y, z) => this._naturalDrop(id, x, y, z);
      const tw = await MC.createTerrainWorker(meta.seed, type);
      if (tw) w.attachWorker(tw);
      this.world = w;
      this.entities.clear();
      this.entities.pendingPets = ((meta.pets && meta.pets[this.dim]) || []).slice();
      this.player.frozen = true;
      this.netherFog = null;
    }

    // passaggio tra Mondo normale e Nether
    async switchDim(dim, x, y, z, viaPortal) {
      if (this.switching) return;
      this.switching = true;
      const p = this.player;
      this.autosave();
      if (this.world) { for (const c of this.world.chunks.values()) this.renderer.freeChunk(c); this.world.destroy(); }
      this.world = null;
      this.dim = dim;
      this.meta.dim = dim;
      this.state = 'loading';
      this.keys.clear(); this.mouse.left = this.mouse.right = false;
      this.unlockPointer();
      document.getElementById('click-to-play').classList.add('hidden');
      this.ui.show('screen-loading');
      this.ui.setLoadingTitle(dim === 'nether' ? 'Entrando nel Nether...' : 'Ritorno al mondo normale...');
      this.ui.setLoading(0, '');
      await this.storage.flush();
      await this._createDimWorld();
      p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.fallDist = 0;
      this.portalArrival = viaPortal ? { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) } : null;
      this.portalTime = 0; this.portalCooldown = true;
      this.breaking = null;
      this.loadT0 = performance.now();
      this.applySettings();
      this.switching = false;
      this.audio.portal && this.audio.portal(true);
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

    // orienta la visuale verso la direzione più aperta
    _faceOpen() {
      const w = this.world, p = this.player;
      let best = 0, bestD = -1;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const dx = -Math.sin(a), dz = -Math.cos(a);
        let d = 0;
        for (; d < 40; d++) {
          const x = Math.floor(p.x + dx * d), z = Math.floor(p.z + dz * d);
          if (SOLID[w.getBlock(x, Math.floor(p.y + 1.6), z)] || SOLID[w.getBlock(x, Math.floor(p.y + 3), z)]) break;
        }
        if (d > bestD) { bestD = d; best = a; }
      }
      p.yaw = best; p.pitch = -0.08;
    }

    _placeAtSpawn() {
      const w = this.world, p = this.player;
      const sx = Math.floor(this.meta.spawn.x), sz = Math.floor(this.meta.spawn.z);
      for (let r = 0; r <= 10; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (!w.isReady(sx + dx, sz + dz)) continue;
          const y = this._findSafeY(sx + dx, sz + dz);
          if (y !== null) { p.x = sx + dx + 0.5; p.z = sz + dz + 0.5; p.y = y; p.vy = 0; this._faceOpen(); return true; }
        }
      }
      const y = w.topSolid(sx, sz);
      p.x = sx + 0.5; p.z = sz + 0.5; p.y = y + 1; p.vy = 0;
      return true;
    }

    saveMeta() {
      if (!this.meta || !this.world) return;
      const p = this.player;
      if (!this.pendingSpawn) this.meta.player = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, health: p.health, flying: p.flying, food: p.food, sat: p.sat, xpLevel: p.xpLevel || 0, xp: p.xp || 0, xpSeed: p.xpSeed || 0 };
      else if (this.meta.player) Object.assign(this.meta.player, { xpLevel: p.xpLevel || 0, xp: p.xp || 0 });
      this.meta.dim = this.dim;
      this.meta.chests = this.chests;
      if (this.entities && this.world) { this.meta.pets = this.meta.pets || {}; this.meta.pets[this.dim] = this.entities.petList(); }
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
      if (this.world) { for (const c of this.world.chunks.values()) this.renderer.freeChunk(c); this.world.destroy(); }
      this.world = null;
      this.meta = null;
      this.entities.clear();
      this.state = 'menu';
      this.touch.show(false);
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
      if (!this.world) { if (this.state === 'menu') this._renderPreviews(tsec); return; }
      if (this.state === 'loading') { this._loading(); return; }
      this._update(dt);
      if (this.world && this.state !== 'loading') { this._render(dt, tsec); this._renderPreviews(tsec); }
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
        if (this.portalArrival) { this._arrivePortal(); this.portalArrival = null; }
        else if (this.pendingSpawn) { this._placeAtSpawn(); this.pendingSpawn = false; }
        this.state = 'playing';
        this.ui.hideScreens();
        this.ui.showHUD(!this.hudHidden);
        this.ui.updateHotbar();
        this.ui.updateBars();
        if (!this.touchMode) document.getElementById('click-to-play').classList.remove('hidden');
        if (this.dim === 'nether') this.ui.chat('Sei nel Nether. Attento alla lava e ai ghast!');
        else if (this._welcomed !== this.meta.id) this.ui.chat(this.touchMode ? 'Benvenuto in ' + this.meta.name + '! Tocca per piazzare, tieni premuto per rompere.' : 'Benvenuto in ' + this.meta.name + '! Premi T per i comandi, E per l\'inventario.');
        this._welcomed = this.meta.id;
      }
    }

    _input() {
      if (this.state !== 'playing') return {};
      const k = this.keys;
      const t = this.touch && this.touch.active ? this.touch.input() : null;
      const cl = (v) => Math.max(-1, Math.min(1, v));
      const fw = cl(((k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0) - ((k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0) + (t ? t.fw : 0));
      const st = cl(((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0) + (t ? t.st : 0));
      return {
        fw, st,
        jump: k.has('Space'),
        sneak: k.has('ShiftLeft') || k.has('ShiftRight'),
        sprint: k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyR') || this.sprintTap || (t && t.fw > 0.97),
        autoJump: this.settings.autoJump,
      };
    }

    _update(dt) {
      const w = this.world, p = this.player;
      const simulate = this.state !== 'paused';
      if (!simulate) return;
      const env = this.renderer.computeEnv(this.time, p.eyeInWater, p.eyeInLava, w.renderDist, this._rainLevel(), this.dim === 'nether' ? this._netherFog(dt) : null);
      env.gamma = 0.15 + (this.settings.bright / 100) * 0.85;
      this.env = env;

      // attesa della rinascita/spawn
      if (this.pendingSpawn && w.isReady(p.x, p.z)) {
        const c = w.getChunk(Math.floor(p.x) >> 4, Math.floor(p.z) >> 4);
        if (c && !c.dirty.some((v) => v)) { this._placeAtSpawn(); this.pendingSpawn = false; }
      }
      p.frozen = this.pendingSpawn || !w.isReady(p.x, p.z);
      p.respiration = MC.enchant.enchLv(this.inventory.armor[0], 'respiration');
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
      if (this.world !== w) return; // cambio di dimensione in corso
      this._portalTick(dt);
      if (this.world !== w) return;
      if (this.state === 'playing') this._interact(dt);
      else { this.breaking = null; }
      if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3.5);
      if (this.equip > 0) this.equip = Math.max(0, this.equip - dt * 5);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);

      // caricamento chunk e mesh
      // budget adattivo: se il frame è lento, meno lavoro di caricamento
      this.ft = this.ft === undefined ? dt : this.ft * 0.9 + dt * 0.1;
      const slow = this.ft > 1 / 45;
      w.updateLoading(p.x, p.z, slow ? 1.5 : 3.5);
      this.renderer.updateMeshes(w, p, slow ? 2 : 4, { fancyLeaves: this.settings.fancyLeaves });
      this.unloadTimer += dt;
      if (this.unloadTimer > 1) { this.unloadTimer = 0; w.unloadFar(p.x, p.z); }
      this.saveTimer += dt;
      if (this.saveTimer > 30) { this.saveTimer = 0; this.autosave(); }

      // particelle ambientali delle torce
      if ((this.frame & 3) === 0) this._ambientParticles();

      if (p.dead && this.state !== 'dead') this._die();

      this.ui.updateBars();
      this.ui.setFx(p.eyeInWater, p.eyeInLava ? 1 : p.fire > 0 ? 0.3 : 0, p.hurtTime);
      if (p.fire > 0 && Math.random() < 0.5) this.entities.flame(p.x + (Math.random() - 0.5) * 0.6, p.y + Math.random() * 1.2, p.z + (Math.random() - 0.5) * 0.6);
      this.touch.show(this.state === 'playing' && !this.hudHidden);
      const eb = document.getElementById('eat-bar');
      const prog = this.eating ? this.eating.t / 1.6 : this.bowCharge > 0 ? this.bowCharge : 0;
      eb.classList.toggle('hidden', !prog);
      if (prog) eb.firstChild.style.width = Math.round(prog * 100) + '%';
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
    _rainLevel() { return this.settings.weather && this.dim !== 'nether' ? this.rain : 0; }

    // ---------------- Esperienza ----------------
    addXp(n) {
      const p = this.player;
      if (p.mode !== 'survival' && p.mode !== 'creative') return;
      p.xp = (p.xp || 0) + n;
      p.xpLevel = p.xpLevel || 0;
      let up = false;
      while (p.xp >= MC.enchant.xpNeed(p.xpLevel)) { p.xp -= MC.enchant.xpNeed(p.xpLevel); p.xpLevel++; up = true; }
      if (up && p.xpLevel % 5 === 0) this.audio.levelup && this.audio.levelup();
      this.ui.updateXp();
    }
    addXpLevels(n) {
      const p = this.player;
      p.xpLevel = Math.max(0, (p.xpLevel || 0) + n);
      if (n < 0) p.xp = Math.min(p.xp || 0, MC.enchant.xpNeed(p.xpLevel) - 1);
      this.ui.updateXp();
    }

    // ---------------- Incantesimi ----------------
    openEnchant(x, y, z) {
      // librerie attorno al tavolo (a distanza 2, con aria in mezzo)
      const w = this.world;
      let shelves = 0;
      for (let dy = 0; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue;
        if (w.getBlock(x + dx, y + dy, z + dz) !== B.bookshelf) continue;
        const mx = x + Math.sign(dx) * (Math.abs(dx) > 1 ? 1 : 0), mz = z + Math.sign(dz) * (Math.abs(dz) > 1 ? 1 : 0);
        if (w.getBlock(mx, y + dy, mz) === 0 || w.getBlock(mx, y, mz) === 0) shelves++;
      }
      shelves = Math.min(15, shelves);
      this.enchantShelves = shelves;
      this.state = 'inventory';
      this.keys.clear(); this.mouse.left = this.mouse.right = false;
      this.unlockPointer();
      document.getElementById('click-to-play').classList.add('hidden');
      this.ui.openInventory(null, null, { enchant: true, shelves });
    }
    applyEnchant(slotIdx) {
      const ui = this.ui, p = this.player;
      const st = ui.enchantSlots[0], lap = ui.enchantSlots[1];
      const opts = MC.enchant.options(p.xpSeed || 0, st, this.enchantShelves || 0);
      if (!opts) return false;
      const o = opts[slotIdx];
      const creative = p.mode === 'creative';
      if (!creative && ((p.xpLevel || 0) < o.cost || !lap || lap.id !== B.lapis || lap.count < o.lapis)) return false;
      st.ench = Object.assign({}, o.ench);
      if (!creative) {
        this.addXpLevels(-o.lapis);
        lap.count -= o.lapis;
        if (lap.count <= 0) ui.enchantSlots[1] = null;
      }
      p.xpSeed = (Math.random() * 1e9) | 0;
      this.audio.enchant && this.audio.enchant();
      return true;
    }

    // colore della nebbia del Nether secondo il bioma (con transizione morbida)
    _netherFog(dt) {
      const p = this.player;
      const FOG = { 19: [0.2, 0.03, 0.02], 20: [0.24, 0.02, 0.02], 21: [0.07, 0.03, 0.11], 22: [0.08, 0.2, 0.2], 23: [0.3, 0.26, 0.28] };
      const want = FOG[this.world.biomeAt(Math.floor(p.x), Math.floor(p.z))] || FOG[19];
      if (!this.netherFog) this.netherFog = want.slice();
      const k = Math.min(1, dt * 0.8);
      for (let i = 0; i < 3; i++) this.netherFog[i] += (want[i] - this.netherFog[i]) * k;
      return this.netherFog;
    }

    // ---------------- Portali ----------------
    _portalTick(dt) {
      const p = this.player, w = this.world;
      if (p.dead || this.state !== 'playing' && this.state !== 'inventory') { this.ui.setPortalFx(0); return; }
      const inP = (y) => w.getBlock(Math.floor(p.x), Math.floor(y), Math.floor(p.z)) === B.nether_portal;
      const inside = inP(p.y + 0.2) || inP(p.y + 1.2);
      if (!inside) { this.portalCooldown = false; this.portalTime = Math.max(0, this.portalTime - dt * 2); this.ui.setPortalFx(this.portalTime / 4); return; }
      if (this.portalCooldown) { this.ui.setPortalFx(0); return; }
      if (this.portalTime === 0) this.audio.portal && this.audio.portal(false);
      this.portalTime += dt;
      const need = p.mode === 'creative' ? 1 : 4;
      this.ui.setPortalFx(Math.min(1, this.portalTime / need));
      if (Math.random() < dt * 20) this.entities.addParticle(p.x + (Math.random() - 0.5) * 1.5, p.y + Math.random() * 2, p.z + (Math.random() - 0.5) * 1.5, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), MC.textures.index.white, [0.6, 0.2, 1], 0.8, 0.05, -0.2, true);
      if (this.portalTime >= need) {
        this.portalTime = 0;
        this.ui.setPortalFx(0);
        if (this.state === 'inventory') this.closeInventory();
        const toNether = this.dim !== 'nether';
        const f = toNether ? 1 / 8 : 8;
        const NH = MC.NH;
        const ty = toNether ? Math.max(34, Math.min(NH - 10, p.y)) : Math.max(MC.SEA, Math.min(WH - 10, p.y));
        this.switchDim(toNether ? 'nether' : 'overworld', p.x * f, ty, p.z * f, true);
      }
    }

    // accende un portale in una cornice di ossidiana; restituisce true se riuscito
    _tryLightPortal(x, y, z) {
      const w = this.world;
      if (w.getBlock(x, y, z) !== 0) return false;
      for (const axis of [0, 1]) {
        const ax = axis ? 0 : 1, az = axis ? 1 : 0;
        let by = y;
        while (by > y - 22 && w.getBlock(x, by - 1, z) === 0) by--;
        if (w.getBlock(x, by - 1, z) !== B.obsidian) continue;
        let x0 = x, z0 = z;
        let n = 0;
        while (n < 22 && w.getBlock(x0 - ax, by, z0 - az) === 0) { x0 -= ax; z0 -= az; n++; }
        if (w.getBlock(x0 - ax, by, z0 - az) !== B.obsidian) continue;
        let width = 1;
        while (width < 22 && w.getBlock(x0 + ax * width, by, z0 + az * width) === 0) width++;
        if (w.getBlock(x0 + ax * width, by, z0 + az * width) !== B.obsidian || width < 2 || width > 21) continue;
        let height = 1;
        while (height < 22 && w.getBlock(x0, by + height, z0) === 0) height++;
        if (w.getBlock(x0, by + height, z0) !== B.obsidian || height < 3 || height > 21) continue;
        let ok = true;
        for (let i = 0; i < width && ok; i++) {
          if (w.getBlock(x0 + ax * i, by - 1, z0 + az * i) !== B.obsidian || w.getBlock(x0 + ax * i, by + height, z0 + az * i) !== B.obsidian) ok = false;
          for (let j = 0; j < height && ok; j++) if (w.getBlock(x0 + ax * i, by + j, z0 + az * i) !== 0) ok = false;
        }
        for (let j = 0; j < height && ok; j++) {
          if (w.getBlock(x0 - ax, by + j, z0 - az) !== B.obsidian || w.getBlock(x0 + ax * width, by + j, z0 + az * width) !== B.obsidian) ok = false;
        }
        if (!ok) continue;
        w.urgent = true;
        for (let i = 0; i < width; i++) for (let j = 0; j < height; j++) w.setBlock(x0 + ax * i, by + j, z0 + az * i, B.nether_portal, axis, { noUpdate: true });
        w.urgent = false;
        this.audio.portal && this.audio.portal(true);
        return true;
      }
      return false;
    }

    // all'arrivo: usa un portale vicino oppure ne costruisce uno
    _arrivePortal() {
      const w = this.world, p = this.player, a = this.portalArrival;
      const nether = this.dim === 'nether';
      const top = nether ? MC.NH - 2 : WH - 2;
      let best = null, bd = 1e9;
      for (let dz = -20; dz <= 20; dz++) for (let dx = -20; dx <= 20; dx++) {
        const x = a.x + dx, z = a.z + dz;
        if (!w.isReady(x, z)) continue;
        for (let y = 1; y < top; y++) {
          if (w.getBlock(x, y, z) === B.nether_portal && w.getBlock(x, y - 1, z) !== B.nether_portal) {
            const d = dx * dx + dz * dz + (y - a.y) * (y - a.y) * 0.25;
            if (d < bd) { bd = d; best = [x, y, z]; }
          }
        }
      }
      if (!best) best = this._buildPortal(a.x, a.y, a.z);
      // esce davanti al portale (non dentro), guardando dalla parte opposta
      const ax = w.getMeta(best[0], best[1], best[2]) & 1;
      let px = best[0] + 0.5, pz = best[2] + 0.5, yaw = p.yaw;
      for (const sg of [1, -1]) {
        const cx = best[0] + (ax ? sg : 0), cz = best[2] + (ax ? 0 : sg);
        if (!SOLID[w.getBlock(cx, best[1], cz)] && !SOLID[w.getBlock(cx, best[1] + 1, cz)] && !FLUID[w.getBlock(cx, best[1], cz)]) {
          px = cx + 0.5; pz = cz + 0.5; yaw = ax ? (sg > 0 ? -Math.PI / 2 : Math.PI / 2) : (sg > 0 ? Math.PI : 0);
          break;
        }
      }
      p.x = px; p.y = best[1]; p.z = pz; p.yaw = yaw; p.pitch = 0; p.vx = p.vy = p.vz = 0; p.fallDist = 0;
      this.portalCooldown = true;
      this.pendingSpawn = false;
    }

    _buildPortal(x, y, z) {
      const w = this.world;
      const nether = this.dim === 'nether';
      const ymin = nether ? 33 : 2, ymax = nether ? MC.NH - 12 : WH - 8;
      const free = (bx, by, bz) => {
        for (let i = -1; i <= 2; i++) for (let j = 0; j <= 3; j++) for (let k = -1; k <= 1; k++) {
          const b = w.getBlock(bx + i, by + j, bz + k);
          if (b && !REPLACEABLE[b]) return false;
          if (FLUID[b]) return false;
        }
        for (let i = 0; i <= 1; i++) for (let k = -1; k <= 1; k++) if (!SOLID[w.getBlock(bx + i, by - 1, bz + k)]) return false;
        return true;
      };
      let spot = null;
      for (let r = 0; r <= 12 && !spot; r++) {
        for (let dz = -r; dz <= r && !spot; dz++) for (let dx = -r; dx <= r && !spot; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          for (let dy = 0; dy <= 24 && !spot; dy++) {
            for (const sg of [1, -1]) {
              const yy = y + dy * sg;
              if (yy < ymin || yy > ymax) continue;
              if (free(x + dx, yy, z + dz)) { spot = [x + dx, yy, z + dz]; break; }
            }
          }
        }
      }
      let forced = false;
      if (!spot) { spot = [x, Math.max(ymin, Math.min(ymax, y)), z]; forced = true; }
      const [bx, by, bz] = spot;
      w.urgent = true;
      if (forced) {
        // scava lo spazio e crea una piattaforma di ossidiana
        for (let i = -1; i <= 2; i++) for (let j = 0; j <= 3; j++) for (let k = -1; k <= 1; k++) w.setBlock(bx + i, by + j, bz + k, 0, 0, { noUpdate: true });
        for (let i = -1; i <= 2; i++) for (let k = -1; k <= 1; k++) w.setBlock(bx + i, by - 1, bz + k, B.obsidian, 0, { noUpdate: true });
      }
      for (let i = -1; i <= 2; i++) for (let j = -1; j <= 3; j++) {
        const edge = i === -1 || i === 2 || j === -1 || j === 3;
        w.setBlock(bx + i, by + j, bz, edge ? B.obsidian : 0, 0, { noUpdate: true });
      }
      for (let i = 0; i <= 1; i++) for (let j = 0; j <= 2; j++) w.setBlock(bx + i, by + j, bz, B.nether_portal, 0, { noUpdate: true });
      w.urgent = false;
      return [bx, by, bz];
    }
    _rainExposure() {
      const p = this.player, w = this.world;
      const sky = w.getSky(Math.floor(p.x), Math.floor(p.y + 1.6), Math.floor(p.z));
      const b = w.biomeAt(Math.floor(p.x), Math.floor(p.z));
      if (b === MC.BI.DESERT || b === MC.BI.SAVANNA || b === MC.BI.BADLANDS) return 0;
      return sky >= 14 ? 1 : sky / 30;
    }

    // ---------------- Interazione ----------------
    // tempo per rompere un blocco con l'oggetto in mano (stile originale)
    _breakTime(def) {
      const held = this.inventory.held();
      const hd = held ? MC.blocks[held.id] : null;
      const tool = hd && hd.tool ? hd.tool : null;
      let speed = 1;
      if (tool && def.tool && tool.type === def.tool) {
        speed = tool.speed;
        const eff = MC.enchant.enchLv(held, 'efficiency');
        if (eff) speed += eff * eff + 1;
      }
      if (tool && tool.type === 'sword' && def.key.endsWith('_leaves')) speed = 1.5;
      if (tool && tool.type === 'sword' && def.key === 'cobweb') speed = 15;
      const canHarvest = !def.needsTool || (tool && tool.type === def.tool && tool.level >= def.level);
      let t = (def.hardness * (canHarvest ? 1.5 : 5)) / speed;
      if (this.player.inWater && !this.player.onGround) t *= 5;
      else if (this.player.inWater) t *= 1.6;
      return { t: Math.max(0.05, t), canHarvest };
    }

    _interact(dt) {
      const p = this.player, w = this.world;
      this.breakCd -= dt; this.useCd -= dt; this.attackCd -= dt;
      if (p.dead) return;
      const eye = p.eye, d = p.dir();
      const reach = p.mode === 'creative' ? 5 : 4.5;
      const hit = MC.raycast(w, eye[0], eye[1], eye[2], d[0], d[1], d[2], reach);
      const mh = this.entities.raycastMobs(eye[0], eye[1], eye[2], d[0], d[1], d[2], 3.5);
      // colpire una palla di fuoco la rimanda indietro
      if (this.mouse.left && this.attackCd <= 0) {
        const fb = this.entities.raycastProjectiles(eye[0], eye[1], eye[2], d[0], d[1], d[2], 4.5);
        if (fb && (!hit || fb.t < hit.t)) {
          const sp = Math.hypot(fb.pr.vx, fb.pr.vy, fb.pr.vz) * 1.2;
          fb.pr.vx = d[0] * sp; fb.pr.vy = d[1] * sp; fb.pr.vz = d[2] * sp; fb.pr.owner = 'player'; fb.pr.age = 0;
          this.attackCd = 0.4; this.swing = 1;
          this.audio.hit(B.stone);
        }
      }
      const mobFirst = mh && (!hit || mh.t < hit.t);
      this.target = mobFirst ? null : hit;
      this.targetMob = mobFirst ? mh.mob : null;
      const held = this.inventory.held();
      const hd = held ? MC.blocks[held.id] : null;
      if (this.mouse.left && !this.eating) {
        if (mobFirst) {
          if (this.attackCd <= 0) {
            const E = MC.enchant.enchLv;
            let dmg = hd && hd.tool ? hd.tool.damage : 1;
            const sharp = E(held, 'sharpness');
            if (sharp) dmg += 0.5 * sharp + 0.5;
            const crit = !p.onGround && p.vy < 0 && !p.inWater;
            mh.mob.lastPlayerHit = 5;
            mh.mob.looting = E(held, 'looting');
            const fa = E(held, 'fire_aspect');
            if (fa && !mh.mob.D.fireImmune) mh.mob.onFire = Math.max(mh.mob.onFire || 0, 4 * fa);
            if (this.entities.hitMob(mh.mob, crit ? dmg * 1.5 : dmg, p.x, p.z, (p.sprinting ? 1.6 : 1) + E(held, 'knockback') * 0.9, 'player') && p.mode === 'survival') {
              if (hd && hd.tool) this.inventory.wearHeld(hd.tool.type === 'sword' ? 1 : 2);
              p.exhaust(0.1);
            }
            if (crit) for (let i = 0; i < 8; i++) this.entities.addParticle(mh.mob.x, mh.mob.y + 1, mh.mob.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, MC.textures.index.white, [0.9, 0.9, 0.9], 0.5, 0.05, 10, true);
            this.attackCd = hd && hd.tool && hd.tool.type === 'sword' ? 0.55 : 0.45;
            this.swing = 1;
          }
          this.breaking = null;
        } else if (hit) {
          const def = MC.blocks[hit.id];
          if (p.mode === 'creative') {
            if (this.breakCd <= 0 && !(hd && hd.tool && hd.tool.type === 'sword')) { this.breakBlock(hit.x, hit.y, hit.z, false); this.breakCd = 0.25; this.swing = 1; }
          } else if (def.hardness >= 0) {
            if (!this.breaking || this.breaking.x !== hit.x || this.breaking.y !== hit.y || this.breaking.z !== hit.z || this.breaking.id !== hit.id) {
              this.breaking = { x: hit.x, y: hit.y, z: hit.z, id: hit.id, p: 0, t: 0 };
            }
            const b = this.breaking;
            const bt = this._breakTime(def);
            b.p += dt / bt.t;
            b.t -= dt;
            if (b.t <= 0) { b.t = 0.22; this.audio.hit(hit.id); this.entities.hitParticles(hit.id, hit.x, hit.y, hit.z, hit.n); }
            if (this.swing <= 0.02) this.swing = 1; // oscillazione continua mentre si scava
            if (b.p >= 1) {
              this.breakBlock(hit.x, hit.y, hit.z, bt.canHarvest);
              if (hd && hd.tool && def.hardness > 0) this.inventory.wearHeld(hd.tool.type === def.tool ? 1 : 2);
              p.exhaust(0.005);
              this.breaking = null;
              this.breakCd = 0.15;
            }
          }
        } else this.breaking = null;
      } else this.breaking = null;

      // tasto destro: mangiare, arco, usare/piazzare
      const holdUse = this.mouse.right;
      if (hd && hd.food && holdUse && (p.mode === 'creative' || p.food < 20 || held.id === B.golden_apple)) {
        if (!this.eating) { this.eating = { t: 0, id: held.id }; }
        this.eating.t += dt;
        if (Math.random() < dt * 8) { this.audio.eat(); this.entities.breakParticlesItem(held.id, p, 2); }
        if (this.eating.t >= 1.6) {
          p.eat(hd.food.hunger, hd.food.sat);
          if (held.id === B.golden_apple) { p.health = Math.min(20, p.health + 4); }
          if (held.id === B.rotten_flesh && Math.random() < 0.8) p.hungerFx = 30;
          if (p.mode === 'survival') this.inventory.consumeHeld(1);
          this.audio.burp();
          this.eating = null;
          this.useCd = 0.3;
        }
        return;
      }
      this.eating = null;
      if (hd && hd.bow) {
        const hasArrow = p.mode === 'creative' || this.inventory.count(B.arrow) > 0;
        const EB = MC.enchant.enchLv;
        if (holdUse && hasArrow) { this.bowCharge = Math.min(1, (this.bowCharge || 0) + dt); }
        else if (!holdUse && this.bowCharge > 0.12) {
          const pw = this.bowCharge;
          const e = p.eye;
          const pow = EB(held, 'power');
          const ar = this.entities.shootArrow(e[0] + d[0] * 0.3, e[1] - 0.1, e[2] + d[2] * 0.3, d[0] * 45 * pw, d[1] * 45 * pw, d[2] * 45 * pw, 'player', (2 + 7 * pw * pw) * (pow ? 1 + 0.25 * (pow + 1) : 1));
          if (ar) { ar.punch = EB(held, 'punch'); ar.flame = EB(held, 'flame'); ar.infinite = EB(held, 'infinity') > 0; }
          this.audio.bow();
          if (p.mode === 'survival') { if (!EB(held, 'infinity')) this.inventory.remove(B.arrow, 1); this.inventory.wearHeld(1); }
          this.bowCharge = 0;
        } else if (!holdUse) this.bowCharge = 0;
        return;
      }
      this.bowCharge = 0;
      if (holdUse && this.useCd <= 0) {
        this.useCd = 0.22;
        if (this.targetMob) this._useOnMob(this.targetMob);
        else this._use(hit);
      }
    }

    _useOnMob(m) {
      const held = this.inventory.held();
      if (m.type === 'villager' && !m.dead) { this.openTrade(m); return; }
      // addomesticare lupi (osso) e gatti (merluzzo)
      const food = { wolf: [B.bone], cat: [B.cod, B.cooked_cod] }[m.type];
      if (food && !m.dead) {
        const p = this.player;
        if (!m.tamed && held && food.includes(held.id) && !(m.angry > 0)) {
          if (p.mode === 'survival') this.inventory.consumeHeld(1);
          this.swing = 1;
          const ok = p.mode === 'creative' || Math.random() < 0.34;
          for (let i = 0; i < 7; i++) this.entities.addParticle(m.x + (Math.random() - 0.5) * 0.6, m.y + m.D.h + Math.random() * 0.3, m.z + (Math.random() - 0.5) * 0.6, 0, 0.8, 0, MC.textures.index.white, ok ? [1, 0.3, 0.4] : [0.4, 0.4, 0.4], 0.9, 0.06, -0.4, true);
          if (ok) { m.tamed = true; m.maxHp = 20; m.hp = 20; m.persistent = true; m.sitting = true; m.target = null; m.angry = 0; this.audio.tame(); this.ui.chat(m.D.name + ' addomesticato! Clic destro per farlo sedere o alzare.'); }
          return;
        }
        if (m.tamed) {
          const meat = held && MC.blocks[held.id].food && m.type === 'wolf' && ['porkchop', 'cooked_porkchop', 'beef', 'steak', 'chicken', 'cooked_chicken', 'mutton', 'cooked_mutton', 'rotten_flesh'].includes(MC.blocks[held.id].key);
          if (meat && m.hp < m.maxHp) { m.hp = Math.min(m.maxHp, m.hp + 4); if (p.mode === 'survival') this.inventory.consumeHeld(1); this.audio.eat(); return; }
          m.sitting = !m.sitting; m.target = null; this.swing = 1;
          return;
        }
      }
      if (held && MC.blocks[held.id].egg) { this._use(null); return; }
    }

    breakBlock(x, y, z, drop) {
      const w = this.world;
      const id = w.getBlock(x, y, z);
      if (!id) return;
      const def = MC.blocks[id];
      const meta = w.getMeta(x, y, z);
      w.urgent = true;
      if (id === B.ice && this.player.mode === 'survival' && w.getBlock(x, y - 1, z) !== 0) w.setBlock(x, y, z, B.water, 0);
      else w.setBlock(x, y, z, 0, 0);
      // porte e letti: rompi anche l'altra metà
      if (def.door) { const oy = meta & 8 ? y - 1 : y + 1; if (w.getBlock(x, oy, z) === id) w.setBlock(x, oy, z, 0, 0); }
      if (def.bed) {
        const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]][meta & 3], sgn = meta & 4 ? -1 : 1;
        const px = x + DV[0] * sgn, pz = z + DV[1] * sgn;
        if (w.getBlock(px, y, pz) === id) w.setBlock(px, y, pz, 0, 0, { noUpdate: true });
      }
      w.urgent = false;
      if (def.interact === 'chest') this._dropChest(x, y, z);
      this.entities.breakParticles(id, x, y, z);
      this.audio.dig(id);
      if (drop && this.player.mode === 'survival') this._spawnDrops(id, x, y, z, meta, this.inventory.held());
    }

    _spawnDrops(id, x, y, z, meta, tool) {
      const def = MC.blocks[id];
      const E = MC.enchant.enchLv;
      if (tool && E(tool, 'silk_touch') && def.hardness > 0 && !def.shape.match(/model|crop|liquid/) && id < 256 && def.creative) {
        this.entities.dropItem(id, 1, x + 0.5, y + 0.4, z + 0.5);
        return;
      }
      if (def.xp && tool) this.entities.spawnXp(x + 0.5, y + 0.5, z + 0.5, def.xp[0] + Math.floor(Math.random() * (def.xp[1] - def.xp[0] + 1)));
      const fort = tool && def.fortune ? E(tool, 'fortune') : 0;
      const mul = fort ? Math.max(1, 1 + Math.floor(Math.random() * (fort + 2)) - 1) : 1;
      if (def.dropFn) { for (const [did, n] of def.dropFn(meta)) if (did && n) this.entities.dropItem(did, n * mul, x + 0.5, y + 0.4, z + 0.5); return; }
      if (def.drop) this.entities.dropItem(def.drop, 1, x + 0.5, y + 0.4, z + 0.5);
    }

    _naturalDrop(id, x, y, z, meta) {
      this.entities.breakParticles(id, x, y, z, 10);
      if (this.player.mode === 'survival') this._spawnDrops(id, x, y, z, meta || 0);
    }

    _use(hit) {
      const w = this.world, p = this.player;
      const held = this.inventory.held();
      const hd = held ? MC.blocks[held.id] : null;
      // armature: si indossano col clic destro
      if (hd && hd.armor) {
        const sl = hd.armor.slot, inv = this.inventory;
        const old = inv.armor[sl];
        inv.armor[sl] = held;
        inv.slots[inv.selected] = old;
        inv._ch();
        this.audio.equip ? this.audio.equip() : this.audio.pop();
        this.swing = 1;
        return;
      }
      // perla di ender e ampolla di esperienza si lanciano
      if (hd && (hd.pearl || hd.xpBottle)) {
        const d = p.dir(), e = p.eye;
        this.entities.throwProjectile(hd.pearl ? 'pearl' : 'xpbottle', e[0] + d[0] * 0.4, e[1] - 0.1, e[2] + d[2] * 0.4, d[0] * 22 + p.vx, d[1] * 22 + 2, d[2] * 22 + p.vz);
        this.audio.bow(0.5);
        this.swing = 1;
        if (p.mode === 'survival') this.inventory.consumeHeld(1);
        return;
      }
      // uova generatrici
      if (hd && hd.egg) {
        let x, y, z;
        if (hit) { x = hit.x + hit.n[0] + 0.5; y = hit.y + hit.n[1]; z = hit.z + hit.n[2] + 0.5; if (hit.n[1] === 0) y = hit.y; }
        else { const d = p.dir(); x = p.x + d[0] * 2; y = p.y; z = p.z + d[2] * 2; }
        this.entities.spawnMob(hd.egg, x, y, z);
        this.swing = 1;
        if (p.mode === 'survival') this.inventory.consumeHeld(1);
        return;
      }
      if (!hit) return;
      const def = MC.blocks[hit.id];
      if (!p.sneaking) {
        if (def.interact === 'craft') { this.swing = 1; this.openInventory(hit.id === B.furnace ? 'furnace' : 'table'); return; }
        if (def.interact === 'chest') { this.swing = 1; this.openChest(hit.x, hit.y, hit.z); return; }
        if (def.interact === 'door') { this._toggleDoor(hit.x, hit.y, hit.z); this.swing = 1; return; }
        if (def.interact === 'bed') {
          if (this.dim === 'nether') { this.breakBlock(hit.x, hit.y, hit.z, false); this.explode(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 5); this.lastHurt = 'bed'; return; }
          this._sleep(hit.x, hit.y, hit.z); return;
        }
        if (def.interact === 'enchant') { this.swing = 1; this.openEnchant(hit.x, hit.y, hit.z); return; }
        if (def.interact === 'gate' || def.interact === 'trapdoor') {
          const m = w.getMeta(hit.x, hit.y, hit.z) ^ 4;
          let mm = m;
          if (def.gate && (m & 4)) {
            // si apre allontanandosi dal giocatore
            const d = p.dir();
            const face = Math.abs(d[0]) > Math.abs(d[2]) ? (d[0] > 0 ? 1 : 3) : (d[2] > 0 ? 2 : 0);
            if (((face ^ (m & 3)) & 1) === 0) mm = (m & ~3) | face;
          }
          w.urgent = true; w.setBlock(hit.x, hit.y, hit.z, hit.id, mm, { noUpdate: true }); w.urgent = false;
          this.audio.door(!!(mm & 4)); this.swing = 1;
          return;
        }
        if (hd && hd.igniter && hit.id === B.obsidian) {
          if (this._tryLightPortal(hit.x + hit.n[0], hit.y + hit.n[1], hit.z + hit.n[2])) {
            this.swing = 1;
            if (p.mode === 'survival') this.inventory.wearHeld(1);
            return;
          }
        }
        if (hit.id === B.tnt && (!hd || hd.igniter || !MC.blocks[held.id] || hd.item)) {
          w.urgent = true; w.setBlock(hit.x, hit.y, hit.z, 0, 0); w.urgent = false;
          this.entities.primeTNT(hit.x, hit.y, hit.z, 4);
          this.audio.fuse();
          this.swing = 1;
          if (hd && hd.igniter && p.mode === 'survival') this.inventory.wearHeld(1);
          return;
        }
      }
      if (!held) return;
      // zappa: ara la terra
      if (hd.tool && hd.tool.type === 'hoe') {
        if ((hit.id === B.grass || hit.id === B.dirt || hit.id === B.dirt_path) && !w.getBlock(hit.x, hit.y + 1, hit.z) && hit.n[1] !== -1) {
          w.urgent = true; w.setBlock(hit.x, hit.y, hit.z, B.farmland, 0); w.urgent = false;
          this.audio.place(B.dirt); this.swing = 1;
          if (p.mode === 'survival') this.inventory.wearHeld(1);
          if (hit.id === B.grass && Math.random() < 0.1 && p.mode === 'survival') this.entities.dropItem(B.wheat_seeds, 1, hit.x + 0.5, hit.y + 1.1, hit.z + 0.5);
        }
        return;
      }
      // pala: crea un sentiero
      if (hd.tool && hd.tool.type === 'shovel' && hit.id === B.grass && !w.getBlock(hit.x, hit.y + 1, hit.z)) {
        w.urgent = true; w.setBlock(hit.x, hit.y, hit.z, B.dirt_path, 0); w.urgent = false;
        this.audio.place(B.dirt); this.swing = 1;
        if (p.mode === 'survival') this.inventory.wearHeld(1);
        return;
      }
      // farina d'ossa: fa crescere piante e raccolti
      if (hd.boneMeal) {
        const b = hit.id, m = w.getMeta(hit.x, hit.y, hit.z);
        let used = false;
        w.urgent = true;
        if (b === B.wheat && m < 7) { w.setBlock(hit.x, hit.y, hit.z, b, Math.min(7, m + 2 + Math.floor(Math.random() * 3))); used = true; }
        else if (b === B.nether_wart && m < 3) { w.setBlock(hit.x, hit.y, hit.z, b, 3); used = true; }
        else if (MC.blocks[b].key.endsWith('_sapling')) { if (Math.random() < 0.45) w.growTree(hit.x, hit.y, hit.z, b); used = true; }
        else if (b === B.grass && hit.n[1] === 1) {
          for (let i = 0; i < 24; i++) {
            const gx = hit.x + Math.floor((Math.random() - 0.5) * 7), gz = hit.z + Math.floor((Math.random() - 0.5) * 7);
            for (let gy = hit.y + 2; gy >= hit.y - 2; gy--) {
              if (w.getBlock(gx, gy, gz) === B.grass && w.getBlock(gx, gy + 1, gz) === 0) { const r = Math.random(); w.setBlock(gx, gy + 1, gz, r < 0.75 ? B.tall_grass : r < 0.88 ? B.dandelion : B.poppy, 0); break; }
            }
          }
          used = true;
        }
        w.urgent = false;
        if (used) {
          for (let i = 0; i < 10; i++) this.entities.addParticle(hit.x + Math.random(), hit.y + 1 + Math.random() * 0.5, hit.z + Math.random(), 0, 0.5, 0, MC.textures.index.white, [0.4, 1, 0.4], 0.8, 0.04, -0.3, true);
          this.swing = 1;
          if (p.mode === 'survival') this.inventory.consumeHeld(1);
        }
        return;
      }
      // piante del Nether (verruca su sabbia delle anime)
      if (hd.plant) {
        if (hit.id === B[hd.plantOn] && hit.n[1] === 1 && !w.getBlock(hit.x, hit.y + 1, hit.z)) {
          w.urgent = true; w.setBlock(hit.x, hit.y + 1, hit.z, B[hd.plant], 0); w.urgent = false;
          this.audio.place(B.grass); this.swing = 1;
          if (p.mode === 'survival') this.inventory.consumeHeld(1);
        }
        return;
      }
      if (hd.seeds) {
        if (hit.id === B.farmland && hit.n[1] === 1 && !w.getBlock(hit.x, hit.y + 1, hit.z)) {
          w.urgent = true; w.setBlock(hit.x, hit.y + 1, hit.z, B.wheat, 0); w.urgent = false;
          this.audio.place(B.grass); this.swing = 1;
          if (p.mode === 'survival') this.inventory.consumeHeld(1);
        }
        return;
      }
      if (hd.item) return;
      if (this._place(held.id, hit)) {
        this.swing = 1;
        this.equip = Math.max(this.equip, 0.12);
        if (p.mode === 'survival') this.inventory.consumeHeld(1);
      }
    }

    // ---------------- Bauli ----------------
    openChest(x, y, z) {
      const key = (this.dim === 'nether' ? 'n:' : '') + x + ',' + y + ',' + z;
      if (!this.chests[key]) {
        this.chests[key] = new Array(27).fill(null);
        // bottino dei villaggi: il meta 8 indica un baule da riempire
        if (this.world.getMeta(x, y, z) & 8) this._fillLoot(this.chests[key], x, y, z);
      }
      this.state = 'inventory';
      this.keys.clear(); this.mouse.left = this.mouse.right = false;
      this.unlockPointer();
      document.getElementById('click-to-play').classList.add('hidden');
      this.openChestKey = key;
      this.ui.openInventory(null, this.chests[key]);
      this.audio.door(true);
    }
    _fillLoot(slots, x, y, z) {
      const r = MC.util.mulberry32((x * 73856093) ^ (y * 19349663) ^ (z * 83492791));
      if (this.dim === 'nether') {
        const fp = [['gold_ingot', 1, 5], ['iron_ingot', 1, 5], ['diamond', 1, 3, 0.4], ['nether_wart_item', 3, 7], ['golden_chestplate', 1, 1, 0.4], ['golden_sword', 1, 1, 0.5], ['iron_sword', 1, 1, 0.4], ['obsidian', 2, 6], ['flint_and_steel', 1, 1, 0.5], ['blaze_rod', 1, 3, 0.4], ['gold_nugget', 3, 12], ['diamond_chestplate', 1, 1, 0.08], ['experience_bottle', 1, 4, 0.5], ['book', 1, 3]];
        const n2 = 3 + Math.floor(r() * 5);
        for (let i = 0; i < n2; i++) {
          const [k, a, b, chance] = fp[Math.floor(r() * fp.length)];
          if (chance && r() > chance) continue;
          slots[Math.floor(r() * 27)] = { id: B[k], count: a + Math.floor(r() * (b - a + 1)) };
        }
        return;
      }
      const pool = [['bread', 1, 4], ['apple', 1, 3], ['iron_ingot', 1, 5], ['gold_ingot', 1, 3], ['wheat_item', 3, 8], ['emerald', 1, 3], ['diamond', 1, 2, 0.15], ['iron_pickaxe', 1, 1, 0.3], ['iron_sword', 1, 1, 0.3], ['oak_sapling', 1, 3], ['torch', 4, 10], ['coal', 2, 6], ['arrow', 4, 12], ['bow', 1, 1, 0.2]];
      const n = 3 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const [k, a, b, chance] = pool[Math.floor(r() * pool.length)];
        if (chance && r() > chance) continue;
        slots[Math.floor(r() * 27)] = { id: B[k], count: a + Math.floor(r() * (b - a + 1)) };
      }
    }
    chestChanged() { if (this.meta) this.meta.chests = this.chests; }
    _dropChest(x, y, z) {
      const key = (this.dim === 'nether' ? 'n:' : '') + x + ',' + y + ',' + z;
      const slots = this.chests[key];
      if (!slots) return;
      for (const s of slots) if (s) this.entities.dropItem(s.id, s.count, x + 0.5, y + 0.5, z + 0.5);
      delete this.chests[key];
      this.chestChanged();
    }

    openTrade(m) {
      this.state = 'trade';
      this.keys.clear(); this.mouse.left = this.mouse.right = false;
      this.unlockPointer();
      document.getElementById('click-to-play').classList.add('hidden');
      this.ui.openTrade(m);
    }
    closeTrade() {
      this.ui.hideScreens();
      this.state = 'playing';
      this.lockPointer();
    }

    _toggleDoor(x, y, z) {
      const w = this.world;
      const m = w.getMeta(x, y, z);
      const by = m & 8 ? y - 1 : y;
      const mb = w.getMeta(x, by, z) ^ 4;
      w.urgent = true;
      w.setBlock(x, by, z, B.oak_door, mb & ~8, { noUpdate: true });
      if (w.getBlock(x, by + 1, z) === B.oak_door) w.setBlock(x, by + 1, z, B.oak_door, (mb & ~8) | 8, { noUpdate: true });
      w.urgent = false;
      this.audio.door(!!(mb & 4));
    }

    _sleep(x, y, z) {
      const t = this.time % 24000;
      this.meta.spawn = { x: x + 0.5, z: z + 0.5, y: y + 1 };
      if (t > 12500 && t < 23500) {
        const hostile = this.entities.mobs.some((m) => m.M.hostile && !m.dead && Math.hypot(m.x - x, m.z - z) < 8);
        if (hostile) { this.ui.chat('Non puoi dormire ora: ci sono mostri nelle vicinanze.'); return; }
        this.time = Math.floor(this.time / 24000) * 24000 + 24000;
        this.rainTarget = 0;
        this.ui.chat('Buongiorno! Il punto di rinascita è stato impostato.');
      } else this.ui.chat('Punto di rinascita impostato. Puoi dormire solo di notte.');
    }

    _place(id, hit) {
      const w = this.world, p = this.player;
      const hd = MC.blocks[id];
      const n = hit.n;
      let tx = hit.x, ty = hit.y, tz = hit.z;
      const cur = w.getBlock(tx, ty, tz);
      const curMeta = w.getMeta(tx, ty, tz);
      // lastra su lastra dello stesso tipo = blocco pieno
      if (hd.slab && cur === id) {
        const top = curMeta & 1;
        if ((n[1] === 1 && !top) || (n[1] === -1 && top)) {
          w.urgent = true; const ok = w.setBlock(tx, ty, tz, B[hd.slab], 0); w.urgent = false;
          if (ok) this.audio.place(id);
          return ok;
        }
      }
      const inPlace = REPLACEABLE[cur] && !FLUID[cur] && cur !== id;
      if (!inPlace) { tx += n[0]; ty += n[1]; tz += n[2]; }
      if (ty < 0 || ty >= WH) return false;
      const existing = w.getBlock(tx, ty, tz);
      if (hd.slab && existing === id) {
        const top = w.getMeta(tx, ty, tz) & 1;
        w.urgent = true; const ok = w.setBlock(tx, ty, tz, B[hd.slab], 0); w.urgent = false;
        if (ok) this.audio.place(id);
        return ok && !!top === !!top;
      }
      if (!REPLACEABLE[existing] || existing === id) return false;
      if (FLUID[existing] && (hd.shape === 'cross' || hd.shape === 'torch' || hd.door || hd.ladder)) return false;
      let meta = 0;
      const d = p.dir();
      const dirIdx = Math.abs(d[0]) > Math.abs(d[2]) ? (d[0] > 0 ? 1 : 3) : (d[2] > 0 ? 2 : 0); // 0 -Z,1 +X,2 +Z,3 -X
      const upperHalf = hit.hit ? hit.hit[1] - (inPlace ? 0 : 0) > 0.5 : false;
      if (hd.shape === 'torch') {
        if (inPlace || n[1] === 1) { if (!OPAQUE[w.getBlock(tx, ty - 1, tz)]) return false; meta = 0; }
        else if (n[1] === -1) { if (!OPAQUE[w.getBlock(tx, ty - 1, tz)]) return false; meta = 0; }
        else {
          if (!OPAQUE[hit.id]) return false;
          meta = n[0] === 1 ? 1 : n[0] === -1 ? 2 : n[2] === 1 ? 3 : 4;
        }
      }
      if (hd.ladder) {
        if (n[1] !== 0 || !OPAQUE[hit.id]) return false;
        meta = n[0] === 1 ? 1 : n[0] === -1 ? 2 : n[2] === 1 ? 3 : 4;
      }
      if (hd.slab) meta = n[1] === -1 || (n[1] === 0 && upperHalf) ? 1 : 0;
      if (hd.stairs) meta = dirIdx | (n[1] === -1 || (n[1] === 0 && upperHalf) ? 4 : 0);
      if (hd.door) {
        if (ty + 1 >= WH || !REPLACEABLE[w.getBlock(tx, ty + 1, tz)] || !SOLID[w.getBlock(tx, ty - 1, tz)]) return false;
        meta = dirIdx;
      }
      if (hd.gate) meta = dirIdx;
      if (hd.trapdoor) meta = ((dirIdx + 2) & 3) | (n[1] === -1 || (n[1] === 0 && upperHalf) ? 8 : 0);
      if (id === B.lantern && n[1] === -1) meta = 1;
      if (hd.carpet && !SOLID[w.getBlock(tx, ty - 1, tz)]) return false;
      let bedHead = null;
      if (hd.bed) {
        const DV = [[0, -1], [1, 0], [0, 1], [-1, 0]][dirIdx];
        const hx = tx + DV[0], hz = tz + DV[1];
        if (!REPLACEABLE[w.getBlock(hx, ty, hz)] || FLUID[w.getBlock(hx, ty, hz)]) return false;
        if (!SOLID[w.getBlock(tx, ty - 1, tz)] || !SOLID[w.getBlock(hx, ty - 1, hz)]) return false;
        meta = dirIdx;
        bedHead = [hx, ty, hz];
      }
      if (hd.support && !hd.support(w.getBlock(tx, ty - 1, tz))) return false;
      if (hd.shape === 'cactus') {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (SOLID[w.getBlock(tx + dx, ty, tz + dz)]) return false;
      }
      if (hd.axis) meta = n[0] ? 1 : n[2] ? 2 : 0;
      if (hd.facing) meta = Math.abs(d[0]) > Math.abs(d[2]) ? (d[0] > 0 ? 1 : 0) : (d[2] > 0 ? 5 : 4);
      if (SOLID[id]) {
        const boxes = MC.getCollisionBoxes(id, meta, 0) || [];
        const pb = p.bbox();
        for (const cb of boxes) {
          const bx0 = tx + cb[0], by0 = ty + cb[1], bz0 = tz + cb[2], bx1 = tx + cb[3], by1 = ty + Math.min(1, cb[4]) + (hd.door ? 1 : 0), bz1 = tz + cb[5];
          if (pb[3] > bx0 && pb[0] < bx1 && pb[4] > by0 && pb[1] < by1 && pb[5] > bz0 && pb[2] < bz1) return false;
          for (const m of this.entities.mobs) {
            const hw = m.M.w / 2;
            if (m.x + hw > bx0 && m.x - hw < bx1 && m.y + m.M.h > by0 && m.y < by1 && m.z + hw > bz0 && m.z - hw < bz1) return false;
          }
        }
      }
      w.urgent = true;
      const ok = w.setBlock(tx, ty, tz, id, meta);
      if (ok && hd.door) w.setBlock(tx, ty + 1, tz, id, meta | 8);
      if (ok && bedHead) w.setBlock(bedHead[0], bedHead[1], bedHead[2], id, meta | 4);
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
      this.throwStack(s.id, n, s);
      if (this.player.mode === 'survival') this.inventory.consumeHeld(n);
      this.swing = 1;
    }

    throwStack(id, n, extra) {
      const p = this.player, d = p.dir();
      const e = p.eye;
      this.entities.dropItem(id, n, e[0] + d[0] * 0.3, e[1] - 0.3, e[2] + d[2] * 0.3, d[0] * 6 + p.vx, d[1] * 6 + 2, d[2] * 6 + p.vz, 1.2, extra);
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
      for (const s of this.inventory.slots.concat(this.inventory.armor)) {
        if (s) this.entities.dropItem(s.id, s.count, p.x, p.y + 1, p.z, (this.rng() - 0.5) * 5, 3 + this.rng() * 3, (this.rng() - 0.5) * 5, 2, s);
      }
      this.inventory.slots = new Array(36).fill(null);
      this.inventory.armor = [null, null, null, null];
      if (p.xpLevel || p.xp) { this.entities.spawnXp(p.x, p.y + 0.5, p.z, Math.min(100, (p.xpLevel || 0) * 7)); p.xpLevel = 0; p.xp = 0; this.ui.updateXp(); }
      this.inventory._ch();
      const msgs = { fall: 'Sei caduto da troppo in alto', drown: 'Sei annegato', lava: 'Hai provato a nuotare nella lava', explosion: 'Sei saltato in aria', zombie: 'Sei stato ucciso da uno zombie', cactus: 'Sei stato punto a morte', void: 'Sei caduto fuori dal mondo', kill: 'Sei morto', arrow: 'Sei stato colpito da uno scheletro', spider: 'Sei stato ucciso da un ragno', golem: 'Sei stato ucciso da un golem di ferro', starve: 'Sei morto di fame', bed: 'Il letto è esploso: nel Nether non si dorme!', magma: 'Hai camminato sul magma', fireball: 'Sei stato colpito da una palla di fuoco', ghast: 'Sei stato colpito da una palla di fuoco di ghast', blaze: 'Sei stato bruciato da un blaze', zombified_piglin: 'Sei stato ucciso da un piglin zombificato', magma_cube: 'Sei stato schiacciato da un cubo di magma', enderman: 'Sei stato ucciso da un enderman', wolf: 'Sei stato sbranato da un lupo', fire: 'Sei bruciato', pearl: 'Sei caduto dopo un teletrasporto' };
      this.ui.showDeath(msgs[this.lastHurt] || 'Sei morto');
      document.getElementById('click-to-play').classList.add('hidden');
    }

    respawn() {
      const p = this.player;
      if (this.dim === 'nether') {
        p.dead = false; p.health = 20; p.air = 300; p.food = 20; p.sat = 5; p.exh = 0; p.hurtTime = 0; p.flying = false;
        this.pendingSpawn = true;
        this.ui.hideScreens();
        this.switchDim('overworld', this.meta.spawn.x, 150, this.meta.spawn.z, false);
        return;
      }
      p.dead = false; p.health = 20; p.air = 300; p.food = 20; p.sat = 5; p.exh = 0; p.vx = p.vy = p.vz = 0; p.fallDist = 0; p.hurtTime = 0; p.flying = false;
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
        case 'locate': {
          if (this.dim === 'nether') {
            const fs = this.world.gen.fortressesNear(p.x, p.z, 1500);
            if (!fs.length) { say('Nessuna fortezza vicina'); return; }
            fs.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
            const f = fs[0];
            say('Fortezza del Nether più vicina: ' + f.x + ' ' + f.y + ' ' + f.z + ' (' + Math.round(Math.hypot(f.x - p.x, f.z - p.z)) + ' blocchi). Usa /tp ' + f.x + ' ' + (f.y + 2) + ' ' + f.z);
            return;
          }
          const vs = this.world.gen.villagesNear(p.x, p.z, 3000);
          if (!vs.length) { say('Nessun villaggio entro 3000 blocchi'); return; }
          vs.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
          const v = vs[0];
          say('Villaggio più vicino: ' + v.x + ' ~ ' + v.z + ' (' + Math.round(Math.hypot(v.x - p.x, v.z - p.z)) + ' blocchi). Usa /tp ' + v.x + ' 120 ' + v.z);
          break;
        }
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
          if (id === undefined) { const d = MC.defs.find((b) => b.name.toLowerCase() === q.replace(/_/g, ' ') || b.name.toLowerCase().includes(q.replace(/_/g, ' '))); if (d) id = d.id; }
          if (!id) { say('Blocco sconosciuto: ' + q); return; }
          const left = this.inventory.add(id, n);
          say('Dati ' + (n - left) + ' × ' + MC.blocks[id].name);
          break;
        }
        case 'spawn': case 'summon': {
          const t = (a[1] || '').toLowerCase();
          if (!MC.mobs.DEFS[t] || MC.mobs.DEFS[t].noSpawn) { say('Creature: ' + Object.keys(MC.mobs.DEFS).filter((k) => !MC.mobs.DEFS[k].noSpawn).join(', ')); return; }
          const d = p.dir();
          this.entities.spawnMob(t, p.x + d[0] * 3, p.y + 0.5, p.z + d[2] * 3);
          say('Evocato: ' + t);
          break;
        }
        case 'dim': case 'dimension': case 'nether': {
          const v = cmd === 'nether' ? 'nether' : (a[1] || '').toLowerCase();
          if (v === 'nether' && this.dim !== 'nether') { say('Viaggio nel Nether...'); this.switchDim('nether', p.x / 8, 70, p.z / 8, true); }
          else if ((v === 'overworld' || v === 'mondo') && this.dim === 'nether') { say('Ritorno al mondo normale...'); this.switchDim('overworld', p.x * 8, 80, p.z * 8, true); }
          else say('Uso: /dim nether|overworld');
          break;
        }
        case 'xp': {
          const n = parseInt(a[1], 10);
          if (isNaN(n)) { say('Uso: /xp <livelli>'); return; }
          this.addXpLevels(n);
          say('Livelli di esperienza: ' + p.xpLevel);
          break;
        }
        case 'enchant': {
          const held = this.inventory.held();
          const k = (a[1] || '').toLowerCase();
          const E = MC.ENCH[k];
          if (!held || !E) { say('Uso: /enchant <' + Object.keys(MC.ENCH).join('|') + '> [livello] (con l\'oggetto in mano)'); return; }
          const lv = Math.max(1, Math.min(E.max, parseInt(a[2], 10) || E.max));
          held.ench = Object.assign({}, held.ench || {}, { [k]: lv });
          this.inventory._ch();
          say('Incantato: ' + MC.enchName(k, lv));
          break;
        }
        case 'kill': if (p.mode === 'survival') { this.lastHurt = 'kill'; p.health = 0; p.dead = true; } else say('Solo in sopravvivenza'); break;
        case 'help': case 'aiuto':
          say('/time set day|night · /gamemode creative|survival · /tp x y z · /seed · /weather clear|rain · /give oggetto n · /spawn creatura · /locate · /dim nether|overworld · /xp n · /enchant nome livello · /kill');
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
        'Dimensione: ' + (this.dim === 'nether' ? 'Nether' : 'Mondo normale') + '   Bioma: ' + (MC.BIOMES[b] ? MC.BIOMES[b].name : '?'),
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
      const env = this.env || r.computeEnv(this.time, p.eyeInWater, p.eyeInLava, w.renderDist, this._rainLevel(), this.dim === 'nether' ? this._netherFog(0) : null);
      const bobA = this.settings.bob && !this.thirdPerson ? p.bobAmt : 0;
      const bx = Math.sin(p.bob * Math.PI) * 0.04 * bobA, by = -Math.abs(Math.cos(p.bob * Math.PI)) * 0.06 * bobA;
      const e = p.eye.slice();
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const sh = this.shake * 0.25;
      this._updatePlayerModel(dt);
      if (this.thirdPerson) {
        // camera dietro o davanti al giocatore, senza entrare nei muri
        const d = p.dir(), sg = this.thirdPerson === 1 ? -1 : 1;
        const hit = MC.raycast(w, e[0], e[1], e[2], d[0] * sg, d[1] * sg, d[2] * sg, 4);
        const t = hit ? Math.max(0.3, hit.t - 0.3) : 4;
        e[0] += d[0] * sg * t; e[1] += d[1] * sg * t; e[2] += d[2] * sg * t;
      }
      const cam = {
        x: e[0] + rx * bx + (this.rng() - 0.5) * sh, y: e[1] + by + (this.rng() - 0.5) * sh, z: e[2] + rz * bx + (this.rng() - 0.5) * sh,
        yaw: this.thirdPerson === 2 ? p.yaw + Math.PI : p.yaw, pitch: this.thirdPerson === 2 ? -p.pitch : p.pitch,
        roll: Math.sin(p.bob * Math.PI) * 0.008 * bobA + (p.hurtTime > 0 ? Math.sin(p.hurtTime * 12) * 0.06 : 0),
        fov: this.settings.fov * p.fovMod,
        brightness: this.settings.bright / 100,
      };
      r.fx.shaders = this.settings.shaderLevel > 0;
      r.fx.ultra = this.settings.shaderLevel > 1;
      r.fx.shadows = !!this.settings.shadows;
      r.fx.shadowSize = this.touchMode ? 1024 : 2048;
      r.setupCamera(cam);
      r.renderShadows(w, cam, env, tsec);
      r.beginScene();
      gl.viewport(0, 0, r.canvas.width, r.canvas.height);
      gl.clearColor(env.fogCol[0], env.fogCol[1], env.fogCol[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
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

      r.captureOpaque();
      r.drawTranslucent(env, cam, tsec);
      if (this.settings.clouds && this.dim !== 'nether') r.drawClouds(env, cam, tsec);
      if (this.dim !== 'nether') this._renderWeather(env, cam, tsec);
      if (this.target && this.state !== 'dead' && !this.hudHidden) r.drawSelection(this.target.box, cam);
      if (!this.hudHidden && this.state !== 'dead' && !this.thirdPerson) this._renderHand(env, cam, dt);
      r.endScene(env, tsec);
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
      const PI = Math.PI, D = PI / 180;
      // avanzamento dell'oscillazione 0..1 (curve come nell'originale)
      const sw = this.swing > 0 ? 1 - this.swing : 0;
      const sq = Math.sqrt(sw);
      const bobA = this.settings.bob ? p.bobAmt : 0;
      const hx = Math.sin(p.bob * PI) * 0.03 * bobA, hy = -Math.abs(Math.cos(p.bob * PI)) * 0.035 * bobA;
      // la mano segue la visuale con un leggero ritardo
      const lag = this.handLag || (this.handLag = { yaw: p.yaw, pitch: p.pitch });
      let dyaw = p.yaw - lag.yaw;
      while (dyaw > PI) dyaw -= 2 * PI; while (dyaw < -PI) dyaw += 2 * PI;
      lag.yaw += dyaw * Math.min(1, dt * 16); lag.pitch += (p.pitch - lag.pitch) * Math.min(1, dt * 16);
      const ly = Math.max(-0.5, Math.min(0.5, dyaw)), lp = Math.max(-0.5, Math.min(0.5, p.pitch - lag.pitch));
      const equip = this.equip;
      const M = mat4.create(), T = mat4.create();
      const mul = () => mat4.mul(M, M, T);
      mat4.rotX(T, lp * 0.25); mul();
      mat4.rotY(T, ly * 0.25); mul();
      const hEnv = { fogCol: env.fogCol, fog: [100, 200] };
      if (held) {
        const d = MC.blocks[held.id];
        const flat = d.shape === 'cross' || d.shape === 'torch' || d.shape === 'item' || d.shape === 'crop' || d.ladder || d.door || d.conn === 'pane';
        const eatOrBow = this.eating || (d.bow && this.bowCharge > 0);
        const s1 = eatOrBow ? 0 : sq, s0 = eatOrBow ? 0 : sw;
        mat4.translate(T, (-0.4 * Math.sin(s1 * PI)) * 0.6 + hx, (0.2 * Math.sin(s1 * 2 * PI)) * 0.6 + hy, -0.2 * Math.sin(s0 * PI) * 0.6); mul();
        mat4.translate(T, 0.56, -0.58 - equip * 0.5, -0.9); mul();
        mat4.rotY(T, (45 - Math.sin(s0 * s0 * PI) * 20) * D); mul();
        mat4.rotZ(T, -Math.sin(s1 * PI) * 20 * D); mul();
        mat4.rotX(T, -Math.sin(s1 * PI) * 80 * D); mul();
        mat4.rotY(T, -45 * D); mul();
        mat4.rotY(T, -0.72); mul();
        if (this.eating) {
          const e = this.eating.t;
          const k = Math.min(1, e * 4);
          mat4.translate(T, -0.38 * k, (0.2 + Math.abs(Math.sin(e * 14)) * 0.05) * k, 0.18 * k); mul();
          mat4.rotY(T, 0.9 * k); mul();
          mat4.rotX(T, 0.3 * k); mul();
        }
        if (d.bow && this.bowCharge > 0) {
          const c = this.bowCharge;
          mat4.translate(T, -0.3, 0.1 + Math.sin(performance.now() / 40) * 0.004 * c, 0.1); mul();
          mat4.rotY(T, 0.6); mul();
          mat4.rotZ(T, -0.4); mul();
          mat4.translate(T, 0, 0, c * 0.12); mul();
        }
        const glint = held.ench ? MC.glintCol(performance.now() / 1000) : null;
        if (flat) {
          mat4.rotY(T, 0.72 - (d.tool || d.bow ? 0.1 : 0)); mul();
          if (d.tool) { mat4.rotZ(T, 0.25); mul(); mat4.translate(T, 0, -0.05, 0); mul(); }
          MC.drawItemModel(r.batch, M, held.id, d.tool ? 0.6 : 0.5, l, glint);
        } else {
          mat4.translate(T, 0, -0.08, 0); mul();
          MC.drawItemModel(r.batch, M, held.id, 0.4, l, glint);
        }
      } else {
        // braccio nudo con la pelle del personaggio (pugno come nell'originale)
        mat4.translate(T, -0.3 * Math.sin(sq * PI) * 0.6 + hx, 0.4 * Math.sin(sq * 2 * PI) * 0.5 + hy, -0.4 * Math.sin(sw * PI) * 0.6); mul();
        mat4.translate(T, 0.78, -0.8 - equip * 0.5, -0.55); mul();
        mat4.rotY(T, 45 * D); mul();
        mat4.rotY(T, Math.sin(sq * PI) * 30 * D); mul();
        mat4.rotZ(T, -Math.sin(sw * sw * PI) * 20 * D); mul();
        mat4.rotX(T, Math.sin(sq * PI) * 25 * D); mul();
        mat4.rotY(T, -45 * D + 0.42); mul();
        mat4.rotX(T, 1.95); mul();
        mat4.rotY(T, 0.5); mul();
        const arm = MC.mobs.models.player[3];
        const skin = 1000 + MC.mobs.skinIndex['player:default'];
        r.batch.box(M, -0.11, -0.78, -0.11, 0.11, 0.1, 0.11, skin, l, [1, 1, 1, 1], arm.uvs);
        const a = this.inventory.armor[1];
        if (a && MC.blocks[a.id] && MC.blocks[a.id].armor) {
          r.batch.box(M, -0.13, -0.3, -0.13, 0.13, 0.12, 0.13, MC.textures.index['armor_' + MC.blocks[a.id].armor.mat], l, a.ench ? MC.glintCol(performance.now() / 1000) : [1, 1, 1, 1]);
        }
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
