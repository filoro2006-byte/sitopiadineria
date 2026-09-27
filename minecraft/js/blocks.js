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
    for (const k in p) if (!(k in d)) d[k] = p[k];
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

  const MASC = { bianca: 'bianco', azzurra: 'azzurro', gialla: 'giallo', grigia: 'grigio', rossa: 'rosso', nera: 'nero' };
  const masc = (n) => MASC[n] || n;
  MC.masc = masc;
  const CONCRETE = COLORS.map(([k, n, c]) => [k, n, c]);
  for (const [k, n] of CONCRETE) add(k + '_concrete', 'Cemento ' + masc(n), { tex: t(k + '_concrete'), hardness: 1.8, cat: 'color' });

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


  // ---------------- Blocchi con modello (non cubici) ----------------
  const H = 1 / 16;
  const mdl = (fn, p) => Object.assign({ shape: 'model', model: fn, opaque: false, lightOpacity: 0 }, p);
  add('farmland', 'Terreno arato', mdl(() => [[0, 0, 0, 1, 15 * H, 1]], { tex: { top: 'farmland', side: 'dirt', bottom: 'dirt' }, hardness: 0.6, sound: 'gravel', drop: 'dirt', cat: 'nature', solid: true, lightOpacity: 15 }));
  add('dirt_path', 'Sentiero', mdl(() => [[0, 0, 0, 1, 15 * H, 1]], { tex: { top: 'path_top', side: 'path_side', bottom: 'dirt' }, hardness: 0.65, sound: 'gravel', drop: 'dirt', cat: 'nature', solid: true, lightOpacity: 15 }));
  add('wheat', 'Grano', { shape: 'crop', opaque: false, solid: false, lightOpacity: 0, tex: t('wheat_7'), hardness: 0, sound: 'grass', wave: 1, support: (b) => b === MC.B.farmland, creative: false, cat: 'nature', drop: 0 });
  const WOODS = ['oak', 'birch', 'spruce', 'jungle', 'acacia'];
  const WOOD_IT = { oak: 'quercia', birch: 'betulla', spruce: 'abete', jungle: 'giungla', acacia: 'acacia' };
  for (const w of WOODS) add(w + '_sapling', 'Arbusto di ' + WOOD_IT[w], plant(w + '_sapling', '', { wave: 0 }));

  const SLAB_MATS = [['oak_planks', 'di quercia', 'wood'], ['spruce_planks', 'di abete', 'wood'], ['birch_planks', 'di betulla', 'wood'], ['cobblestone', 'di pietrisco', 'stone'], ['stone', 'di pietra', 'stone'], ['stone_bricks', 'di mattoni di pietra', 'stone'], ['bricks', 'di mattoni', 'stone'], ['sandstone', 'di arenaria', 'stone']];
  const slabModel = (m) => (m & 1 ? [[0, 0.5, 0, 1, 1, 1]] : [[0, 0, 0, 1, 0.5, 1]]);
  // gradini: meta&3 = lato del gradino alto (0 -Z, 1 +X, 2 +Z, 3 -X), meta&4 = capovolto
  const stairModel = (m) => {
    const up = m & 4;
    const base = up ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
    const y0 = up ? 0 : 0.5, y1 = up ? 0.5 : 1;
    const f = m & 3;
    const step = f === 0 ? [0, y0, 0, 1, y1, 0.5] : f === 1 ? [0.5, y0, 0, 1, y1, 1] : f === 2 ? [0, y0, 0.5, 1, y1, 1] : [0, y0, 0, 0.5, y1, 1];
    return [base, step];
  };
  for (const [m, n, snd] of SLAB_MATS) {
    const base = m.replace('_planks', '');
    add(base + '_slab', 'Lastra ' + n, mdl(slabModel, { texFrom: m, hardness: 2, sound: snd, cat: 'build', solid: true, slab: m, blast: snd === 'stone' ? 6 : 1 }));
    add(base + '_stairs', 'Scalini ' + n, mdl(stairModel, { texFrom: m, hardness: 2, sound: snd, cat: 'build', solid: true, stairs: true, blast: snd === 'stone' ? 6 : 1 }));
  }
  // staccionate, muri e vetri sottili (si collegano ai vicini: bit 1 +X, 2 -X, 4 +Z, 8 -Z)
  const connModel = (post, arm, rails) => (m, c) => {
    const b = [[0.5 - post, 0, 0.5 - post, 0.5 + post, 1, 0.5 + post]];
    for (const [y0, y1] of rails) {
      if (c & 1) b.push([0.5 + post, y0, 0.5 - arm, 1, y1, 0.5 + arm]);
      if (c & 2) b.push([0, y0, 0.5 - arm, 0.5 - post, y1, 0.5 + arm]);
      if (c & 4) b.push([0.5 - arm, y0, 0.5 + post, 0.5 + arm, y1, 1]);
      if (c & 8) b.push([0.5 - arm, y0, 0, 0.5 + arm, y1, 0.5 - post]);
    }
    return b;
  };
  add('oak_fence', 'Staccionata di quercia', mdl(connModel(2 * H, H, [[6 * H, 9 * H], [12 * H, 15 * H]]), { texFrom: 'oak_planks', hardness: 2, sound: 'wood', cat: 'deco', solid: true, conn: 'fence', tall: true }));
  add('spruce_fence', 'Staccionata di abete', mdl(connModel(2 * H, H, [[6 * H, 9 * H], [12 * H, 15 * H]]), { texFrom: 'spruce_planks', hardness: 2, sound: 'wood', cat: 'deco', solid: true, conn: 'fence', tall: true }));
  add('cobblestone_wall', 'Muretto di pietrisco', mdl(connModel(4 * H, 3 * H, [[0, 14 * H]]), { texFrom: 'cobblestone', hardness: 2, sound: 'stone', cat: 'build', solid: true, conn: 'wall', tall: true, blast: 6 }));
  add('glass_pane', 'Lastra di vetro', mdl(connModel(H, H, [[0, 1]]), { tex: t('glass'), hardness: 0.3, sound: 'glass', cat: 'build', solid: true, conn: 'pane', drop: 0 }));
  // porta: meta&3 lato del pannello chiuso, 4 aperta, 8 metà superiore
  const doorModel = (m) => {
    let f = m & 3;
    if (m & 4) f = (f + 1) & 3;
    const T3 = 3 * H;
    return [f === 0 ? [0, 0, 0, 1, 1, T3] : f === 1 ? [1 - T3, 0, 0, 1, 1, 1] : f === 2 ? [0, 0, 1 - T3, 1, 1, 1] : [0, 0, 0, T3, 1, 1]];
  };
  add('oak_door', 'Porta di quercia', mdl(doorModel, { tex: t('door_bottom'), hardness: 3, sound: 'wood', cat: 'deco', solid: true, door: true, interact: 'door' }));
  // scala a pioli: meta 1..4 come le torce (muro a -X, +X, -Z, +Z)
  const ladderModel = (m) => {
    const T = H;
    return [m === 1 ? [0, 0, 0, T, 1, 1] : m === 2 ? [1 - T, 0, 0, 1, 1, 1] : m === 3 ? [0, 0, 0, 1, 1, T] : [0, 0, 1 - T, 1, 1, 1]];
  };
  add('ladder', 'Scala a pioli', mdl(ladderModel, { tex: t('ladder'), hardness: 0.4, sound: 'wood', cat: 'deco', solid: false, ladder: true, cutout: true }));
  // baule: base + coperchio + serratura sul lato frontale (meta&7 = faccia frontale)
  const chestModel = (m) => {
    const f = m & 7;
    const L = { f: ['iron_block', 'iron_block', 'iron_block', 'iron_block', 'iron_block', 'iron_block'] };
    const latch = f === 0 ? [1 - H, 7 * H, 7 * H, 1, 11 * H, 9 * H] : f === 1 ? [0, 7 * H, 7 * H, H, 11 * H, 9 * H] : f === 4 ? [7 * H, 7 * H, 1 - H, 9 * H, 11 * H, 1] : [7 * H, 7 * H, 0, 9 * H, 11 * H, H];
    return [[H, 0, H, 1 - H, 10 * H, 1 - H], [H, 10 * H, H, 1 - H, 14 * H, 1 - H], latch.concat([L])];
  };
  add('chest', 'Baule', mdl(chestModel, { tex: { top: 'chest_top', side: 'chest_side', bottom: 'chest_top', front: 'chest_front' }, facing: true, hardness: 2.5, sound: 'wood', cat: 'deco', solid: true, interact: 'chest' }));
  // lanterna: meta 1 = appesa al soffitto
  add('lantern', 'Lanterna', mdl((m) => (m === 1
    ? [[5 * H, 2 * H, 5 * H, 11 * H, 9 * H, 11 * H], [6 * H, 9 * H, 6 * H, 10 * H, 11 * H, 10 * H], [7.5 * H, 11 * H, 7 * H, 8.5 * H, 1, 9 * H, { f: ['iron_block', 'iron_block', 'iron_block', 'iron_block', 'iron_block', 'iron_block'] }]]
    : [[5 * H, 0, 5 * H, 11 * H, 7 * H, 11 * H], [6 * H, 7 * H, 6 * H, 10 * H, 9 * H, 10 * H]]), { tex: t('lantern'), hardness: 1, sound: 'metal', cat: 'deco', solid: true, emit: 15, emissive: true }));
  add('hay_bale_slab', 'Lastra di fieno', mdl(slabModel, { texFrom: 'hay_block', hardness: 0.5, sound: 'grass', cat: 'deco', solid: true, creative: false }));
  // letti su due blocchi: meta&3 = direzione piedi->testa (0 -Z, 1 +X, 2 +Z, 3 -X), 4 = metà della testa
  const rotBox = (b, k) => {
    let [x0, y0, z0, x1, y1, z1] = b;
    for (let i = 0; i < k; i++) { const nx0 = 1 - z1, nx1 = 1 - z0, nz0 = x0, nz1 = x1; x0 = nx0; x1 = nx1; z0 = nz0; z1 = nz1; }
    return [x0, y0, z0, x1, y1, z1];
  };
  MC.rotBox = rotBox;
  const bedModel = (color) => (m) => {
    const head = !!(m & 4), k = ((m & 3) - 2 + 4) & 3;
    const side = 'bed_side_' + color;
    const mat = { f: [side, side, (head ? 'bed_head_' : 'bed_foot_') + color, 'oak_planks', side, side], r: (k + 2) & 3 };
    const wood = { f: ['oak_planks', 'oak_planks', 'oak_planks', 'oak_planks', 'oak_planks', 'oak_planks'] };
    const lz = head ? [13 * H, 1] : [0, 3 * H];
    const out = [rotBox([0, 3 * H, 0, 1, 9 * H, 1], k).concat([mat])];
    for (const [x0, x1] of [[0, 3 * H], [13 * H, 1]]) out.push(rotBox([x0, 0, lz[0], x1, 3 * H, lz[1]], k).concat([wood]));
    return out;
  };
  const BED_COLORS = [['red', 'rosso'], ['white', 'bianco'], ['blue', 'blu'], ['green', 'verde'], ['yellow', 'giallo'], ['black', 'nero'], ['purple', 'viola'], ['pink', 'rosa']];
  MC.BED_COLORS = BED_COLORS;
  for (const [c, n] of BED_COLORS) {
    add(c === 'red' ? 'bed' : c + '_bed', 'Letto ' + n, mdl(bedModel(c), { tex: { top: 'bed_head_' + c, side: 'bed_side_' + c, bottom: 'oak_planks' }, hardness: 0.2, sound: 'wool', cat: 'deco', solid: true, interact: 'bed', bed: c }));
  }
  // cancelletti: meta&3 direzione in cui guarda, 4 aperto
  const gateModel = (m) => {
    const open = m & 4, axisX = (m & 1) === 0; // guarda -Z/+Z => cancello lungo X
    let boxes = [[0, 5 * H, 7 * H, 2 * H, 1, 9 * H], [14 * H, 5 * H, 7 * H, 1, 1, 9 * H]];
    if (!open) boxes.push([2 * H, 6 * H, 7 * H, 14 * H, 9 * H, 9 * H], [2 * H, 12 * H, 7 * H, 14 * H, 15 * H, 9 * H], [6 * H, 9 * H, 7 * H, 10 * H, 12 * H, 9 * H]);
    else {
      const dz = (m & 3) === 2 || (m & 3) === 1 ? 1 : -1;
      const z0 = dz > 0 ? 9 * H : 1 * H, z1 = dz > 0 ? 15 * H : 7 * H;
      boxes.push([0, 6 * H, z0, 2 * H, 9 * H, z1], [0, 12 * H, z0, 2 * H, 15 * H, z1], [14 * H, 6 * H, z0, 1, 9 * H, z1], [14 * H, 12 * H, z0, 1, 15 * H, z1]);
    }
    return axisX ? boxes : boxes.map((b) => rotBox(b, 1));
  };
  add('oak_fence_gate', 'Cancelletto di quercia', mdl(gateModel, { texFrom: 'oak_planks', hardness: 2, sound: 'wood', cat: 'deco', solid: true, conn: 'fence', tall: true, gate: true, interact: 'gate' }));
  add('spruce_fence_gate', 'Cancelletto di abete', mdl(gateModel, { texFrom: 'spruce_planks', hardness: 2, sound: 'wood', cat: 'deco', solid: true, conn: 'fence', tall: true, gate: true, interact: 'gate' }));
  // botola: meta&3 lato del cardine, 4 aperta, 8 in alto
  const trapModel = (m) => {
    const T3 = 3 * H;
    if (m & 4) { const f = m & 3; return [f === 0 ? [0, 0, 0, 1, 1, T3] : f === 1 ? [1 - T3, 0, 0, 1, 1, 1] : f === 2 ? [0, 0, 1 - T3, 1, 1, 1] : [0, 0, 0, T3, 1, 1]]; }
    return [m & 8 ? [0, 1 - T3, 0, 1, 1, 1] : [0, 0, 0, 1, T3, 1]];
  };
  add('oak_trapdoor', 'Botola di quercia', mdl(trapModel, { tex: t('trapdoor'), hardness: 3, sound: 'wood', cat: 'deco', solid: true, interact: 'trapdoor', trapdoor: true }));
  for (const [c, n] of MC.DYE_COLORS) add(c + '_carpet', 'Tappeto ' + masc(n), mdl(() => [[0, 0, 0, 1, H, 1]], { texFrom: c + '_wool', hardness: 0.1, sound: 'wool', cat: 'color', solid: true, carpet: true }));

  // ---------------- Nether ----------------
  const nyl = (b) => b === MC.B.crimson_nylium || b === MC.B.warped_nylium || b === MC.B.soul_soil || b === MC.B.netherrack || plantGround(b);
  add('soul_sand', 'Sabbia delle anime', { tex: t('soul_sand'), hardness: 0.5, sound: 'sand', cat: 'nature', slow: 0.45 });
  add('soul_soil', 'Terra delle anime', { tex: t('soul_soil'), hardness: 0.5, sound: 'sand', cat: 'nature' });
  add('nether_bricks', 'Mattoni del Nether', { tex: t('nether_bricks'), hardness: 2, cat: 'build', blast: 6 });
  add('red_nether_bricks', 'Mattoni rossi del Nether', { tex: t('red_nether_bricks'), hardness: 2, cat: 'build', blast: 6 });
  add('nether_brick_fence', 'Staccionata di mattoni del Nether', mdl(connModel(2 * H, H, [[6 * H, 9 * H], [12 * H, 15 * H]]), { texFrom: 'nether_bricks', hardness: 2, sound: 'stone', cat: 'build', solid: true, conn: 'fence', tall: true, blast: 6 }));
  add('nether_brick_slab', 'Lastra di mattoni del Nether', mdl(slabModel, { texFrom: 'nether_bricks', hardness: 2, sound: 'stone', cat: 'build', solid: true, slab: 'nether_bricks', blast: 6 }));
  add('nether_brick_stairs', 'Scalini di mattoni del Nether', mdl(stairModel, { texFrom: 'nether_bricks', hardness: 2, sound: 'stone', cat: 'build', solid: true, stairs: true, blast: 6 }));
  add('nether_quartz_ore', 'Minerale di quarzo del Nether', { tex: t('nether_quartz_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('nether_gold_ore', 'Minerale d\'oro del Nether', { tex: t('nether_gold_ore'), hardness: 3, cat: 'ores', blast: 3 });
  add('magma_block', 'Blocco di magma', { tex: t('magma'), hardness: 0.5, emit: 3, emissive: true, cat: 'nature', hot: true });
  add('basalt', 'Basalto', { tex: tsb('basalt_top', 'basalt_side'), axis: true, hardness: 1.25, cat: 'nature', blast: 4 });
  add('polished_basalt', 'Basalto levigato', { tex: tsb('polished_basalt_top', 'polished_basalt_side'), axis: true, hardness: 1.25, cat: 'build', blast: 4 });
  add('blackstone', 'Pietranera', { tex: tsb('blackstone_top', 'blackstone'), hardness: 1.5, cat: 'nature', blast: 6 });
  add('crimson_nylium', 'Nylium cremisi', { tex: { top: 'crimson_nylium', side: 'crimson_nylium_side', bottom: 'netherrack' }, hardness: 0.4, drop: 'netherrack', cat: 'nature' });
  add('warped_nylium', 'Nylium distorto', { tex: { top: 'warped_nylium', side: 'warped_nylium_side', bottom: 'netherrack' }, hardness: 0.4, drop: 'netherrack', cat: 'nature' });
  add('crimson_stem', 'Gambo cremisi', { tex: tsb('crimson_stem_top', 'crimson_stem'), axis: true, hardness: 2, sound: 'wood', cat: 'nature' });
  add('warped_stem', 'Gambo distorto', { tex: tsb('warped_stem_top', 'warped_stem'), axis: true, hardness: 2, sound: 'wood', cat: 'nature' });
  add('nether_wart_block', 'Blocco di verruca del Nether', { tex: t('nether_wart_block'), hardness: 1, sound: 'grass', cat: 'nature' });
  add('warped_wart_block', 'Blocco di verruca distorta', { tex: t('warped_wart_block'), hardness: 1, sound: 'grass', cat: 'nature' });
  add('shroomlight', 'Fungoluce', { tex: t('shroomlight'), emit: 15, emissive: true, hardness: 1, sound: 'grass', cat: 'deco' });
  add('crimson_planks', 'Assi cremisi', { tex: t('crimson_planks'), hardness: 2, sound: 'wood', cat: 'build' });
  add('warped_planks', 'Assi distorte', { tex: t('warped_planks'), hardness: 2, sound: 'wood', cat: 'build' });
  add('crimson_fungus', 'Fungo cremisi', plant('crimson_fungus', '', { wave: 0, support: nyl }));
  add('warped_fungus', 'Fungo distorto', plant('warped_fungus', '', { wave: 0, support: nyl }));
  add('crimson_roots', 'Radici cremisi', plant('crimson_roots', '', { support: nyl, replaceable: true }));
  add('warped_roots', 'Radici distorte', plant('warped_roots', '', { support: nyl, replaceable: true }));
  add('nether_wart', 'Verruca del Nether', { shape: 'crop', stages: ['nether_wart_0', 'nether_wart_0', 'nether_wart_1', 'nether_wart_2'], opaque: false, solid: false, lightOpacity: 0, tex: t('nether_wart_2'), hardness: 0, sound: 'grass', support: (b) => b === MC.B.soul_sand, creative: false, cat: 'nature', drop: 0, maxStage: 3 });
  // portale: meta 0 = piano lungo X, 1 = piano lungo Z
  add('nether_portal', 'Portale del Nether', mdl((m) => (m & 1 ? [[6 * H, 0, 0, 10 * H, 1, 1]] : [[0, 0, 6 * H, 1, 1, 10 * H]]), { tex: t('portal'), pass: 'translucent', solid: false, selectable: false, emit: 11, emissive: true, hardness: -1, drop: 0, creative: false, cat: 'deco', portal: true, sound: 'glass', blast: 0 }));
  add('enchanting_table', 'Tavolo per incantesimi', mdl(() => [[0, 0, 0, 1, 12 * H, 1]], { tex: { top: 'enchant_top', side: 'enchant_side', bottom: 'obsidian' }, hardness: 5, cat: 'deco', solid: true, emit: 7, interact: 'enchant', blast: 1200, lightOpacity: 0 }));
  add('crimson_slab', 'Lastra cremisi', mdl(slabModel, { texFrom: 'crimson_planks', hardness: 2, sound: 'wood', cat: 'build', solid: true, slab: 'crimson_planks' }));
  add('warped_slab', 'Lastra distorta', mdl(slabModel, { texFrom: 'warped_planks', hardness: 2, sound: 'wood', cat: 'build', solid: true, slab: 'warped_planks' }));
  add('quartz_bricks', 'Mattoni di quarzo', { tex: t('quartz_bricks'), hardness: 0.8, cat: 'build' });

  // ---------------- Oggetti (non si piazzano: ID da 256) ----------------
  nextId = 256;
  const item = (key, name, p) => add(key, name, Object.assign({ shape: 'item', item: true, opaque: false, solid: false, lightOpacity: 0, tex: t(key), cat: 'items', hardness: 0, selectable: false }, p || {}));
  item('stick', 'Bastone');
  item('coal', 'Carbone');
  item('iron_ingot', 'Lingotto di ferro');
  item('gold_ingot', 'Lingotto d\'oro');
  item('copper_ingot', 'Lingotto di rame');
  item('diamond', 'Diamante');
  item('emerald', 'Smeraldo');
  item('lapis', 'Lapislazzuli');
  item('redstone', 'Polvere di pietrarossa');
  item('string', 'Filo');
  item('bone', 'Osso');
  item('gunpowder', 'Polvere da sparo');
  item('feather', 'Piuma');
  item('leather', 'Pelle');
  item('flint', 'Selce');
  item('wheat_item', 'Frumento', { tex: t('wheat_item') });
  item('wheat_seeds', 'Semi di grano', { seeds: true });
  item('arrow', 'Freccia', { cat: 'tools' });
  item('bow', 'Arco', { cat: 'tools', stack: 1, bow: true, durability: 384 });
  item('flint_and_steel', 'Acciarino', { cat: 'tools', stack: 1, igniter: true, durability: 64 });
  const FOOD = [
    ['apple', 'Mela', 4, 2.4], ['bread', 'Pane', 5, 6], ['porkchop', 'Braciola cruda', 3, 1.8], ['cooked_porkchop', 'Braciola cotta', 8, 12.8],
    ['beef', 'Manzo crudo', 3, 1.8], ['steak', 'Bistecca', 8, 12.8], ['chicken', 'Pollo crudo', 2, 1.2], ['cooked_chicken', 'Pollo cotto', 6, 7.2],
    ['mutton', 'Montone crudo', 2, 1.2], ['cooked_mutton', 'Montone cotto', 6, 9.6], ['rotten_flesh', 'Carne marcia', 4, 0.8], ['carrot', 'Carota', 3, 3.6],
    ['golden_apple', 'Mela d\'oro', 4, 9.6],
  ];
  for (const [k, n, h, sat] of FOOD) item(k, n, { cat: 'food', food: { hunger: h, sat } });
  const TIERS = [['wooden', 'di legno', 1, 2, 59, 0], ['stone', 'di pietra', 2, 4, 131, 1], ['iron', 'di ferro', 3, 6, 250, 2], ['golden', 'd\'oro', 1, 12, 32, 0], ['diamond', 'di diamante', 4, 8, 1561, 3]];
  const TOOLS = [['pickaxe', 'Piccone', 2], ['axe', 'Ascia', 3], ['shovel', 'Pala', 1], ['sword', 'Spada', 4], ['hoe', 'Zappa', 0]];
  for (const [tt, tn, tier, speed, dur, level] of TIERS) {
    for (const [tool, name, dmg] of TOOLS) {
      item(tt + '_' + tool, name + ' ' + tn, { cat: 'tools', stack: 1, tool: { type: tool, speed, level, damage: dmg + tier }, durability: dur });
    }
  }
  const EGGS = [['pig', 'maiale', [240, 160, 160], [220, 110, 120]], ['cow', 'mucca', [68, 54, 38], [161, 161, 161]], ['sheep', 'pecora', [231, 231, 231], [255, 181, 181]],
    ['chicken', 'gallina', [161, 161, 161], [255, 0, 0]], ['zombie', 'zombie', [0, 175, 175], [121, 156, 101]], ['skeleton', 'scheletro', [193, 193, 193], [73, 73, 73]],
    ['creeper', 'creeper', [13, 161, 12], [0, 0, 0]], ['spider', 'ragno', [52, 45, 39], [165, 14, 14]], ['villager', 'villico', [86, 60, 52], [189, 138, 114]],
    ['iron_golem', 'golem di ferro', [220, 216, 206], [130, 120, 110]]];
  MC.EGG_COLORS = EGGS;
  for (const [m, n] of EGGS) item(m + '_spawn_egg', 'Uovo generatore di ' + n, { cat: 'eggs', egg: m, tex: t('egg_' + m) });

  // materiali del Nether e vari
  item('quartz', 'Quarzo del Nether');
  item('gold_nugget', 'Pepita d\'oro');
  item('glowstone_dust', 'Polvere di pietraluce');
  item('nether_brick', 'Mattone del Nether');
  item('blaze_rod', 'Verga di blaze');
  item('blaze_powder', 'Polvere di blaze');
  item('ghast_tear', 'Lacrima di ghast');
  item('magma_cream', 'Crema di magma');
  item('ender_pearl', 'Perla di ender', { stack: 16, pearl: true, cat: 'tools' });
  item('bone_meal', 'Farina d\'ossa', { boneMeal: true });
  item('paper', 'Carta');
  item('book', 'Libro');
  item('nether_wart_item', 'Verruca del Nether', { tex: t('nether_wart_item'), plant: 'nether_wart', plantOn: 'soul_sand' });
  item('cod', 'Merluzzo crudo', { cat: 'food', food: { hunger: 2, sat: 0.4 } });
  item('cooked_cod', 'Merluzzo cotto', { cat: 'food', food: { hunger: 5, sat: 6 } });
  item('experience_bottle', 'Ampolla di esperienza', { xpBottle: true, cat: 'tools' });
  // armature: slot 0 elmo, 1 corazza, 2 gambali, 3 stivali
  const ARMOR_MATS = [['leather', 'di pelle', [1, 3, 2, 1], 5, 0], ['golden', 'd\'oro', [2, 5, 3, 1], 7, 0], ['chainmail', 'di maglia', [2, 5, 4, 1], 15, 0], ['iron', 'di ferro', [2, 6, 5, 2], 15, 0], ['diamond', 'di diamante', [3, 8, 6, 3], 33, 2]];
  const ARMOR_PIECES = [['helmet', 'Elmo', 11], ['chestplate', 'Corazza', 16], ['leggings', 'Gambali', 15], ['boots', 'Stivali', 13]];
  MC.ARMOR_MATS = ARMOR_MATS; MC.ARMOR_PIECES = ARMOR_PIECES;
  for (const [mat, mn, defs, mul, tough] of ARMOR_MATS) {
    ARMOR_PIECES.forEach(([pc, pn, base], slot) => {
      item(mat + '_' + pc, pn + ' ' + mn, { cat: 'tools', stack: 1, armor: { slot, def: defs[slot], tough, mat }, durability: base * mul });
    });
  }
  const EGGS2 = [['wolf', 'lupo', [215, 215, 215], [206, 175, 150]], ['cat', 'gatto', [239, 200, 130], [110, 80, 50]], ['enderman', 'enderman', [22, 22, 22], [10, 10, 10]], ['cod', 'merluzzo', [193, 167, 118], [230, 190, 140]],
    ['zombified_piglin', 'piglin zombificato', [234, 150, 150], [77, 110, 45]], ['ghast', 'ghast', [249, 249, 249], [188, 188, 188]], ['blaze', 'blaze', [246, 178, 10], [255, 250, 150]], ['magma_cube', 'cubo di magma', [52, 10, 0], [252, 252, 0]]];
  MC.EGG_COLORS = EGGS.concat(EGGS2);
  for (const [m, n] of EGGS2) item(m + '_spawn_egg', 'Uovo generatore di ' + n, { cat: 'eggs', egg: m, tex: t('egg_' + m) });

  // Risoluzione dei drop in forma di chiave
  const defs = blocks.filter(Boolean);
  for (const d of defs) {
    if (typeof d.drop === 'string') d.drop = byKey[d.drop];
    if (d.texFrom) d.tex = blocks[byKey[d.texFrom]].tex;
    if (d.stack === undefined) d.stack = 64;
  }
  // attrezzi adatti e livello di raccolta
  const LEVEL = { iron_ore: 1, copper_ore: 1, lapis_ore: 1, lapis_block: 1, iron_block: 1, copper_block: 1, gold_ore: 2, gold_block: 2, diamond_ore: 2, diamond_block: 2, emerald_ore: 2, emerald_block: 2, redstone_ore: 2, redstone_block: 2, obsidian: 3 };
  const SHOVEL = ['dirt', 'grass', 'sand', 'red_sand', 'gravel', 'clay', 'snow', 'snowy_grass', 'podzol', 'coarse_dirt', 'farmland', 'dirt_path', 'moss_block', 'soul_sand', 'soul_soil'];
  for (const d of defs) {
    if (d.item || d.hardness <= 0) continue;
    if (SHOVEL.includes(d.key)) d.tool = 'shovel';
    else if (d.sound === 'wood') d.tool = 'axe';
    else if ((d.sound === 'stone' || d.sound === 'metal') && d.key !== 'bedrock') { d.tool = 'pickaxe'; d.needsTool = true; }
    else if (d.key.endsWith('_leaves') || d.key.endsWith('wart_block') || d.key === 'shroomlight') d.tool = 'hoe';
    d.level = LEVEL[d.key] || 0;
  }
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const dropFn = (k, fn) => { blocks[byKey[k]].dropFn = fn; };
  dropFn('coal_ore', () => [[byKey.coal, 1]]);
  dropFn('diamond_ore', () => [[byKey.diamond, 1]]);
  dropFn('emerald_ore', () => [[byKey.emerald, 1]]);
  dropFn('lapis_ore', () => [[byKey.lapis, rnd(4, 8)]]);
  dropFn('redstone_ore', () => [[byKey.redstone, rnd(4, 5)]]);
  dropFn('gravel', () => [[Math.random() < 0.1 ? byKey.flint : byKey.gravel, 1]]);
  dropFn('tall_grass', () => (Math.random() < 0.125 ? [[byKey.wheat_seeds, 1]] : []));
  dropFn('fern', () => (Math.random() < 0.125 ? [[byKey.wheat_seeds, 1]] : []));
  for (const w of WOODS) {
    dropFn(w + '_leaves', () => {
      const out = [];
      if (Math.random() < 0.05) out.push([byKey[w + '_sapling'], 1]);
      if (w === 'oak' && Math.random() < 0.02) out.push([byKey.apple, 1]);
      if (Math.random() < 0.02) out.push([byKey.stick, 1]);
      return out;
    });
  }
  dropFn('wheat', (meta) => (meta >= 7 ? [[byKey.wheat_item, 1], [byKey.wheat_seeds, rnd(1, 3)]] : [[byKey.wheat_seeds, 1]]));
  dropFn('oak_door', () => [[byKey.oak_door, 1]]);
  dropFn('nether_quartz_ore', () => [[byKey.quartz, 1]]);
  dropFn('nether_gold_ore', () => [[byKey.gold_nugget, rnd(2, 6)]]);
  dropFn('glowstone', () => [[byKey.glowstone_dust, rnd(2, 4)]]);
  dropFn('nether_wart', (meta) => [[byKey.nether_wart_item, meta >= 3 ? rnd(2, 4) : 1]]);
  // minerali che beneficiano di Fortuna
  for (const k of ['coal_ore', 'diamond_ore', 'emerald_ore', 'lapis_ore', 'redstone_ore', 'nether_quartz_ore', 'nether_gold_ore', 'glowstone']) blocks[byKey[k]].fortune = true;
  // esperienza rilasciata dai minerali
  const XPO = { coal_ore: [0, 2], diamond_ore: [3, 7], emerald_ore: [3, 7], lapis_ore: [2, 5], redstone_ore: [1, 5], nether_quartz_ore: [2, 5], nether_gold_ore: [0, 1] };
  for (const k in XPO) blocks[byKey[k]].xp = XPO[k];
  MC.defs = defs;

  // Array di lookup veloci per il mesher e la luce
  const N = 256;
  const OPAQUE = new Uint8Array(N);
  const SOLID = new Uint8Array(N);
  const LIGHT_OPACITY = new Uint8Array(N);
  const EMIT = new Uint8Array(N);
  const FLUID = new Uint8Array(N);
  const REPLACEABLE = new Uint8Array(N);
  for (const d of defs) {
    if (d.id >= N) continue;
    OPAQUE[d.id] = d.opaque && d.shape === 'cube' ? 1 : 0;
    SOLID[d.id] = d.solid ? 1 : 0;
    LIGHT_OPACITY[d.id] = d.lightOpacity;
    EMIT[d.id] = d.emit;
    FLUID[d.id] = d.fluid;
    REPLACEABLE[d.id] = d.replaceable ? 1 : 0;
  }

  MC.blocks = blocks;
  MC.B = byKey;
  MC.BL = { OPAQUE, SOLID, LIGHT_OPACITY, EMIT, FLUID, REPLACEABLE, count: defs.length };

  // Box di collisione e selezione (coordinate locali 0..1)
  // maschera di collegamento per staccionate/muri/vetri
  MC.connMask = function (get, x, y, z, id) {
    const d = blocks[id];
    let m = 0;
    const ok = (b) => {
      if (!b) return false;
      const e = blocks[b];
      if (!e) return false;
      if (e.conn && (e.conn === d.conn || (d.conn !== 'pane' && e.conn !== 'pane'))) return true;
      if (e.door && d.conn !== 'pane') return false;
      return OPAQUE[b] === 1;
    };
    if (ok(get(x + 1, y, z))) m |= 1;
    if (ok(get(x - 1, y, z))) m |= 2;
    if (ok(get(x, y, z + 1))) m |= 4;
    if (ok(get(x, y, z - 1))) m |= 8;
    return m;
  };

  MC.getSelectionBoxes = function (id, meta, conn) {
    const d = blocks[id];
    if (!d || !d.selectable) return null;
    if (d.shape === 'model') return d.model(meta, conn || 0);
    if (d.shape === 'crop') return [[0, 0, 0, 1, 0.25 + (meta & 7) * 0.09, 1]];
    const b = MC.getSelectionBox(id, meta);
    return b ? [b] : null;
  };
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
    if (d.shape === 'model') {
      const bs = d.model(meta, 0);
      const u = [1, 1, 1, 0, 0, 0];
      for (const b of bs) for (let i = 0; i < 3; i++) { u[i] = Math.min(u[i], b[i]); u[i + 3] = Math.max(u[i + 3], b[i + 3]); }
      return u;
    }
    return [0, 0, 0, 1, 1, 1];
  };
  MC.getCollisionBox = function (id) {
    const d = blocks[id];
    if (!d || !d.solid) return null;
    if (d.shape === 'cactus') return [0.0625, 0, 0.0625, 0.9375, 0.9375, 0.9375];
    if (d.shape === 'model') return d.model(0, 0)[0];
    return [0, 0, 0, 1, 1, 1];
  };
  // tutte le scatole di collisione di un blocco
  MC.getCollisionBoxes = function (id, meta, conn) {
    const d = blocks[id];
    if (!d || !d.solid) return null;
    if (d.shape === 'model') {
      const bs = d.model(meta, conn || 0);
      if (d.tall) return bs.map((b) => [b[0], b[1], b[2], b[3], Math.max(b[4], 1.5), b[5]]);
      return bs;
    }
    const b = MC.getCollisionBox(id);
    return b ? [b] : null;
  };
})();
