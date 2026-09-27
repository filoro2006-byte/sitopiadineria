// Incantesimi, esperienza e armature
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});

  // t: tipi di oggetto compatibili, w: peso, s: passo di potere tra un livello e il successivo
  const ENCH = {
    protection: { name: 'Protezione', max: 4, t: ['armor'], w: 10, s: 11 },
    feather_falling: { name: 'Caduta leggera', max: 4, t: ['boots'], w: 5, s: 6 },
    respiration: { name: 'Respirazione', max: 3, t: ['helmet'], w: 2, s: 10 },
    sharpness: { name: 'Affilatezza', max: 5, t: ['sword', 'axe'], w: 10, s: 11 },
    knockback: { name: 'Contraccolpo', max: 2, t: ['sword'], w: 5, s: 20 },
    fire_aspect: { name: 'Aspetto di fuoco', max: 2, t: ['sword'], w: 2, s: 20 },
    looting: { name: 'Saccheggio', max: 3, t: ['sword'], w: 2, s: 9 },
    efficiency: { name: 'Efficienza', max: 5, t: ['pickaxe', 'axe', 'shovel', 'hoe'], w: 10, s: 10 },
    silk_touch: { name: 'Tocco di velluto', max: 1, t: ['pickaxe', 'axe', 'shovel'], w: 1, s: 15, no: ['fortune'] },
    fortune: { name: 'Fortuna', max: 3, t: ['pickaxe', 'axe', 'shovel'], w: 2, s: 9, no: ['silk_touch'] },
    unbreaking: { name: 'Indistruttibilità', max: 3, t: ['tool', 'armor', 'bow'], w: 5, s: 8 },
    power: { name: 'Potenza', max: 5, t: ['bow'], w: 10, s: 10 },
    punch: { name: 'Colpo', max: 2, t: ['bow'], w: 2, s: 20 },
    flame: { name: 'Fiamma', max: 1, t: ['bow'], w: 2, s: 20 },
    infinity: { name: 'Infinità', max: 1, t: ['bow'], w: 1, s: 20 },
  };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  const enchName = (k, lv) => ENCH[k].name + (ENCH[k].max > 1 ? ' ' + ROMAN[lv] : '');

  // tipi di un oggetto per la compatibilità
  function kinds(d) {
    const k = [];
    if (d.tool) { k.push(d.tool.type, 'tool'); }
    if (d.armor) { k.push('armor', ['helmet', 'chestplate', 'leggings', 'boots'][d.armor.slot]); }
    if (d.bow) k.push('bow');
    return k;
  }
  const ENCHANTABILITY = { wooden: 15, stone: 5, iron: 14, golden: 22, diamond: 10, leather: 15, chainmail: 12 };
  function enchantability(d) {
    if (d.bow) return 1;
    const mat = d.armor ? d.armor.mat : d.key.split('_')[0];
    const v = ENCHANTABILITY[mat] || 1;
    return d.armor && mat === 'iron' ? 9 : d.armor && mat === 'golden' ? 25 : v;
  }
  function canEnchant(st) {
    if (!st) return false;
    const d = MC.blocks[st.id];
    return !!d && kinds(d).length > 0 && !(st.ench && Object.keys(st.ench).length);
  }

  // costi delle tre opzioni in base alle librerie
  function optionCosts(rng, shelves) {
    shelves = Math.min(15, shelves);
    const base = 1 + Math.floor(rng() * 8) + Math.floor(shelves / 2) + Math.floor(rng() * (shelves + 1));
    return [Math.max(1, Math.floor(base / 3)), Math.floor((base * 2) / 3) + 1, Math.max(base, shelves * 2)];
  }

  // sceglie gli incantesimi per un livello di costo
  function pickEnchants(rng, d, cost) {
    const ks = kinds(d);
    const e = enchantability(d);
    let power = cost + 1 + Math.floor(rng() * (Math.floor(e / 4) + 1)) + Math.floor(rng() * (Math.floor(e / 4) + 1));
    power = Math.max(1, Math.round(power * (1 + (rng() + rng() - 1) * 0.15)));
    const avail = () => {
      const out = [];
      for (const k in ENCH) {
        const E = ENCH[k];
        if (!E.t.some((t) => ks.includes(t))) continue;
        let lv = 0;
        for (let l = E.max; l >= 1; l--) if (power >= 1 + (l - 1) * E.s) { lv = l; break; }
        if (lv) out.push([k, lv, E.w]);
      }
      return out;
    };
    const chosen = {};
    let list = avail();
    const pick = () => {
      list = list.filter(([k]) => !chosen[k] && !Object.keys(chosen).some((c) => (ENCH[c].no || []).includes(k)));
      if (!list.length) return false;
      let tot = 0;
      for (const x of list) tot += x[2];
      let r = rng() * tot;
      for (const [k, lv, w] of list) { r -= w; if (r <= 0) { chosen[k] = lv; return true; } }
      chosen[list[0][0]] = list[0][1];
      return true;
    };
    pick();
    let p2 = power;
    while (rng() < (p2 + 1) / 50) { if (!pick()) break; p2 = Math.floor(p2 / 2); }
    return chosen;
  }

  // opzioni visibili al tavolo (deterministiche finché non si incanta)
  function options(seed, st, shelves) {
    if (!canEnchant(st)) return null;
    const d = MC.blocks[st.id];
    const rng = MC.util.mulberry32((seed ^ Math.imul(st.id, 0x9e3779b1)) >>> 0);
    const costs = optionCosts(rng, shelves);
    return costs.map((c, i) => {
      const r2 = MC.util.mulberry32((seed ^ Math.imul(st.id + 17 * (i + 1), 0x85ebca6b) ^ c) >>> 0);
      const ench = pickEnchants(r2, d, c);
      const first = Object.keys(ench)[0];
      return { cost: c, lapis: i + 1, ench, clue: first ? enchName(first, ench[first]) : '?' };
    });
  }

  // ---------------- Esperienza ----------------
  const xpNeed = (lv) => (lv < 16 ? 2 * lv + 7 : lv < 31 ? 5 * lv - 38 : 9 * lv - 158);

  // ---------------- Armatura ----------------
  const NO_ARMOR = new Set(['starve', 'drown', 'void', 'kill', 'fall', 'fire', 'magma_self']);
  function armorStats(inv) {
    let def = 0, tough = 0, prot = 0, ff = 0;
    for (const s of inv.armor) {
      if (!s) continue;
      const d = MC.blocks[s.id];
      if (!d || !d.armor) continue;
      def += d.armor.def; tough += d.armor.tough;
      if (s.ench) { prot += s.ench.protection || 0; ff += s.ench.feather_falling || 0; }
    }
    return { def, tough, prot, ff };
  }
  // riduzione del danno come nell'originale; consuma la durabilità delle armature
  function reduce(inv, amount, cause, rng) {
    const st = armorStats(inv);
    let dmg = amount;
    if (!NO_ARMOR.has(cause) && st.def > 0) {
      const eff = Math.min(20, Math.max(st.def / 5, st.def - dmg / (2 + st.tough / 4)));
      dmg *= 1 - eff / 25;
      const wear = Math.max(1, Math.floor(amount / 4));
      for (let i = 0; i < 4; i++) {
        const s = inv.armor[i];
        if (!s) continue;
        const ub = s.ench && s.ench.unbreaking ? s.ench.unbreaking : 0;
        if (ub && rng() < ub / (ub + 1) * 0.6) continue;
        s.dmg = (s.dmg || 0) + wear;
        if (s.dmg >= MC.blocks[s.id].durability) inv.armor[i] = null;
      }
      inv._ch();
    }
    let epf = 0;
    if (!['starve', 'void', 'kill'].includes(cause)) epf += st.prot;
    if (cause === 'fall') epf += st.ff * 3;
    if (epf > 0) dmg *= 1 - Math.min(20, epf) / 25;
    return dmg;
  }

  const enchLv = (st, k) => (st && st.ench && st.ench[k]) || 0;

  MC.ENCH = ENCH;
  MC.enchName = enchName;
  MC.enchant = { kinds, canEnchant, options, xpNeed, armorStats, reduce, enchLv };
})();
(function () {
  const MC = window.MC;
  // colore pulsante del bagliore degli oggetti incantati
  MC.glintCol = function (t) {
    const k = Math.sin(t * 3) * 0.5 + 0.5;
    return [1.15 + k * 0.35, 0.8 + k * 0.1, 1.35 + k * 0.35, 1];
  };
})();
