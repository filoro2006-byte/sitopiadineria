// Suoni sintetizzati con WebAudio
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});

  class Audio {
    constructor() {
      this.ctx = null;
      this.volume = 0.6;
      this.noiseBuf = null;
      this.enabled = true;
    }

    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) { this.enabled = false; return; }
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.volume;
          this.master.connect(this.ctx.destination);
          const len = this.ctx.sampleRate * 1;
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { this.enabled = false; }
    }

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.value = v;
    }

    _ok() { return this.enabled && this.ctx && this.ctx.state === 'running' && this.volume > 0; }

    _noise(dur, type, freq, q, vol, attack, pitchEnd) {
      if (!this._ok() || !(vol > 0.0005)) return;
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = c.createBiquadFilter();
      f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
      if (pitchEnd) f.frequency.exponentialRampToValueAtTime(pitchEnd, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    }

    _tone(freq, dur, type, vol, endFreq, delay) {
      if (!this._ok() || !(vol > 0.0005)) return;
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    }

    // materiale -> suono
    _mat(id, kind) {
      const d = MC.blocks[id];
      const s = d ? d.sound : 'stone';
      const k = kind === 'step' ? 0.35 : kind === 'hit' ? 0.25 : 1;
      switch (s) {
        case 'grass': this._noise(0.18 * (k < 1 ? 0.7 : 1), 'bandpass', 1400, 0.7, 0.35 * k); break;
        case 'gravel': this._noise(0.2, 'bandpass', 900, 0.9, 0.4 * k); break;
        case 'sand': this._noise(0.2, 'highpass', 1800, 0.5, 0.25 * k); break;
        case 'wood': this._noise(0.14, 'bandpass', 500, 3, 0.55 * k); this._tone(180 + Math.random() * 40, 0.08, 'triangle', 0.12 * k); break;
        case 'glass':
          if (kind === 'break') { for (let i = 0; i < 4; i++) this._tone(2000 + Math.random() * 2500, 0.15 + Math.random() * 0.2, 'sine', 0.08, null, i * 0.03); this._noise(0.25, 'highpass', 4000, 0.5, 0.2); }
          else this._noise(0.12, 'highpass', 3000, 1, 0.25 * k);
          break;
        case 'wool': this._noise(0.16, 'lowpass', 700, 0.5, 0.35 * k); break;
        case 'snow': this._noise(0.18, 'lowpass', 2500, 0.5, 0.3 * k); break;
        case 'metal': this._noise(0.12, 'bandpass', 2500, 4, 0.3 * k); this._tone(900, 0.15, 'triangle', 0.06 * k); break;
        default: this._noise(0.16, 'bandpass', 1100, 1.4, 0.5 * k); this._noise(0.08, 'lowpass', 400, 1, 0.3 * k); break;
      }
    }

    place(id) { this._mat(id, 'place'); }
    dig(id) { this._mat(id, 'break'); }
    hit(id) { this._mat(id, 'hit'); }
    step(id) { if (id) this._mat(id, 'step'); }
    land(id) { if (id) this._mat(id, 'step'); }
    eat() { this._noise(0.08, 'bandpass', 1800, 2, 0.18); }
    burp() { this._tone(160, 0.25, 'sawtooth', 0.08, 90); }
    bow(v) { v = v === undefined ? 1 : v; this._noise(0.15, 'bandpass', 1400, 1.5, 0.3 * v); this._tone(500, 0.08, 'triangle', 0.08 * v, 250); }
    door(open) { this._noise(0.25, 'bandpass', open ? 600 : 400, 2, 0.35); this._tone(open ? 140 : 110, 0.15, 'triangle', 0.1); }
    hiss(v) { this._noise(1.5, 'highpass', 3500, 0.7, 0.3 * (v || 1), 0.1); }
    pop() { this._tone(700 + Math.random() * 400, 0.08, 'sine', 0.15, 1400); }
    click() { this._tone(900, 0.04, 'square', 0.05, 600); }
    hurt() { this._tone(260, 0.18, 'square', 0.12, 140); this._noise(0.1, 'lowpass', 600, 1, 0.2); }
    splash() { this._noise(0.6, 'lowpass', 3000, 0.7, 0.4, 0.01, 300); }
    swim() { this._noise(0.3, 'lowpass', 1200, 0.7, 0.12, 0.05, 400); }
    fuse() { this._noise(0.9, 'highpass', 3000, 0.5, 0.25, 0.05); }
    explode(dist) {
      const v = Math.max(0.05, 1 - dist / 60);
      this._noise(1.8, 'lowpass', 900, 0.8, 0.9 * v, 0.005, 60);
      this._tone(60, 1.2, 'sine', 0.6 * v, 25);
    }
    // pioggia continua
    setRain(level) {
      if (!this._ok()) return;
      const c = this.ctx;
      if (!this.rainNode) {
        if (level < 0.01) return;
        const src = c.createBufferSource();
        src.buffer = this.noiseBuf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600;
        const g = c.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start();
        this.rainNode = { src, g };
      }
      const target = Math.max(0, Math.min(1, level)) * 0.18;
      this.rainNode.g.gain.setTargetAtTime(target, c.currentTime, 0.5);
    }

    mob(type, hurt, vol) {
      vol = (vol === undefined ? 1 : vol) * (hurt ? 1 : 0.7);
      const r = 0.9 + Math.random() * 0.2;
      switch (type) {
        case 'pig': this._tone(420 * r, 0.12, 'sawtooth', 0.06 * vol, 300 * r); this._tone(380 * r, 0.12, 'sawtooth', 0.05 * vol, 260 * r, 0.14); break;
        case 'cow': this._tone(140 * r, 0.7, 'sawtooth', 0.07 * vol, 110 * r); break;
        case 'sheep': for (let i = 0; i < 5; i++) this._tone((330 + (i % 2) * 20) * r, 0.09, 'sawtooth', 0.05 * vol, null, i * 0.07); break;
        case 'chicken': this._tone(1200 * r, 0.06, 'square', 0.04 * vol, 900 * r); this._tone(1300 * r, 0.06, 'square', 0.04 * vol, 800 * r, 0.1); break;
        case 'zombie': this._tone(110 * r, 0.8, 'sawtooth', 0.08 * vol, 80 * r); this._noise(0.6, 'lowpass', 400, 2, 0.1 * vol); break;
        case 'skeleton': for (let i = 0; i < 4; i++) this._noise(0.05, 'bandpass', 2500 + i * 300, 6, 0.12 * vol); break;
        case 'spider': this._noise(0.3, 'bandpass', 900, 3, 0.12 * vol); this._tone(300 * r, 0.2, 'sawtooth', 0.03 * vol, 200); break;
        case 'creeper': this._noise(0.25, 'lowpass', 800, 1, 0.12 * vol); break;
        case 'villager': this._tone(220 * r, 0.12, 'sawtooth', 0.06 * vol, 170 * r); this._tone(200 * r, 0.18, 'sawtooth', 0.05 * vol, 240 * r, 0.12); break;
        case 'iron_golem': this._noise(0.3, 'lowpass', 300, 1, 0.3 * vol); this._tone(70, 0.3, 'sine', 0.2 * vol, 50); break;
        case 'wolf':
          if (hurt) { this._tone(900 * r, 0.25, 'sawtooth', 0.06 * vol, 500 * r); }
          else { this._tone(520 * r, 0.1, 'sawtooth', 0.06 * vol, 380 * r); this._tone(500 * r, 0.12, 'sawtooth', 0.06 * vol, 340 * r, 0.16); }
          break;
        case 'cat': this._tone(700 * r, 0.12, 'triangle', 0.06 * vol, 900 * r); this._tone(900 * r, 0.35, 'triangle', 0.06 * vol, 520 * r, 0.12); break;
        case 'enderman':
          if (hurt) this._tone(200 * r, 0.5, 'sawtooth', 0.08 * vol, 800 * r);
          else { this._tone(90 * r, 0.6, 'sine', 0.1 * vol, 130 * r); this._noise(0.5, 'bandpass', 600, 4, 0.06 * vol); }
          break;
        case 'cod': this._noise(0.1, 'highpass', 2000, 1, 0.08 * vol); break;
        case 'zombified_piglin': this._tone(160 * r, 0.4, 'sawtooth', 0.08 * vol, 120 * r); this._tone(240 * r, 0.2, 'square', 0.03 * vol, 180 * r, 0.25); break;
        case 'ghast':
          if (hurt) { this._tone(900 * r, 0.6, 'sawtooth', 0.08 * vol, 400 * r); }
          else { this._tone(480 * r, 1.4, 'sine', 0.07 * vol, 360 * r); this._tone(700 * r, 1.1, 'triangle', 0.04 * vol, 520 * r, 0.1); }
          break;
        case 'blaze': this._noise(0.8, 'bandpass', 700, 1.2, 0.12 * vol, 0.1); this._tone(120 * r, 0.5, 'sawtooth', 0.04 * vol, 90); break;
        case 'magma_cube': this._noise(0.12, 'lowpass', 500, 2, 0.25 * vol); this._tone(90 * r, 0.12, 'sine', 0.12 * vol, 60); break;
      }
    }
    // portale, esperienza, incantesimi
    portal(travel) {
      if (travel) { this._tone(180, 1.4, 'sawtooth', 0.05, 520); this._noise(1.2, 'bandpass', 900, 2, 0.12, 0.3, 300); }
      else { this._tone(120, 2.5, 'sine', 0.08, 240); this._noise(2.2, 'bandpass', 500, 3, 0.08, 0.5, 900); }
    }
    orb() { this._tone(1400 + Math.random() * 900, 0.09, 'sine', 0.07); }
    levelup() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.25, 'triangle', 0.08, null, i * 0.09)); }
    enchant() { for (let i = 0; i < 6; i++) this._tone(1200 + Math.random() * 1400, 0.3, 'sine', 0.05, null, i * 0.06); }
    equip() { this._noise(0.18, 'bandpass', 2200, 3, 0.2); this._tone(600, 0.1, 'triangle', 0.06, 800); }
    fireball() { this._noise(0.6, 'lowpass', 1200, 1, 0.3, 0.02, 300); }
    teleport() { this._tone(300, 0.35, 'sine', 0.1, 1200); this._tone(1200, 0.35, 'sine', 0.06, 300, 0.05); }
    tame() { [660, 880, 1100].forEach((f, i) => this._tone(f, 0.14, 'sine', 0.07, null, i * 0.08)); }
  }

  MC.Audio = Audio;
})();
