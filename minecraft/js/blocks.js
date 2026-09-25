// Registro dei blocchi
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});

  // Tint: 0 nessuno, 1 erba (moltiplica), 2 erba con maschera (lato erba), 3 fogliame bioma, 4 colore fisso
  const blocks = [];
  const byKey = {};
  let nextId = 0;

  function add(key, name, p) {
    p = p || {};
    const d = {
      id: nextId++,
      key,
      name,
      shape: p.shape || 'cube',
      pass: p.pass || 'solid',
      opaque: p.opaque !== undefined ? p.opaque : true,
      solid: p.solid !== undefined ? p.solid : true,
      tex: p.tex || null,
      tint: p.tint || 0,
      tintColor: p.tintColor || null,
      lightOpacity: p.lightOpacity !== undefined ? p.lightOpacity : (p.opaque === false ? 0 : 15),
      emit: p.emit || 0,
      hardness: p.hardness !== undefined ? p.hardness : 1,
      sound: p.sound || 'stone',
      drop: p.drop,
      replaceable: !!p.replaceable,
      cat: p.cat || 'build',
      wave: p.wave || 0,
      axis: !!p.axis,
      facing: !!p.facing,
      gravity: !!p.gravity,
      support: p.support || null, // funzione sui blocchi validi sotto
      cullSame: p.cullSame !== undefined ? p.cullSame : false,
      fluid: p.fluid || 0, // 1 acqua, 2 lava
      selectable: p.selectable !== undefined ? p.selectable : true,
      creative: p.creative !== undefined ? p.creative : true,
      emissive: !!p.emissive,
      explosive: !!p.explosive,
      interact: p.interact || null,
      blast: p.blast !== undefined ? p.blast : 1,
    };
    if (d.drop === undefined) d.drop = d.id;
    blocks[d.id] = d;
    byKey[key] = d.id;
    return d.id;
  }

  const t = (all) => ({ top: all, bottom: all, side: all });
  const tsb = (top, side, bottom) => ({ top, side, bottom: bottom || top });

  add('air', 'Aria', { shape: 'none', opaque: false, solid: false, lightOpacity: 0, replaceable: true, selectable: false, creative: false, hardness: 0 });
  add('stone', 'Pietra', { tex: t('stone'), hardness: 1.5, drop: 'cobblestone', cat: 'nature', blast: 6 });
  add('grass', 'Blocco d\'erba', { tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, tint: 2, hardness: 0.6, sound: 'grass', drop: 'dirt', cat: 'nature' });
  add('dirt', 'Terra', { tex: t('dirt'), hardness: 0.5, sound: 'gravel', cat: 'nature' });
  add('cobblestone', 'Pietrisco', { tex: t('cobblestone'), hardness: 2, cat: 'build', blast: 6 });
  add('oak_planks', 'Assi di quercia', { tex: t('oak_planks'), hardness: 2, sound: 'wood', cat: 'build' });
  add('bedrock', 'Roccia madre', { tex: t('bedrock'), hardness: -1, cat: 'nature', blast: 9999 });
  add('water', 'Acqua', { shape: 'liquid', pass: 'translucent', opaque: false, solid: false, lightOpacity: 2, tex: t('water'), fluid: 1, replaceable: true, selectable: false, hardness: -1, cat: 'nature', blast: 100 });
  add('lava', 'Lava', { shape: 'liquid', opaque: false, solid: false, lightOpacity: 15, emit: 15, tex: t('lava'), fluid: 2, replaceable: true, selectable: false, hardness: -1, emissive: true, cat: 'nature', blast: 100 });
  add('sand', 'Sabbia', { tex: t('sand'), hardness: 0.5, sound: 'sand', gravity: true, cat: 'nature' });
  add('gravel', 'Ghiaia', { tex: t('gravel'), hardness: 0.6, sound: 'gravel', gravity: true, cat: 'nature' });
  add('gold_ore', 'Minerale d\'oro', { tex: t('gold_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('iron_ore', 'Minerale di ferro', { tex: t('iron_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('coal_ore', 'Minerale di carbone', { tex: t('coal_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('oak_log', 'Tronco di quercia', { tex: tsb('oak_log_top', 'oak_log'), axis: true, hardness: 2, sound: 'wood', cat: 'nature' });
  add('oak_leaves', 'Foglie di quercia', { tex: t('oak_leaves'), opaque: false, lightOpacity: 1, tint: 3, hardness: 0.2, sound: 'grass', wave: 2, drop: 0, cat: 'nature' });
  add('glass', 'Vetro', { tex: t('glass'), opaque: false, lightOpacity: 0, hardness: 0.3, sound: 'glass', cullSame: true, drop: 0, cat: 'build' });
  add('lapis_ore', 'Minerale di lapislazzuli', { tex: t('lapis_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('sandstone', 'Arenaria', { tex: tsb('sandstone_top', 'sandstone', 'sandstone_bottom'), hardness: 0.8, cat: 'build' });
  const plantGround = (b) => b === MC.B.grass || b === MC.B.dirt || b === MC.B.podzol || b === MC.B.snowy_grass || b === MC.B.coarse_dirt || b === MC.B.moss_block;
  const plant = (tex, name, extra) => Object.assign({ shape: 'cross', opaque: false, solid: false, lightOpacity: 0, tex: t(tex), hardness: 0, sound: 'grass', replaceable: false, wave: 1, support: plantGround, cat: 'deco' }, extra || {});
  add('dandelion', 'Tarassaco', plant('dandelion'));
  add('poppy', 'Papavero', plant('poppy'));
  add('tall_grass', 'Erba alta', plant('tall_grass', 'Erba', { tint: 1, replaceable: true, drop: 0 }));
  add('dead_bush', 'Arbusto secco', plant('dead_bush', '', { support: (b) => b === MC.B.sand || b === MC.B.red_sand || b === MC.B.terracotta || b === MC.B.dirt || b === MC.B.coarse_dirt, replaceable: true, drop: 0 }));
  add('brown_mushroom', 'Fungo marrone', plant('brown_mushroom', '', { wave: 0, support: (b) => MC.blocks[b].opaque, emit: 1 }));
  add('red_mushroom', 'Fungo rosso', plant('red_mushroom', '', { wave: 0, support: (b) => MC.blocks[b].opaque }));
  add('gold_block', 'Blocco d\'oro', { tex: t('gold_block'), hardness: 3, sound: 'metal', cat: 'ores' });
  add('iron_block', 'Blocco di ferro', { tex: t('iron_block'), hardness: 4, sound: 'metal', cat: 'ores' });
  add('bricks', 'Mattoni', { tex: t('bricks'), hardness: 2, cat: 'build', blast: 6 });
  add('tnt', 'TNT', { tex: tsb('tnt_top', 'tnt_side', 'tnt_bottom'), hardness: 0, sound: 'grass', explosive: true, cat: 'deco', blast: 0 });
  add('bookshelf', 'Libreria', { tex: tsb('oak_planks', 'bookshelf'), hardness: 1.5, sound: 'wood', cat: 'deco' });
  add('mossy_cobblestone', 'Pietrisco muschioso', { tex: t('mossy_cobblestone'), hardness: 2, cat: 'build', blast: 6 });
  add('obsidian', 'Ossidiana', { tex: t('obsidian'), hardness: 15, cat: 'build', blast: 1200 });
  add('torch', 'Torcia', { shape: 'torch', opaque: false, solid: false, lightOpacity: 0, emit: 14, tex: t('torch'), hardness: 0, sound: 'wood', emissive: true, cat: 'deco' });
  add('diamond_ore', 'Minerale di diamante', { tex: t('diamond_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('diamond_block', 'Blocco di diamante', { tex: t('diamond_block'), hardness: 5, sound: 'metal', cat: 'ores' });
  add('crafting_table', 'Banco da lavoro', { tex: { top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side', front: 'crafting_table_front' }, facing: true, hardness: 2.5, sound: 'wood', interact: 'craft', cat: 'deco' });
  add('furnace', 'Fornace', { tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, facing: true, hardness: 3.5, interact: 'craft', cat: 'deco' });
  add('redstone_ore', 'Minerale di pietrarossa', { tex: t('redstone_ore'), hardness: 3, emit: 0, cat: 'ores', blast: 3 });
  add('snow', 'Blocco di neve', { tex: t('snow'), hardness: 0.3, sound: 'snow', cat: 'nature' });
  add('ice', 'Ghiaccio', { tex: t('ice'), pass: 'translucent', opaque: false, lightOpacity: 2, hardness: 0.5, sound: 'glass', cullSame: true, drop: 0, cat: 'nature' });
  add('cactus', 'Cactus', { shape: 'cactus', tex: tsb('cactus_top', 'cactus_side', 'cactus_bottom'), opaque: false, lightOpacity: 0, hardness: 0.4, sound: 'wool', support: (b) => b === MC.B.sand || b === MC.B.red_sand || b === MC.B.cactus, cat: 'nature' });
  add('clay', 'Argilla', { tex: t('clay'), hardness: 0.6, sound: 'gravel', cat: 'nature' });
  add('sugar_cane', 'Canna da zucchero', plant('sugar_cane', '', { tint: 1, wave: 0, support: (b) => b === MC.B.grass || b === MC.B.dirt || b === MC.B.sand || b === MC.B.red_sand || b === MC.B.sugar_cane || b === MC.B.podzol }));
  add('pumpkin', 'Zucca', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_side' }, facing: true, hardness: 1, sound: 'wood', cat: 'nature' });
  add('glowstone', 'Pietraluce', { tex: t('glowstone'), emit: 15, hardness: 0.3, sound: 'glass', emissive: true, cat: 'deco' });
  add('birch_log', 'Tronco di betulla', { tex: tsb('birch_log_top', 'birch_log'), axis: true, hardness: 2, sound: 'wood', cat: 'nature' });
  add('birch_leaves', 'Foglie di betulla', { tex: t('birch_leaves'), opaque: false, lightOpacity: 1, tint: 4, tintColor: [128, 167, 85], hardness: 0.2, sound: 'grass', wave: 2, drop: 0, cat: 'nature' });
  add('birch_planks', 'Assi di betulla', { tex: t('birch_planks'), hardness: 2, sound: 'wood', cat: 'build' });
  add('spruce_log', 'Tronco di abete', { tex: tsb('spruce_log_top', 'spruce_log'), axis: true, hardness: 2, sound: 'wood', cat: 'nature' });
  add('spruce_leaves', 'Foglie di abete', { tex: t('spruce_leaves'), opaque: false, lightOpacity: 1, tint: 4, tintColor: [97, 153, 97], hardness: 0.2, sound: 'grass', wave: 2, drop: 0, cat: 'nature' });
  add('spruce_planks', 'Assi di abete', { tex: t('spruce_planks'), hardness: 2, sound: 'wood', cat: 'build' });
  add('jungle_log', 'Tronco della giungla', { tex: tsb('jungle_log_top', 'jungle_log'), axis: true, hardness: 2, sound: 'wood', cat: 'nature' });
  add('jungle_leaves', 'Foglie della giungla', { tex: t('jungle_leaves'), opaque: false, lightOpacity: 1, tint: 3, hardness: 0.2, sound: 'grass', wave: 2, drop: 0, cat: 'nature' });
  add('jungle_planks', 'Assi della giungla', { tex: t('jungle_planks'), hardness: 2, sound: 'wood', cat: 'build' });
  add('acacia_log', 'Tronco di acacia', { tex: tsb('acacia_log_top', 'acacia_log'), axis: true, hardness: 2, sound: 'wood', cat: 'nature' });
  add('acacia_leaves', 'Foglie di acacia', { tex: t('acacia_leaves'), opaque: false, lightOpacity: 1, tint: 3, hardness: 0.2, sound: 'grass', wave: 2, drop: 0, cat: 'nature' });
  add('acacia_planks', 'Assi di acacia', { tex: t('acacia_planks'), hardness: 2, sound: 'wood', cat: 'build' });
  add('stone_bricks', 'Mattoni di pietra', { tex: t('stone_bricks'), hardness: 1.5, cat: 'build', blast: 6 });
  add('mossy_stone_bricks', 'Mattoni di pietra muschiosi', { tex: t('mossy_stone_bricks'), hardness: 1.5, cat: 'build', blast: 6 });
  add('snowy_grass', 'Erba innevata', { tex: { top: 'snow', bottom: 'dirt', side: 'snowy_grass_side' }, hardness: 0.6, sound: 'snow', drop: 'dirt', cat: 'nature' });
  add('emerald_ore', 'Minerale di smeraldo', { tex: t('emerald_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('emerald_block', 'Blocco di smeraldo', { tex: t('emerald_block'), hardness: 5, sound: 'metal', cat: 'ores' });
  add('lapis_block', 'Blocco di lapislazzuli', { tex: t('lapis_block'), hardness: 3, cat: 'ores' });
  add('coal_block', 'Blocco di carbone', { tex: t('coal_block'), hardness: 5, cat: 'ores' });
  add('redstone_block', 'Blocco di pietrarossa', { tex: t('redstone_block'), hardness: 5, sound: 'metal', cat: 'ores' });
  add('red_sand', 'Sabbia rossa', { tex: t('red_sand'), hardness: 0.5, sound: 'sand', gravity: true, cat: 'nature' });

  const tcolors = [
    ['terracotta', 'Terracotta'], ['white_terracotta', 'Terracotta bianca'], ['orange_terracotta', 'Terracotta arancione'],
    ['yellow_terracotta', 'Terracotta gialla'], ['red_terracotta', 'Terracotta rossa'], ['brown_terracotta', 'Terracotta marrone'],
    ['light_gray_terracotta', 'Terracotta grigio chiaro'],
  ];
  for (const [k, n] of tcolors) add(k, n, { tex: t(k), hardness: 1.25, cat: 'color' });

  const COLORS = [
    ['white', 'bianca', [233, 236, 236]], ['orange', 'arancione', [240, 118, 19]], ['magenta', 'magenta', [189, 68, 179]],
    ['light_blue', 'azzurra', [58, 175, 217]], ['yellow', 'gialla', [248, 197, 39]], ['lime', 'lime', [112, 185, 25]],
    ['pink', 'rosa', [237, 141, 172]], ['gray', 'grigia', [62, 68, 71]], ['light_gray', 'grigio chiaro', [142, 142, 134]],
    ['cyan', 'ciano', [21, 137, 145]], ['purple', 'viola', [121, 42, 172]], ['blue', 'blu', [53, 57, 157]],
    ['brown', 'marrone', [114, 71, 40]], ['green', 'verde', [84, 109, 27]], ['red', 'rossa', [160, 39, 34]],
    ['black', 'nera', [20, 21, 25]],
  ];
  MC.DYE_COLORS = COLORS;
  for (const [k, n] of COLORS) add(k + '_wool', 'Lana ' + n, { tex: t(k + '_wool'), hardness: 0.8, sound: 'wool', cat: 'color' });

  add('melon', 'Anguria', { tex: tsb('melon_top', 'melon_side'), hardness: 1, sound: 'wood', cat: 'nature' });
  add('hay_block', 'Balla di fieno', { tex: tsb('hay_top', 'hay_side'), axis: true, hardness: 0.5, sound: 'grass', cat: 'deco' });
  add('quartz_block', 'Blocco di quarzo', { tex: tsb('quartz_top', 'quartz_side'), hardness: 0.8, cat: 'build' });
  add('sponge', 'Spugna', { tex: t('sponge'), hardness: 0.6, sound: 'grass', cat: 'deco' });
  add('netherrack', 'Netherrack', { tex: t('netherrack'), hardness: 0.4, cat: 'nature' });
  add('packed_ice', 'Ghiaccio compatto', { tex: t('packed_ice'), hardness: 0.5, sound: 'glass', cat: 'nature' });
  add('smooth_stone', 'Pietra liscia', { tex: t('smooth_stone'), hardness: 2, cat: 'build', blast: 6 });
  add('andesite', 'Andesite', { tex: t('andesite'), hardness: 1.5, cat: 'nature', blast: 6 });
  add('diorite', 'Diorite', { tex: t('diorite'), hardness: 1.5, cat: 'nature', blast: 6 });
  add('granite', 'Granito', { tex: t('granite'), hardness: 1.5, cat: 'nature', blast: 6 });
  add('blue_orchid', 'Orchidea blu', plant('blue_orchid'));
  add('oxeye_daisy', 'Margherita', plant('oxeye_daisy'));
  add('fern', 'Felce', plant('fern', '', { tint: 1, replaceable: true, drop: 0 }));

  const GLASS = [['white', 'bianco'], ['red', 'rosso'], ['orange', 'arancione'], ['yellow', 'giallo'], ['lime', 'lime'], ['light_blue', 'azzurro'], ['blue', 'blu'], ['purple', 'viola'], ['black', 'nero']];
  MC.GLASS_COLORS = GLASS;
  for (const [k, n] of GLASS) add(k + '_stained_glass', 'Vetro colorato ' + n, { tex: t(k + '_stained_glass'), pass: 'translucent', opaque: false, lightOpacity: 0, hardness: 0.3, sound: 'glass', cullSame: true, drop: 0, cat: 'color' });

  add('sea_lantern', 'Lanterna marina', { tex: t('sea_lantern'), emit: 15, hardness: 0.3, sound: 'glass', emissive: true, cat: 'deco' });
  add('podzol', 'Podzol', { tex: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' }, hardness: 0.5, sound: 'gravel', drop: 'dirt', cat: 'nature' });
  add('coarse_dirt', 'Terra grossolana', { tex: t('coarse_dirt'), hardness: 0.5, sound: 'gravel', cat: 'nature' });
  add('moss_block', 'Blocco di muschio', { tex: t('moss_block'), hardness: 0.1, sound: 'grass', cat: 'nature' });
  add('deepslate', 'Ardesia profonda', { tex: tsb('deepslate_top', 'deepslate'), hardness: 3, drop: 'cobbled_deepslate', cat: 'nature', blast: 6 });
  add('cobbled_deepslate', 'Ardesia profonda a ciottoli', { tex: t('cobbled_deepslate'), hardness: 3.5, cat: 'build', blast: 6 });
  add('copper_ore', 'Minerale di rame', { tex: t('copper_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('copper_block', 'Blocco di rame', { tex: t('copper_block'), hardness: 3, sound: 'metal', cat: 'ores' });
  add('amethyst_block', 'Blocco di ametista', { tex: t('amethyst_block'), hardness: 1.5, sound: 'glass', cat: 'ores' });
  add('jack_o_lantern', 'Zucca di Halloween', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_o_lantern' }, facing: true, emit: 15, hardness: 1, sound: 'wood', cat: 'deco' });

  const CONCRETE = COLORS.map(([k, n, c]) => [k, n, c]);
  for (const [k, n] of CONCRETE) add(k + '_concrete', 'Cemento ' + n.replace(/a$/, 'o').replace(/grigio chiaro/, 'grigio chiaro'), { tex: t(k + '_concrete'), hardness: 1.8, cat: 'color' });

  add('oak_log_wood', 'Legno di quercia', { tex: t('oak_log'), hardness: 2, sound: 'wood', cat: 'build' });
  add('polished_andesite', 'Andesite levigata', { tex: t('polished_andesite'), hardness: 1.5, cat: 'build', blast: 6 });
  add('polished_diorite', 'Diorite levigata', { tex: t('polished_diorite'), hardness: 1.5, cat: 'build', blast: 6 });
  add('polished_granite', 'Granito levigato', { tex: t('polished_granite'), hardness: 1.5, cat: 'build', blast: 6 });
  add('chiseled_stone_bricks', 'Mattoni di pietra cesellati', { tex: t('chiseled_stone_bricks'), hardness: 1.5, cat: 'build', blast: 6 });
  add('cut_sandstone', 'Arenaria tagliata', { tex: tsb('sandstone_top', 'cut_sandstone'), hardness: 0.8, cat: 'build' });
  add('red_sandstone', 'Arenaria rossa', { tex: tsb('red_sandstone_top', 'red_sandstone', 'red_sandstone_bottom'), hardness: 0.8, cat: 'build' });
  add('prismarine', 'Prismarino', { tex: t('prismarine'), hardness: 1.5, cat: 'build', blast: 6 });
  add('dark_prismarine', 'Prismarino scuro', { tex: t('dark_prismarine'), hardness: 1.5, cat: 'build', blast: 6 });
  add('mud_bricks', 'Mattoni di fango', { tex: t('mud_bricks'), hardness: 1.5, cat: 'build' });
  add('lily_of_the_valley', 'Mughetto', plant('lily_of_the_valley'));
  add('cornflower', 'Fiordaliso', plant('cornflower'));
  add('allium', 'Allium', plant('allium'));
  add('pink_tulip', 'Tulipano rosa', plant('pink_tulip'));

  // Risoluzione dei drop in forma di chiave
  for (const d of blocks) {
    if (typeof d.drop === 'string') d.drop = byKey[d.drop];
  }

  // Array di lookup veloci per il mesher e la luce
  const N = 256;
  const OPAQUE = new Uint8Array(N);
  const SOLID = new Uint8Array(N);
  const LIGHT_OPACITY = new Uint8Array(N);
  const EMIT = new Uint8Array(N);
  const FLUID = new Uint8Array(N);
  const REPLACEABLE = new Uint8Array(N);
  for (const d of blocks) {
    OPAQUE[d.id] = d.opaque && d.shape === 'cube' ? 1 : 0;
    SOLID[d.id] = d.solid ? 1 : 0;
    LIGHT_OPACITY[d.id] = d.lightOpacity;
    EMIT[d.id] = d.emit;
    FLUID[d.id] = d.fluid;
    REPLACEABLE[d.id] = d.replaceable ? 1 : 0;
  }

  MC.blocks = blocks;
  MC.B = byKey;
  MC.BL = { OPAQUE, SOLID, LIGHT_OPACITY, EMIT, FLUID, REPLACEABLE, count: blocks.length };

  // Box di collisione e selezione (coordinate locali 0..1)
  MC.getSelectionBox = function (id, meta) {
    const d = blocks[id];
    if (!d || !d.selectable) return null;
    if (d.shape === 'cross') return [0.15, 0, 0.15, 0.85, id === MC.B.sugar_cane ? 1 : 0.8, 0.85];
    if (d.shape === 'torch') {
      if (meta === 0) return [0.4, 0, 0.4, 0.6, 0.62, 0.6];
      // a parete (meta 1..4 = muro a -X, +X, -Z, +Z): la torcia è inclinata verso l'esterno
      if (meta === 1) return [0, 0.2, 0.35, 0.3, 0.8, 0.65];
      if (meta === 2) return [0.7, 0.2, 0.35, 1, 0.8, 0.65];
      if (meta === 3) return [0.35, 0.2, 0, 0.65, 0.8, 0.3];
      if (meta === 4) return [0.35, 0.2, 0.7, 0.65, 0.8, 1];
      return [0.4, 0, 0.4, 0.6, 0.62, 0.6];
    }
    if (d.shape === 'cactus') return [0.0625, 0, 0.0625, 0.9375, 1, 0.9375];
    return [0, 0, 0, 1, 1, 1];
  };
  MC.getCollisionBox = function (id) {
    const d = blocks[id];
    if (!d || !d.solid) return null;
    if (d.shape === 'cactus') return [0.0625, 0, 0.0625, 0.9375, 0.9375, 0.9375];
    return [0, 0, 0, 1, 1, 1];
  };
})();
