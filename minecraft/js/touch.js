// Controlli touch (iPhone / iPad / tablet)
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});

  class Touch {
    constructor(game) {
      this.game = game;
      this.active = false;
      this.stick = null; // {id, cx, cy}
      this.look = null; // {id, x, y, t0, sx, sy, moved, holdTimer, breaking}
      this.move = { fw: 0, st: 0 };
      this.el = document.getElementById('touch');
      this.knob = document.getElementById('t-knob');
      this.base = document.getElementById('t-stick');
      const c = game.canvas;
      c.addEventListener('touchstart', (e) => this._start(e), { passive: false });
      c.addEventListener('touchmove', (e) => this._move(e), { passive: false });
      c.addEventListener('touchend', (e) => this._end(e), { passive: false });
      c.addEventListener('touchcancel', (e) => this._end(e), { passive: false });
      this._btn('t-jump', () => this._keyDown('Space'), () => game.keys.delete('Space'));
      this._btn('t-sneak', () => game.keys.add('ShiftLeft'), () => game.keys.delete('ShiftLeft'));
      this._btn('t-inv', () => { if (game.state === 'playing') game.openInventory(null); else if (game.state === 'inventory') game.closeInventory(); });
      this._btn('t-pause', () => { if (game.state === 'playing') game.pause(); });
      this._btn('t-drop', () => { if (game.state === 'playing') game.dropHeld(false); });
      this._btn('t-break', () => { game.mouse.left = true; game.breakCd = 0; }, () => { game.mouse.left = false; game.breaking = null; });
      document.getElementById('hotbar').addEventListener('touchstart', (e) => {
        const slot = e.target.closest('.hslot');
        if (!slot) return;
        e.preventDefault();
        const i = [...slot.parentNode.children].indexOf(slot);
        game.inventory.selected = i;
        game._selChanged();
      }, { passive: false });
    }

    static isTouchDevice() {
      return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    }

    enable() {
      if (this.active) return;
      this.active = true;
      document.body.classList.add('touch-mode');
      this.game.touchMode = true;
      document.getElementById('click-to-play').classList.add('hidden');
    }

    show(v) { this.el.classList.toggle('hidden', !v || !this.active); }

    _btn(id, down, up) {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.enable(); this.game.audio.unlock(); b.classList.add('down'); down(); }, { passive: false });
      const end = (e) => { e.preventDefault(); b.classList.remove('down'); if (up) up(); };
      b.addEventListener('touchend', end, { passive: false });
      b.addEventListener('touchcancel', end, { passive: false });
    }

    _keyDown(code) {
      const g = this.game;
      if (g.state !== 'playing') return;
      const now = performance.now();
      if (code === 'Space') {
        if (now - g.lastSpace < 300 && g.player.mode === 'creative') { g.player.flying = !g.player.flying; g.player.vy = 0; g.lastSpace = 0; }
        else g.lastSpace = now;
      }
      g.keys.add(code);
    }

    _start(e) {
      this.enable();
      this.game.audio.unlock();
      if (this.game.state !== 'playing') return;
      e.preventDefault();
      const w = window.innerWidth;
      for (const t of e.changedTouches) {
        if (t.clientX < w * 0.4 && !this.stick) {
          this.stick = { id: t.identifier, cx: t.clientX, cy: t.clientY };
          this.base.style.left = t.clientX + 'px';
          this.base.style.top = t.clientY + 'px';
          this.base.classList.add('on');
          this.knob.style.transform = 'translate(-50%, -50%)';
        } else if (!this.look) {
          const lk = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now(), moved: false, breaking: false };
          lk.holdTimer = setTimeout(() => {
            if (!lk.moved && this.look === lk) { lk.breaking = true; this.game.mouse.left = true; this.game.breakCd = 0; }
          }, 320);
          this.look = lk;
        }
      }
    }

    _move(e) {
      if (!this.active) return;
      e.preventDefault();
      const g = this.game;
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          let dx = t.clientX - this.stick.cx, dy = t.clientY - this.stick.cy;
          const R = 55, d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          this.knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
          this.move.st = dx / R; this.move.fw = -dy / R;
        } else if (this.look && t.identifier === this.look.id) {
          const dx = t.clientX - this.look.x, dy = t.clientY - this.look.y;
          this.look.x = t.clientX; this.look.y = t.clientY;
          if (Math.hypot(t.clientX - this.look.sx, t.clientY - this.look.sy) > 12) this.look.moved = true;
          if (g.state === 'playing') {
            const k = 0.006 * (g.settings.sens / 100);
            g.player.yaw -= dx * k;
            g.player.pitch -= dy * k * (g.settings.invert ? -1 : 1);
            const lim = Math.PI / 2 - 0.001;
            g.player.pitch = Math.max(-lim, Math.min(lim, g.player.pitch));
          }
        }
      }
    }

    _end(e) {
      if (!this.active) return;
      e.preventDefault();
      const g = this.game;
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          this.stick = null;
          this.move.fw = 0; this.move.st = 0;
          this.base.classList.remove('on');
        } else if (this.look && t.identifier === this.look.id) {
          const lk = this.look;
          clearTimeout(lk.holdTimer);
          if (lk.breaking) { g.mouse.left = false; g.breaking = null; }
          else if (!lk.moved && performance.now() - lk.t0 < 320 && g.state === 'playing') {
            // tocco breve: usa / piazza (o attacca una creatura)
            const p = g.player, eye = p.eye, d = p.dir();
            const mh = g.entities.raycastMobs(eye[0], eye[1], eye[2], d[0], d[1], d[2], 3.5);
            if (mh && (!g.target || mh.t < g.target.t)) { g.entities.hitMob(mh.mob, 4, p.x, p.z); g.swing = 1; }
            else g._use(g.target);
          }
          this.look = null;
        }
      }
    }

    input() {
      return this.move;
    }

    reset() {
      this.stick = null; this.look = null; this.move.fw = 0; this.move.st = 0;
      if (this.base) this.base.classList.remove('on');
    }
  }

  MC.Touch = Touch;
})();
