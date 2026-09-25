// Interfaccia utente: HUD, menu, inventario
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const $ = (id) => document.getElementById(id);

  const TABS = [
    ['all', 'Tutti'], ['build', 'Costruzione'], ['nature', 'Natura'], ['ores', 'Minerali'], ['color', 'Colori'], ['deco', 'Decorazione'],
    ['tools', 'Attrezzi'], ['food', 'Cibo'], ['items', 'Materiali'], ['eggs', 'Uova'],
  ];

  function durBar(id, dmg) {
    const d = MC.blocks[id];
    const f = Math.max(0, 1 - dmg / d.durability);
    const bar = document.createElement('span');
    bar.className = 'dur';
    const fill = document.createElement('i');
    fill.style.width = Math.round(f * 100) + '%';
    fill.style.background = 'hsl(' + Math.round(f * 120) + ',90%,45%)';
    bar.appendChild(fill);
    return bar;
  }
  MC.durBar = durBar;

  class UI {
    constructor(game) {
      this.game = game;
      this.screens = ['screen-main', 'screen-new', 'screen-loading', 'screen-pause', 'screen-settings', 'screen-controls', 'screen-death', 'screen-inv', 'screen-trade', 'error-box'];
      this.cursor = null; // {id,count}
      this.tab = 'all';
      this.station = null;
      this.hoverSlot = null;
      this.settingsFrom = 'screen-main';
      this.controlsFrom = 'screen-main';
      this.itemNameTimer = null;
      this.chatLines = [];
      this._initBackground();
      this._bind();
    }

    _initBackground() {
      try {
        const d = MC.textures.cache.dirt;
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(16, 16);
        for (let i = 0; i < d.length; i += 4) { img.data[i] = d[i] * 0.3; img.data[i + 1] = d[i + 1] * 0.3; img.data[i + 2] = d[i + 2] * 0.3; img.data[i + 3] = 255; }
        ctx.putImageData(img, 0, 0);
        const url = c.toDataURL();
        document.querySelectorAll('.dirt-bg').forEach((el) => { el.style.backgroundImage = 'url(' + url + ')'; });
      } catch (e) { /* sfondo opzionale */ }
    }

    show(id) {
      for (const s of this.screens) $(s).classList.toggle('hidden', s !== id);
    }
    hideScreens() { for (const s of this.screens) $(s).classList.add('hidden'); }

    _bind() {
      const g = this.game;
      const click = (id, fn) => $(id).addEventListener('click', (e) => { g.audio.unlock(); g.audio.click(); fn(e); });
      click('btn-new', () => { $('new-seed').value = ''; this.show('screen-new'); $('new-name').focus(); });
      click('btn-new-back', () => this.show('screen-main'));
      click('new-mode', () => {
        const b = $('new-mode');
        b.dataset.value = b.dataset.value === 'creative' ? 'survival' : 'creative';
        b.textContent = 'Modalità: ' + (b.dataset.value === 'creative' ? 'Creativa' : 'Sopravvivenza');
      });
      click('new-type', () => {
        const b = $('new-type');
        b.dataset.value = b.dataset.value === 'normal' ? 'flat' : 'normal';
        b.textContent = 'Mondo: ' + (b.dataset.value === 'normal' ? 'Normale' : 'Superpiatto');
      });
      click('btn-create', () => {
        g.createWorld($('new-name').value.trim() || 'Nuovo mondo', $('new-seed').value, $('new-mode').dataset.value, $('new-type').dataset.value);
      });
      click('btn-resume', () => g.resume());
      click('btn-quit', () => g.quitToMenu());
      click('btn-settings', () => { this.settingsFrom = 'screen-pause'; this.openSettings(); });
      click('btn-settings-main', () => { this.settingsFrom = 'screen-main'; this.openSettings(); });
      click('btn-settings-back', () => { g.saveSettings(); this.show(this.settingsFrom); });
      click('btn-controls', () => { this.controlsFrom = 'screen-main'; this.show('screen-controls'); });
      click('btn-controls2', () => { this.controlsFrom = 'screen-pause'; this.show('screen-controls'); });
      click('btn-controls-back', () => this.show(this.controlsFrom));
      click('btn-respawn', () => g.respawn());
      click('btn-death-quit', () => g.quitToMenu());
      $('click-to-play').addEventListener('click', () => { g.audio.unlock(); g.lockPointer(); });

      // impostazioni
      const S = g.settings;
      const range = (id, key, fmt, apply) => {
        const el = $(id), lbl = $('v-' + id.slice(2));
        const upd = () => { lbl.textContent = fmt(S[key]); };
        el.addEventListener('input', () => { S[key] = +el.value; upd(); if (apply) apply(); });
        this['_upd_' + key] = () => { el.value = S[key]; upd(); };
      };
      range('s-dist', 'renderDist', (v) => v + ' chunk', () => g.applySettings());
      range('s-fov', 'fov', (v) => v + '°');
      range('s-sens', 'sens', (v) => v + '%');
      range('s-vol', 'volume', (v) => v + '%', () => g.audio.setVolume(S.volume / 100));
      range('s-bright', 'bright', (v) => (v < 5 ? 'Cupa' : v > 95 ? 'Luminosa' : v + '%'));
      range('s-scale', 'scale', (v) => v + '%', () => g.applySettings());
      const toggle = (id, key, label, on, off, apply) => {
        const el = $(id);
        const upd = () => { el.textContent = label + ': ' + (S[key] ? on : off); };
        el.addEventListener('click', () => { S[key] = !S[key]; upd(); g.audio.click(); if (apply) apply(); });
        this['_upd_' + key] = upd;
      };
      toggle('s-leaves', 'fancyLeaves', 'Foglie', 'Dettagliate', 'Veloci', () => g.applySettings(true));
      toggle('s-clouds', 'clouds', 'Nuvole', 'Sì', 'No');
      toggle('s-bob', 'bob', 'Oscillazione visuale', 'Sì', 'No');
      toggle('s-mobs', 'mobs', 'Creature', 'Sì', 'No');
      toggle('s-invert', 'invert', 'Inverti mouse', 'Sì', 'No');
      toggle('s-weather', 'weather', 'Meteo', 'Sì', 'No');
      toggle('s-autojump', 'autoJump', 'Salto automatico', 'Sì', 'No');
      toggle('s-shaders', 'shaders', 'Shader', 'Sì', 'No');
      toggle('s-shadows', 'shadows', 'Ombre', 'Sì', 'No');

      // inventario
      $('inv-search').addEventListener('input', () => this._renderCreative());
      $('inv-search').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.game.closeInventory(); });
      document.addEventListener('mousemove', (e) => {
        const ci = $('cursor-item');
        ci.style.left = e.clientX + 'px'; ci.style.top = e.clientY + 'px';
        const tt = $('tooltip');
        tt.style.left = e.clientX + 14 + 'px'; tt.style.top = e.clientY - 30 + 'px';
      });
      $('screen-inv').addEventListener('mousedown', (e) => {
        if (e.target === $('screen-inv')) {
          // clic fuori dal pannello: getta l'oggetto nel cursore
          if (this.cursor) {
            if (g.player.mode === 'survival') g.throwStack(this.cursor.id, e.button === 2 ? 1 : this.cursor.count);
            if (e.button === 2 && this.cursor.count > 1 && g.player.mode === 'survival') this.cursor.count--;
            else this.cursor = null;
            this._renderCursor();
          }
        }
      });
      $('screen-inv').addEventListener('contextmenu', (e) => e.preventDefault());

      // chat
      $('chat-input').addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { const v = $('chat-input').value; this.closeChat(); if (v.trim()) g.command(v.trim()); }
        else if (e.key === 'Escape') { this.closeChat(); }
      });
    }

    openSettings() {
      for (const k of Object.keys(this.game.settings)) if (this['_upd_' + k]) this['_upd_' + k]();
      this.show('screen-settings');
    }

    // ---------------- Lista mondi ----------------
    renderWorldList(worlds) {
      const el = $('world-list');
      el.innerHTML = '';
      for (const w of worlds) {
        const row = document.createElement('div');
        row.className = 'world-item';
        const play = document.createElement('button');
        play.className = 'btn play';
        const date = new Date(w.lastPlayed || w.created || Date.now());
        play.innerHTML = '';
        const t = document.createElement('span'); t.textContent = w.name;
        const m = document.createElement('span'); m.className = 'world-meta';
        m.textContent = (w.mode === 'survival' ? 'Sopravvivenza' : 'Creativa') + (w.type === 'flat' ? ' · Superpiatto' : '') + ' · ' + date.toLocaleDateString('it-IT') + ' ' + date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        play.appendChild(t); play.appendChild(m);
        play.addEventListener('click', () => { this.game.audio.unlock(); this.game.audio.click(); this.game.openWorld(w); });
        const del = document.createElement('button');
        del.className = 'btn del danger';
        del.textContent = '✕';
        del.title = 'Elimina mondo';
        del.addEventListener('click', async () => {
          // conferma con un secondo clic (i popup nativi possono essere bloccati)
          if (!del.dataset.armed) {
            del.dataset.armed = '1';
            del.textContent = 'Sicuro?';
            del.style.width = '96px';
            setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = '✕'; del.style.width = ''; } }, 3000);
            return;
          }
          await this.game.storage.deleteWorld(w.id);
          this.renderWorldList(await this.game.storage.listWorlds());
        });
        row.appendChild(play); row.appendChild(del);
        el.appendChild(row);
      }
    }

    setLoading(frac, sub) {
      $('loading-bar').style.width = Math.round(frac * 100) + '%';
      $('loading-sub').textContent = sub || '';
    }

    // ---------------- HUD ----------------
    showHUD(v) { $('hud').classList.toggle('hidden', !v); }

    buildHotbar() {
      const hb = $('hotbar');
      hb.innerHTML = '';
      this.hotEls = [];
      for (let i = 0; i < 9; i++) {
        const s = document.createElement('div');
        s.className = 'hslot';
        const img = document.createElement('img');
        img.alt = '';
        const cnt = document.createElement('span');
        cnt.className = 'count';
        s.appendChild(img); s.appendChild(cnt);
        hb.appendChild(s);
        this.hotEls.push({ s, img, cnt, id: -1, n: -1 });
      }
    }

    updateHotbar() {
      if (!this.hotEls) this.buildHotbar();
      const inv = this.game.inventory;
      for (let i = 0; i < 9; i++) {
        const e = this.hotEls[i];
        const st = inv.slots[i];
        const id = st ? st.id : 0, n = st ? st.count : 0;
        if (e.id !== id) { e.id = id; if (id) { e.img.src = MC.icon(id); e.img.style.visibility = 'visible'; } else e.img.style.visibility = 'hidden'; }
        if (e.n !== n) { e.n = n; e.cnt.textContent = n > 1 && this.game.player.mode === 'survival' ? n : ''; }
        const dm = st && st.dmg ? st.dmg : 0;
        if (e.dm !== dm) { e.dm = dm; if (e.bar) { e.bar.remove(); e.bar = null; } if (dm) { e.bar = durBar(id, dm); e.s.appendChild(e.bar); } }
        e.s.classList.toggle('sel', i === inv.selected);
      }
    }

    showItemName() {
      const st = this.game.inventory.held();
      const el = $('item-name');
      el.textContent = st ? MC.blocks[st.id].name : '';
      el.classList.add('show');
      clearTimeout(this.itemNameTimer);
      this.itemNameTimer = setTimeout(() => el.classList.remove('show'), 1500);
    }

    updateBars() {
      const p = this.game.player;
      const hearts = $('hearts'), bub = $('bubbles');
      if (p.mode !== 'survival') {
        if (hearts.childNodes.length) { hearts.innerHTML = ''; bub.innerHTML = ''; document.getElementById('hunger').innerHTML = ''; this._lastBars = ''; }
        return;
      }
      const hp = Math.ceil(p.health);
      const air = p.eyeInWater || p.air < 300 ? Math.ceil(p.air / 30) : -1;
      const fd = Math.ceil(p.food);
      const key = hp + ':' + air + ':' + fd;
      if (key === this._lastBars) return;
      this._lastBars = key;
      hearts.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const img = document.createElement('img');
        const v = hp - i * 2;
        img.src = MC.hudIcon(v >= 2 ? 'heart' : v === 1 ? 'half' : 'empty');
        hearts.appendChild(img);
      }
      bub.innerHTML = '';
      if (air >= 0) for (let i = 0; i < air; i++) { const img = document.createElement('img'); img.src = MC.hudIcon('bubble'); bub.appendChild(img); }
      const hu = document.getElementById('hunger');
      hu.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const img = document.createElement('img');
        const v = fd - i * 2;
        img.src = MC.hudIcon(v >= 2 ? 'food' : v === 1 ? 'food_half' : 'food_empty');
        hu.appendChild(img);
      }
    }

    setDebug(txt) { $('debug').textContent = txt; }
    toggleDebug() { $('debug').classList.toggle('hidden'); return !$('debug').classList.contains('hidden'); }

    chat(msg) {
      const log = $('chat-log');
      const d = document.createElement('div');
      d.className = 'chat-line';
      d.textContent = msg;
      log.appendChild(d);
      while (log.childNodes.length > 8) log.removeChild(log.firstChild);
      setTimeout(() => { d.style.opacity = '0'; }, 7000);
      setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 8200);
    }

    openChat(prefix) {
      $('chat-box').classList.remove('hidden');
      const inp = $('chat-input');
      inp.value = prefix || '';
      setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
    }
    closeChat() {
      $('chat-box').classList.add('hidden');
      $('chat-input').blur();
      this.game.onChatClosed();
    }

    setFx(water, lava, hurt) {
      $('fx-water').style.opacity = water ? '1' : '0';
      $('fx-lava').style.opacity = lava ? '1' : '0';
      $('fx-hurt').style.opacity = hurt > 0 ? String(Math.min(1, hurt * 2)) : '0';
    }

    // ---------------- Inventario ----------------
    openInventory(station, chest) {
      this.station = station || null;
      this.chest = chest || null;
      const creative = this.game.player.mode === 'creative' && !chest;
      $('inv-creative').classList.toggle('hidden', !creative);
      $('inv-survival').classList.toggle('hidden', creative);
      $('inv-chest').classList.toggle('hidden', !chest);
      document.querySelector('.craft-col').classList.toggle('hidden', !!chest);
      $('craft-label').textContent = station === 'furnace' ? 'Fornace e creazione' : station === 'table' ? 'Banco da lavoro' : 'Creazione';
      $('inv-hint').textContent = creative
        ? 'Clic: prendi 64 · Clic destro: prendi 1 · Maiusc+clic: metti nella barra · Tasti 1-9 sopra un blocco: assegna allo slot'
        : 'Clic: prendi/posa · Clic destro: metà/uno · Maiusc+clic: sposta · Clic su ricetta: crea (Maiusc = tutte)';
      this.show('screen-inv');
      if (creative) { this._renderTabs(); this._renderCreative(); $('inv-search').value = ''; }
      this.renderInventory();
    }

    closeInventory() {
      this.chest = null;
      if (this.cursor) {
        if (this.game.player.mode === 'survival') {
          const left = this.game.inventory.add(this.cursor.id, this.cursor.count);
          if (left) this.game.throwStack(this.cursor.id, left);
        }
        this.cursor = null;
        this._renderCursor();
      }
      $('tooltip').classList.add('hidden');
      this.hideScreens();
    }

    _renderTabs() {
      const el = $('inv-tabs');
      el.innerHTML = '';
      for (const [k, n] of TABS) {
        const t = document.createElement('div');
        t.className = 'tab' + (this.tab === k ? ' active' : '');
        t.textContent = n;
        t.addEventListener('mousedown', (e) => { e.stopPropagation(); this.tab = k; $('inv-search').value = ''; this._renderTabs(); this._renderCreative(); });
        el.appendChild(t);
      }
    }

    _renderCreative() {
      const el = $('inv-grid');
      el.innerHTML = '';
      const q = $('inv-search').value.trim().toLowerCase();
      for (const d of MC.defs) {
        if (!d.creative || !d.tex) continue;
        if (q) { if (!d.name.toLowerCase().includes(q) && !d.key.includes(q)) continue; }
        else if (this.tab !== 'all' && d.cat !== this.tab) continue;
        const s = this._slotEl(d.id, 0);
        s.addEventListener('mousedown', (e) => {
          e.preventDefault(); e.stopPropagation();
          if (this.cursor) { this.cursor = null; }
          else if (e.shiftKey) {
            const inv = this.game.inventory;
            let idx = inv.slots.slice(0, 9).findIndex((x) => !x);
            if (idx < 0) idx = inv.selected;
            inv.set(idx, { id: d.id, count: MC.stackOf(d.id) });
          } else this.cursor = { id: d.id, count: e.button === 2 ? 1 : MC.stackOf(d.id) };
          this._renderCursor();
          this.renderInventory();
        });
        s.addEventListener('mouseenter', () => { this.hoverSlot = { creative: d.id }; this._tip(d.name); });
        s.addEventListener('mouseleave', () => { this.hoverSlot = null; this._tip(null); });
        el.appendChild(s);
      }
    }

    _slotEl(id, count, dmg) {
      const s = document.createElement('div');
      s.className = 'slot';
      if (id) {
        const img = document.createElement('img');
        img.src = MC.icon(id);
        img.alt = '';
        s.appendChild(img);
        if (count > 1) { const c = document.createElement('span'); c.className = 'count'; c.textContent = count; s.appendChild(c); }
        if (dmg) s.appendChild(durBar(id, dmg));
      }
      return s;
    }

    _tip(text) {
      const tt = $('tooltip');
      if (!text) { tt.classList.add('hidden'); return; }
      tt.textContent = text;
      tt.classList.remove('hidden');
    }

    _renderCursor() {
      const el = $('cursor-item');
      el.innerHTML = '';
      if (!this.cursor) return;
      const img = document.createElement('img');
      img.src = MC.icon(this.cursor.id);
      el.appendChild(img);
      if (this.cursor.count > 1 && this.game.player.mode === 'survival') {
        const c = document.createElement('span'); c.className = 'count'; c.textContent = this.cursor.count; el.appendChild(c);
      }
    }

    renderInventory() {
      const inv = this.game.inventory;
      const creative = this.game.player.mode === 'creative' && !this.chest;
      if (this.chest) {
        const cg = $('chest-grid');
        cg.innerHTML = '';
        for (let i = 0; i < 27; i++) {
          const st = this.chest[i];
          const el = this._slotEl(st ? st.id : 0, st ? st.count : 0, st ? st.dmg : 0);
          el.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); this._containerClick(this.chest, i, e.button, e.shiftKey, true); });
          el.addEventListener('mouseenter', () => { const x = this.chest[i]; this._tip(x ? MC.blocks[x.id].name : null); });
          el.addEventListener('mouseleave', () => this._tip(null));
          cg.appendChild(el);
        }
      }
      const hb = $('inv-hotbar');
      hb.innerHTML = '';
      for (let i = 0; i < 9; i++) hb.appendChild(this._invSlot(i, creative));
      if (!creative) {
        const mn = $('inv-main');
        mn.innerHTML = '';
        for (let i = 9; i < 36; i++) mn.appendChild(this._invSlot(i, creative));
        this._renderRecipes();
      }
      this.updateHotbar();
    }

    _invSlot(i, creative) {
      creative = creative && !this.chest;
      const inv = this.game.inventory;
      const st = inv.slots[i];
      const s = this._slotEl(st ? st.id : 0, creative ? 0 : st ? st.count : 0, st ? st.dmg : 0);
      if (i === inv.selected) s.classList.add('selected');
      s.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); this._slotClick(i, e.button, e.shiftKey); });
      s.addEventListener('mouseenter', () => { this.hoverSlot = { inv: i }; const x = inv.slots[i]; this._tip(x ? MC.blocks[x.id].name : null); });
      s.addEventListener('mouseleave', () => { this.hoverSlot = null; this._tip(null); });
      return s;
    }

    _containerClick(arr, i, button, shift) {
      const inv = this.game.inventory;
      const st = arr[i];
      const cur = this.cursor;
      const max = (id) => MC.stackOf(id);
      if (shift && !cur && st) {
        const left = inv.add(st.id, st.count, st.dmg);
        if (left) st.count = left; else arr[i] = null;
      } else if (!cur) {
        if (st) {
          if (button === 2) { const half = Math.ceil(st.count / 2); this.cursor = { id: st.id, count: half, dmg: st.dmg }; st.count -= half; if (st.count <= 0) arr[i] = null; }
          else { this.cursor = st; arr[i] = null; }
        }
      } else if (!st) {
        if (button === 2) { arr[i] = { id: cur.id, count: 1, dmg: cur.dmg }; cur.count--; if (cur.count <= 0) this.cursor = null; }
        else { arr[i] = cur; this.cursor = null; }
      } else if (st.id === cur.id && max(st.id) > 1) {
        const m = Math.min(max(st.id) - st.count, button === 2 ? 1 : cur.count);
        st.count += m; cur.count -= m; if (cur.count <= 0) this.cursor = null;
      } else { arr[i] = cur; this.cursor = st; }
      this._renderCursor();
      this.renderInventory();
      this.game.chestChanged();
    }

    // mostra gli scambi di un villico
    openTrade(m) {
      this.trader = m;
      $('trade-title').textContent = 'Scambi · ' + (m.name || 'Villico');
      this.show('screen-trade');
      this._renderTrades();
    }
    _renderTrades() {
      const m = this.trader, inv = this.game.inventory;
      const el = $('trade-list');
      el.innerHTML = '';
      for (const t of m.trades) {
        const ok = t.ins.every(([id, n]) => inv.count(id) >= n) || this.game.player.mode === 'creative';
        const row = document.createElement('div');
        row.className = 'trade' + (ok ? '' : ' off');
        for (const [id, n] of t.ins) {
          const img = document.createElement('img'); img.src = MC.icon(id); row.appendChild(img);
          const c = document.createElement('span'); c.className = 'n'; c.textContent = '×' + n; row.appendChild(c);
        }
        const ar = document.createElement('span'); ar.className = 'arrow'; ar.textContent = '→'; row.appendChild(ar);
        const img = document.createElement('img'); img.src = MC.icon(t.out[0]); row.appendChild(img);
        const c = document.createElement('span'); c.className = 'n'; c.textContent = '×' + t.out[1] + ' ' + MC.blocks[t.out[0]].name; row.appendChild(c);
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (!t.ins.every(([id, n]) => inv.count(id) >= n) && this.game.player.mode !== 'creative') return;
          if (this.game.player.mode !== 'creative') for (const [id, n] of t.ins) inv.remove(id, n);
          const left = inv.add(t.out[0], t.out[1]);
          if (left) this.game.throwStack(t.out[0], left);
          this.game.audio.mob('villager', false, 0.8);
          this._renderTrades();
        });
        el.appendChild(row);
      }
    }

    _slotClick(i, button, shift) {
      const inv = this.game.inventory;
      const creative = this.game.player.mode === 'creative' && !this.chest;
      const st = inv.slots[i];
      const cur = this.cursor;
      if (shift && !cur && st && this.chest) {
        let n = st.count;
        for (let k = 0; k < 27 && n > 0; k++) { const o = this.chest[k]; if (o && o.id === st.id && o.count < MC.stackOf(st.id)) { const m = Math.min(MC.stackOf(st.id) - o.count, n); o.count += m; n -= m; } }
        for (let k = 0; k < 27 && n > 0; k++) if (!this.chest[k]) { this.chest[k] = { id: st.id, count: n, dmg: st.dmg }; n = 0; }
        if (n > 0) st.count = n; else inv.slots[i] = null;
        inv._ch();
        this.game.chestChanged();
      } else if (shift && !cur && st) {
        if (creative) { inv.set(i, null); }
        else {
          // sposta tra barra rapida e inventario
          const range = i < 9 ? [9, 36] : [0, 9];
          let n = st.count;
          for (let k = range[0]; k < range[1] && n > 0; k++) {
            const o = inv.slots[k];
            if (o && o.id === st.id && o.count < MC.stackOf(st.id)) { const m = Math.min(MC.stackOf(st.id) - o.count, n); o.count += m; n -= m; }
          }
          for (let k = range[0]; k < range[1] && n > 0; k++) {
            if (!inv.slots[k]) { inv.slots[k] = { id: st.id, count: n }; n = 0; }
          }
          if (n > 0) st.count = n; else inv.slots[i] = null;
          inv._ch();
        }
      } else if (!cur) {
        if (st) {
          if (button === 2 && !creative) {
            const half = Math.ceil(st.count / 2);
            this.cursor = { id: st.id, count: half };
            st.count -= half;
            if (st.count <= 0) inv.slots[i] = null;
          } else { this.cursor = { id: st.id, count: st.count }; inv.slots[i] = null; }
        }
      } else {
        if (!st) {
          if (button === 2) { inv.slots[i] = { id: cur.id, count: 1 }; cur.count--; if (cur.count <= 0) this.cursor = null; }
          else { inv.slots[i] = cur; this.cursor = null; }
        } else if (st.id === cur.id) {
          if (creative) { this.cursor = null; }
          else if (button === 2) { if (st.count < MC.stackOf(st.id)) { st.count++; cur.count--; if (cur.count <= 0) this.cursor = null; } }
          else { const m = Math.min(MC.stackOf(st.id) - st.count, cur.count); st.count += m; cur.count -= m; if (cur.count <= 0) this.cursor = null; }
        } else {
          inv.slots[i] = cur; this.cursor = st;
        }
      }
      if (i < 9 && !creative) inv.selected = inv.selected; // mantiene la selezione
      inv._ch();
      this._renderCursor();
      this.renderInventory();
    }

    // tasto numerico sopra uno slot
    numberKey(n) {
      const inv = this.game.inventory;
      const h = this.hoverSlot;
      if (!h) { inv.selected = n; this.renderInventory(); return; }
      if (h.creative !== undefined) inv.set(n, { id: h.creative, count: MC.stackOf(h.creative) });
      else if (h.inv !== undefined && h.inv !== n) {
        const a = inv.slots[h.inv];
        inv.slots[h.inv] = inv.slots[n];
        inv.slots[n] = a;
        inv._ch();
      }
      this.renderInventory();
    }

    _renderRecipes() {
      const el = $('craft-list');
      el.innerHTML = '';
      const inv = this.game.inventory;
      const list = MC.recipes.list.map((r) => ({ r, ok: MC.recipes.canCraft(inv, r, this.station) }));
      list.sort((a, b) => (b.ok ? 1 : 0) - (a.ok ? 1 : 0));
      for (const { r, ok } of list) {
        const row = document.createElement('div');
        row.className = 'recipe' + (ok ? '' : ' off');
        for (const [k, n] of r.ins) {
          const img = document.createElement('img'); img.src = MC.icon(MC.recipes.ingIcon(k)); row.appendChild(img);
          const c = document.createElement('span'); c.className = 'n'; c.textContent = '×' + n; row.appendChild(c);
        }
        const ar = document.createElement('span'); ar.className = 'arrow'; ar.textContent = '→'; row.appendChild(ar);
        const img = document.createElement('img'); img.src = MC.icon(r.out); row.appendChild(img);
        const c = document.createElement('span'); c.className = 'n'; c.textContent = '×' + r.n; row.appendChild(c);
        if (r.st) { const nd = document.createElement('span'); nd.className = 'need'; nd.textContent = r.st === 'table' ? 'banco' : 'fornace'; row.appendChild(nd); }
        row.addEventListener('mouseenter', () => this._tip(MC.blocks[r.out].name + (r.ins.some(([k]) => k[0] === '#') ? ' (assi di qualsiasi legno)' : '')));
        row.addEventListener('mouseleave', () => this._tip(null));
        row.addEventListener('mousedown', (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!MC.recipes.canCraft(inv, r, this.station)) return;
          let times = e.shiftKey ? 64 : 1;
          while (times-- > 0 && MC.recipes.canCraft(inv, r, this.station)) {
            const out = MC.recipes.craft(inv, r);
            const left = inv.add(out.id, out.count);
            if (left) this.game.throwStack(out.id, left);
          }
          this.game.audio.pop();
          this.renderInventory();
        });
        el.appendChild(row);
      }
    }

    showDeath(msg) {
      $('death-msg').textContent = msg;
      this.show('screen-death');
    }

    showError(msg) {
      $('error-msg').textContent = msg;
      this.show('error-box');
    }
  }

  MC.UI = UI;
})();
