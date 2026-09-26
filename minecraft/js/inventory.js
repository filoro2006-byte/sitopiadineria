// Inventario, ricette e icone
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const B = MC.B;
  const MAX = 64;

  const stackOf = (id) => (MC.blocks[id] && MC.blocks[id].stack) || MAX;
  MC.stackOf = stackOf;

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

    add(id, count, dmg) {
      if (!id || count <= 0) return 0;
      const max = stackOf(id);
      // prima gli stack esistenti
      if (max > 1) for (let i = 0; i < 36 && count > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < max) {
          const n = Math.min(max - s.count, count);
          s.count += n; count -= n;
        }
      }
      for (let i = 0; i < 36 && count > 0; i++) {
        if (!this.slots[i]) {
          const n = Math.min(max, count);
          this.slots[i] = { id, count: n };
          if (dmg) this.slots[i].dmg = dmg;
          count -= n;
        }
      }
      this._ch();
      return count;
    }
    // usura dell'attrezzo in mano; restituisce true se si è rotto
    wearHeld(n) {
      const s = this.slots[this.selected];
      if (!s) return false;
      const d = MC.blocks[s.id];
      if (!d || !d.durability) return false;
      s.dmg = (s.dmg || 0) + (n || 1);
      if (s.dmg >= d.durability) { this.slots[this.selected] = null; this._ch(); return true; }
      this._ch();
      return false;
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
    serialize() { return { slots: this.slots.map((s) => (s ? [s.id, s.count, s.dmg || 0] : null)), selected: this.selected }; }
    load(d) {
      this.slots = new Array(36).fill(null);
      if (d && d.slots) d.slots.forEach((s, i) => { if (s && i < 36 && MC.blocks[s[0]]) { this.slots[i] = { id: s[0], count: s[1] }; if (s[2]) this.slots[i].dmg = s[2]; } });
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
  const r = (out, n, ins, st) => { if (B[out] && ins.every(([k]) => k[0] === '#' || B[k])) R.push({ out: B[out], n, ins: ins.map(([k, c]) => [k, c]), st: st || null }); };
  // base
  for (const w of ['oak', 'birch', 'spruce', 'jungle', 'acacia']) r(w + '_planks', 4, [[w + '_log', 1]]);
  r('stick', 4, [['#planks', 2]]);
  r('crafting_table', 1, [['#planks', 4]]);
  r('torch', 4, [['coal', 1], ['stick', 1]]);
  r('furnace', 1, [['cobblestone', 8]], 'table');
  r('chest', 1, [['#planks', 8]], 'table');
  r('ladder', 3, [['stick', 7]], 'table');
  r('oak_fence', 3, [['oak_planks', 4], ['stick', 2]], 'table');
  r('spruce_fence', 3, [['spruce_planks', 4], ['stick', 2]], 'table');
  r('cobblestone_wall', 6, [['cobblestone', 6]], 'table');
  r('glass_pane', 16, [['glass', 6]], 'table');
  r('oak_door', 3, [['oak_planks', 6]], 'table');
  for (const [c] of MC.BED_COLORS) r(c === 'red' ? 'bed' : c + '_bed', 1, [[c + '_wool', 3], ['#planks', 3]], 'table');
  for (const [c] of MC.DYE_COLORS) r(c + '_carpet', 3, [[c + '_wool', 2]]);
  r('oak_fence_gate', 1, [['stick', 4], ['oak_planks', 2]], 'table');
  r('spruce_fence_gate', 1, [['stick', 4], ['spruce_planks', 2]], 'table');
  r('oak_trapdoor', 2, [['oak_planks', 6]], 'table');
  r('lantern', 1, [['torch', 1], ['iron_ingot', 1]], 'table');
  for (const m of ['oak_planks', 'spruce_planks', 'birch_planks', 'cobblestone', 'stone', 'stone_bricks', 'bricks', 'sandstone']) {
    const base = m.replace('_planks', '');
    r(base + '_slab', 6, [[m, 3]], 'table');
    r(base + '_stairs', 4, [[m, 6]], 'table');
  }
  // attrezzi e armi
  const TOOLMAT = [['wooden', '#planks'], ['stone', 'cobblestone'], ['iron', 'iron_ingot'], ['golden', 'gold_ingot'], ['diamond', 'diamond']];
  for (const [t, m] of TOOLMAT) {
    r(t + '_pickaxe', 1, [[m, 3], ['stick', 2]], 'table');
    r(t + '_axe', 1, [[m, 3], ['stick', 2]], 'table');
    r(t + '_shovel', 1, [[m, 1], ['stick', 2]], 'table');
    r(t + '_sword', 1, [[m, 2], ['stick', 1]], 'table');
    r(t + '_hoe', 1, [[m, 2], ['stick', 2]], 'table');
  }
  r('bow', 1, [['stick', 3], ['string', 3]], 'table');
  r('arrow', 4, [['flint', 1], ['stick', 1], ['feather', 1]], 'table');
  r('flint_and_steel', 1, [['iron_ingot', 1], ['flint', 1]]);
  // cibo
  r('bread', 1, [['wheat_item', 3]], 'table');
  r('golden_apple', 1, [['apple', 1], ['gold_ingot', 8]], 'table');
  r('hay_block', 1, [['wheat_item', 9]], 'table');
  r('wheat_item', 9, [['hay_block', 1]]);
  const COOK = [['porkchop', 'cooked_porkchop'], ['beef', 'steak'], ['chicken', 'cooked_chicken'], ['mutton', 'cooked_mutton']];
  for (const [a, b] of COOK) r(b, 1, [[a, 1]], 'furnace');
  // fusione
  r('iron_ingot', 1, [['iron_ore', 1]], 'furnace');
  r('gold_ingot', 1, [['gold_ore', 1]], 'furnace');
  r('copper_ingot', 1, [['copper_ore', 1]], 'furnace');
  r('coal', 1, [['oak_log', 1]], 'furnace');
  r('glass', 1, [['sand', 1]], 'furnace');
  r('stone', 1, [['cobblestone', 1]], 'furnace');
  r('smooth_stone', 1, [['stone', 1]], 'furnace');
  r('deepslate', 1, [['cobbled_deepslate', 1]], 'furnace');
  r('terracotta', 1, [['clay', 1]], 'furnace');
  r('bricks', 1, [['clay', 2]], 'furnace');
  // blocchi di materiali (e ritorno)
  const STORE = [['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['copper_block', 'copper_ingot'], ['diamond_block', 'diamond'], ['emerald_block', 'emerald'], ['lapis_block', 'lapis'], ['coal_block', 'coal'], ['redstone_block', 'redstone']];
  for (const [bl, it] of STORE) { r(bl, 1, [[it, 9]], 'table'); r(it, 9, [[bl, 1]]); }
  // costruzione
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
  r('oak_log_wood', 3, [['oak_log', 4]], 'table');
  r('bookshelf', 1, [['#planks', 6], ['leather', 1], ['sugar_cane', 3]], 'table');
  r('tnt', 1, [['gunpowder', 5], ['sand', 4]], 'table');
  r('jack_o_lantern', 1, [['pumpkin', 1], ['torch', 1]]);
  r('white_wool', 1, [['string', 4]]);
  const dyes = [['red', 'poppy'], ['yellow', 'dandelion'], ['blue', 'cornflower'], ['light_blue', 'blue_orchid'], ['magenta', 'allium'], ['pink', 'pink_tulip'], ['light_gray', 'oxeye_daisy'], ['green', 'cactus'], ['brown', 'dirt'], ['black', 'coal'], ['orange', 'pumpkin'], ['lime', 'moss_block'], ['cyan', 'prismarine'], ['purple', 'lapis'], ['gray', 'gravel']];
  for (const [c, dye] of dyes) r(c + '_wool', 1, [['white_wool', 1], [dye, 1]]);
  for (const [c] of MC.DYE_COLORS) r(c + '_concrete', 8, [['sand', 4], ['gravel', 4], [c + '_wool', 1]], 'table');
  for (const [c] of MC.GLASS_COLORS) r(c + '_stained_glass', 8, [['glass', 8], [c + '_wool', 1]], 'table');

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
    if (d.door) {
      ctx.drawImage(texCanvas('door_top'), 0, 0, S, S, 16, 0, 32, 32);
      ctx.drawImage(texCanvas('door_bottom'), 0, 0, S, S, 16, 32, 32, 32);
      return c.toDataURL();
    }
    if (d.shape === 'cross' || d.shape === 'torch' || d.shape === 'item' || d.shape === 'crop' || d.ladder || d.conn === 'pane') {
      const t = texCanvas(d.tex.side, d.tint ? tintOf() : null);
      ctx.drawImage(t, 0, 0, S, S, 4, 4, 56, 56);
      return c.toDataURL();
    }
    const tint = tintOf();
    const cv = {};
    const tc = (name, tn, mask) => { const k = name + (tn ? ':t' : '') + (mask ? ':m' : ''); if (!cv[k]) cv[k] = texCanvas(name, tn, mask); return cv[k]; };
    const topN = d.tex.top, sideN = d.tex.side, frontN = d.tex.front || d.tex.side;
    // scatole da disegnare: [x0,y0,z0,x1,y1,z1, {f:[nomi per faccia]}]
    let boxes = [[0, 0, 0, 1, 1, 1]];
    if (d.shape === 'model') boxes = d.model(d.facing ? 4 : 0, d.conn ? 3 : 0).map((b) => b.slice());
    if (d.shape === 'cactus') boxes = [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
    if (d.bed) {
      boxes = d.model(2, 0).map((b) => b.slice()).concat(d.model(2 | 4, 0).map((b) => { const c2 = b.slice(); c2[2] += 1; c2[5] += 1; return c2; }));
    }
    // adatta alla cornice
    let mx = 1;
    for (const b of boxes) mx = Math.max(mx, b[3], b[4], b[5]);
    const sc = 1 / mx;
    const P = (x, y, z) => { x *= sc; y *= sc; z *= sc; return [32 + 28 * x - 28 * z, 3 + 14 * x + 14 * z + 30 * (1 - y) + (1 - sc) * 22]; };
    const k = 1.02;
    const face = (img, sx, sy, sw, sh2, o, ua, va, shade) => {
      if (sw <= 0 || sh2 <= 0) return;
      ctx.save();
      ctx.setTransform(((ua[0] - o[0]) / sw) * k, ((ua[1] - o[1]) / sw) * k, ((va[0] - o[0]) / sh2) * k, ((va[1] - o[1]) / sh2) * k, o[0], o[1]);
      ctx.drawImage(img, sx, sy, sw, sh2, 0, 0, sw, sh2);
      if (shade) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(0,0,0,' + shade + ')';
        ctx.fillRect(0, 0, sw, sh2);
      }
      ctx.restore();
    };
    boxes.sort((a, b) => (a[0] + a[2] + a[1]) - (b[0] + b[2] + b[1]));
    for (const b of boxes) {
      const [x0, y0, z0, x1, y1, z1] = b;
      const ov = b[6] && b[6].f;
      const img = (fi, def, tn, mask) => (ov && ov[fi] ? tc(ov[fi]) : tc(def, tn, mask));
      const fr = (v) => v - Math.floor(v);
      const zz0 = fr(z0) === 0 && z0 > 0 ? 0 : fr(z0), zz1 = zz0 + (z1 - z0);
      face(img(4, frontN, d.tint ? tint : null, d.tint === 2), x0 * S, (1 - y1) * S, (x1 - x0) * S, (y1 - y0) * S, P(x0, y1, z1), P(x1, y1, z1), P(x0, y0, z1), 0.22);
      face(img(0, sideN, d.tint ? tint : null, d.tint === 2), (1 - zz1) * S, (1 - y1) * S, (zz1 - zz0) * S, (y1 - y0) * S, P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z1), 0.42);
      face(img(2, topN, d.tint ? tint : null), x0 * S, zz0 * S, (x1 - x0) * S, (zz1 - zz0) * S, P(x0, y1, z0), P(x1, y1, z0), P(x0, y1, z1), 0);
    }
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
  const FOOD = ['....kkkk.', '...kmmmmk', '..kmmlmmk', '..kmmmmmk', '..kmmmmk.', '.kwkmmk..', 'kwwkkk...', '.kwk.....', '..k......'];
  const FOOD_HALF = ['....kkkk.', '...keeeek', '..kmmeeek', '..kmmeeek', '..kmmeek.', '.kwkmek..', 'kwwkkk...', '.kwk.....', '..k......'];
  const FOOD_EMPTY = ['....kkkk.', '...keeeek', '..keeeeek', '..keeeeek', '..keeeek.', '.kekeek..', 'keekkk...', '.kek.....', '..k......'];
  const hudIcons = {};
  function hudIcon(name) {
    if (!hudIcons[name]) {
      const cols = { k: '#1a0000', r: '#e01010', w: '#ffb0b0', b: '#3a1010' };
      if (name === 'heart') hudIcons[name] = pixelIcon(HEART, cols);
      if (name === 'half') hudIcons[name] = pixelIcon(HEART_HALF, cols);
      if (name === 'empty') hudIcons[name] = pixelIcon(HEART_EMPTY, cols);
      if (name === 'bubble') hudIcons[name] = pixelIcon(BUBBLE, { k: '#1c2c5c', b: '#4f8ff0', w: '#e8f4ff' });
      const fc = { k: '#3a1a00', m: '#c46a2a', l: '#eaa566', w: '#f0e8d8', e: '#3a2410' };
      if (name === 'food') hudIcons[name] = pixelIcon(FOOD, fc);
      if (name === 'food_half') hudIcons[name] = pixelIcon(FOOD_HALF, fc);
      if (name === 'food_empty') hudIcons[name] = pixelIcon(FOOD_EMPTY, fc);
    }
    return hudIcons[name];
  }

  MC.Inventory = Inventory;
  MC.recipes = { list: R, canCraft, craft, ingredientCount, ingIcon, GROUPS };
  MC.icon = icon;
  MC.hudIcon = hudIcon;
  MC.STACK = MAX;
})();
