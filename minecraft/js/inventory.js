// Inventario, ricette e icone
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const B = MC.B;
  const MAX = 64;

  class Inventory {
    constructor() {
      this.slots = new Array(36).fill(null);
      this.selected = 0;
      this.onChange = null;
    }
    get(i) { return this.slots[i]; }
    set(i, s) { this.slots[i] = s && s.count > 0 ? s : null; this._ch(); }
    held() { return this.slots[this.selected]; }
    _ch() { if (this.onChange) this.onChange(); }

    add(id, count) {
      if (!id || count <= 0) return 0;
      // prima gli stack esistenti
      for (let i = 0; i < 36 && count > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < MAX) {
          const n = Math.min(MAX - s.count, count);
          s.count += n; count -= n;
        }
      }
      for (let i = 0; i < 36 && count > 0; i++) {
        if (!this.slots[i]) {
          const n = Math.min(MAX, count);
          this.slots[i] = { id, count: n }; count -= n;
        }
      }
      this._ch();
      return count;
    }
    count(id) {
      let n = 0;
      for (const s of this.slots) if (s && s.id === id) n += s.count;
      return n;
    }
    remove(id, n) {
      for (let i = 35; i >= 0 && n > 0; i--) {
        const s = this.slots[i];
        if (s && s.id === id) {
          const k = Math.min(s.count, n);
          s.count -= k; n -= k;
          if (s.count <= 0) this.slots[i] = null;
        }
      }
      this._ch();
      return n === 0;
    }
    consumeHeld(n) {
      const s = this.slots[this.selected];
      if (!s) return;
      s.count -= n || 1;
      if (s.count <= 0) this.slots[this.selected] = null;
      this._ch();
    }
    serialize() { return { slots: this.slots.map((s) => (s ? [s.id, s.count] : null)), selected: this.selected }; }
    load(d) {
      this.slots = new Array(36).fill(null);
      if (d && d.slots) d.slots.forEach((s, i) => { if (s && i < 36 && MC.blocks[s[0]]) this.slots[i] = { id: s[0], count: s[1] }; });
      this.selected = d && d.selected ? d.selected : 0;
      this._ch();
    }
  }

  // ---------------- Ricette ----------------
  const GROUPS = {
    planks: ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks'],
    logs: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log'],
  };
  const R = [];
  const r = (out, n, ins, st) => R.push({ out: B[out], n, ins: ins.map(([k, c]) => [k, c]), st: st || null });
  for (const w of ['oak', 'birch', 'spruce', 'jungle', 'acacia']) r(w + '_planks', 4, [[w + '_log', 1]]);
  r('crafting_table', 1, [['#planks', 4]]);
  r('torch', 4, [['coal_ore', 1], ['#planks', 1]]);
  r('furnace', 1, [['cobblestone', 8]], 'table');
  r('oak_log_wood', 3, [['oak_log', 4]], 'table');
  r('sandstone', 1, [['sand', 4]]);
  r('red_sandstone', 1, [['red_sand', 4]]);
  r('cut_sandstone', 4, [['sandstone', 4]], 'table');
  r('stone_bricks', 4, [['stone', 4]], 'table');
  r('chiseled_stone_bricks', 1, [['stone_bricks', 2]], 'table');
  r('mossy_stone_bricks', 1, [['stone_bricks', 1], ['moss_block', 1]]);
  r('mossy_cobblestone', 1, [['cobblestone', 1], ['moss_block', 1]]);
  r('polished_andesite', 4, [['andesite', 4]], 'table');
  r('polished_diorite', 4, [['diorite', 4]], 'table');
  r('polished_granite', 4, [['granite', 4]], 'table');
  r('bookshelf', 1, [['#planks', 6], ['sugar_cane', 3]], 'table');
  r('tnt', 1, [['sand', 4], ['coal_ore', 2]], 'table');
  r('jack_o_lantern', 1, [['pumpkin', 1], ['torch', 1]]);
  r('glass', 1, [['sand', 1]], 'furnace');
  r('stone', 1, [['cobblestone', 1]], 'furnace');
  r('smooth_stone', 1, [['stone', 1]], 'furnace');
  r('deepslate', 1, [['cobbled_deepslate', 1]], 'furnace');
  r('terracotta', 1, [['clay', 1]], 'furnace');
  r('bricks', 1, [['clay', 2]], 'furnace');
  r('iron_block', 1, [['iron_ore', 9]], 'furnace');
  r('gold_block', 1, [['gold_ore', 9]], 'furnace');
  r('copper_block', 1, [['copper_ore', 9]], 'furnace');
  r('diamond_block', 1, [['diamond_ore', 9]], 'table');
  r('emerald_block', 1, [['emerald_ore', 9]], 'table');
  r('lapis_block', 1, [['lapis_ore', 9]], 'table');
  r('coal_block', 1, [['coal_ore', 9]], 'table');
  r('redstone_block', 1, [['redstone_ore', 9]], 'table');
  r('snow', 1, [['snowy_grass', 1]]);
  const dyes = [['red', 'poppy'], ['yellow', 'dandelion'], ['blue', 'cornflower'], ['light_blue', 'blue_orchid'], ['magenta', 'allium'], ['pink', 'pink_tulip'], ['light_gray', 'oxeye_daisy'], ['green', 'cactus'], ['brown', 'dirt'], ['black', 'coal_ore'], ['orange', 'pumpkin'], ['lime', 'moss_block']];
  for (const [c, dye] of dyes) r(c + '_wool', 1, [['white_wool', 1], [dye, 1]]);
  for (const [c] of MC.DYE_COLORS) r(c + '_concrete', 8, [['sand', 4], ['gravel', 4], [c + '_wool', 1]], 'table');
  for (const [c] of MC.GLASS_COLORS) {
    if (c === 'white') r('white_stained_glass', 8, [['glass', 8], ['white_wool', 1]], 'table');
    else r(c + '_stained_glass', 8, [['glass', 8], [c + '_wool', 1]], 'table');
  }

  function ingredientCount(inv, key) {
    if (key[0] === '#') return GROUPS[key.slice(1)].reduce((a, k) => a + inv.count(B[k]), 0);
    return inv.count(B[key]);
  }
  function removeIngredient(inv, key, n) {
    if (key[0] === '#') {
      for (const k of GROUPS[key.slice(1)]) {
        const have = inv.count(B[k]);
        const t = Math.min(have, n);
        if (t) { inv.remove(B[k], t); n -= t; }
        if (!n) break;
      }
    } else inv.remove(B[key], n);
  }
  function canCraft(inv, rec, station) {
    if (rec.st === 'table' && station !== 'table' && station !== 'furnace') return false;
    if (rec.st === 'furnace' && station !== 'furnace') return false;
    return rec.ins.every(([k, n]) => ingredientCount(inv, k) >= n);
  }
  function craft(inv, rec) {
    for (const [k, n] of rec.ins) removeIngredient(inv, k, n);
    return { id: rec.out, count: rec.n };
  }
  function ingIcon(key) { return key[0] === '#' ? B[GROUPS[key.slice(1)][0]] : B[key]; }

  // ---------------- Icone ----------------
  const icons = {};
  const S = 16;
  function texCanvas(name, tint, maskTint) {
    const src = MC.textures.cache[name];
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let i = 0; i < src.length; i += 4) {
      let rr = src[i], gg = src[i + 1], bb = src[i + 2], a = src[i + 3];
      if (tint && (!maskTint || a < 250)) {
        rr = (rr * tint[0]) / 255; gg = (gg * tint[1]) / 255; bb = (bb * tint[2]) / 255;
        if (maskTint) a = 255;
      }
      img.data[i] = rr; img.data[i + 1] = gg; img.data[i + 2] = bb; img.data[i + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  const GRASS_T = [124, 189, 88], FOLIAGE_T = [96, 164, 64];

  function makeIcon(id) {
    const d = MC.blocks[id];
    const N = 64;
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tintOf = () => (d.tint === 1 || d.tint === 2 ? GRASS_T : d.tint === 3 ? FOLIAGE_T : d.tint === 4 ? d.tintColor : null);
    if (d.shape === 'cross' || d.shape === 'torch') {
      const t = texCanvas(d.tex.side, d.tint ? tintOf() : null);
      ctx.drawImage(t, 0, 0, S, S, 4, 4, 56, 56);
      return c.toDataURL();
    }
    const tint = tintOf();
    const top = texCanvas(d.tex.top, d.tint && d.tint !== 2 ? tint : d.tint === 2 ? tint : null);
    const side = texCanvas(d.tex.side, d.tint === 2 ? tint : d.tint ? tint : null, d.tint === 2);
    const front = d.tex.front ? texCanvas(d.tex.front) : side;
    const T = [32, 3], Rr = [60, 17], Bm = [32, 31], L = [4, 17];
    const H = 30;
    const face = (img, a, b, cc, dd, e, f, shade) => {
      ctx.save();
      ctx.setTransform(a, b, cc, dd, e, f);
      ctx.drawImage(img, 0, 0);
      if (shade) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(0,0,0,' + shade + ')';
        ctx.fillRect(0, 0, S, S);
      }
      ctx.restore();
    };
    // un piccolo sovradimensionamento chiude le fessure tra le facce
    const k = 1.02;
    face(front, ((Bm[0] - L[0]) / S) * k, ((Bm[1] - L[1]) / S) * k, 0, (H / S) * k, L[0], L[1], 0.22);
    face(side, ((Rr[0] - Bm[0]) / S) * k, ((Rr[1] - Bm[1]) / S) * k, 0, (H / S) * k, Bm[0], Bm[1], 0.42);
    face(top, ((Rr[0] - T[0]) / S) * k, ((Rr[1] - T[1]) / S) * k, ((L[0] - T[0]) / S) * k, ((L[1] - T[1]) / S) * k, T[0], T[1], 0);
    return c.toDataURL();
  }

  function icon(id) {
    if (!icons[id]) {
      try { icons[id] = makeIcon(id); } catch (e) { icons[id] = ''; }
    }
    return icons[id];
  }

  // cuori e bolle in pixel-art
  function pixelIcon(rows, colors) {
    const c = document.createElement('canvas');
    c.width = 9; c.height = 9;
    const ctx = c.getContext('2d');
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = colors[row[x]]; if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } } });
    return c.toDataURL();
  }
  const HEART = ['.kk...kk.', 'krrk.krrk', 'krwrrrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'];
  const HEART_HALF = ['.kk...kk.', 'krrk.kbbk', 'krwrbbbbk', 'krrrbbbbk', 'krrrbbbbk', '.krrbbbk.', '..krbbk..', '...kbk...', '....k....'];
  const HEART_EMPTY = ['.kk...kk.', 'kbbk.kbbk', 'kbbbbbbbk', 'kbbbbbbbk', 'kbbbbbbbk', '.kbbbbbk.', '..kbbbk..', '...kbk...', '....k....'];
  const BUBBLE = ['..kkkkk..', '.kbbbbbk.', 'kbwwbbbbk', 'kbwbbbbbk', 'kbbbbbbbk', 'kbbbbbbbk', '.kbbbbbk.', '..kkkkk..', '.........'];
  const hudIcons = {};
  function hudIcon(name) {
    if (!hudIcons[name]) {
      const cols = { k: '#1a0000', r: '#e01010', w: '#ffb0b0', b: '#3a1010' };
      if (name === 'heart') hudIcons[name] = pixelIcon(HEART, cols);
      if (name === 'half') hudIcons[name] = pixelIcon(HEART_HALF, cols);
      if (name === 'empty') hudIcons[name] = pixelIcon(HEART_EMPTY, cols);
      if (name === 'bubble') hudIcons[name] = pixelIcon(BUBBLE, { k: '#1c2c5c', b: '#4f8ff0', w: '#e8f4ff' });
    }
    return hudIcons[name];
  }

  MC.Inventory = Inventory;
  MC.recipes = { list: R, canCraft, craft, ingredientCount, ingIcon, GROUPS };
  MC.icon = icon;
  MC.hudIcon = hudIcon;
  MC.STACK = MAX;
})();
