// Avvio del Web Worker che genera il terreno
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const FILES = ['js/noise.js', 'js/blocks.js', 'js/generator.js'];
  let sourceP = null;

  function loadSource() {
    if (!sourceP) {
      sourceP = Promise.all(FILES.map((f) => fetch(f).then((r) => { if (!r.ok) throw new Error(f); return r.text(); })))
        .then((parts) => parts.join('\n;\n'))
        .catch(() => null);
    }
    return sourceP;
  }

  const BODY = `
self.window = self;
let gen = null;
self.onmessage = function (e) {
  const d = e.data;
  if (d.init) { gen = new MC.Generator(d.seed, d.type); return; }
  const c = { cx: d.cx, cz: d.cz, blocks: new Uint8Array(16 * 16 * MC.WH), biome: new Uint8Array(256), grass: new Uint8Array(768), foliage: new Uint8Array(768), surf: new Uint8Array(256), surfId: new Uint8Array(256) };
  gen.generateTerrain(c);
  self.postMessage(c, [c.blocks.buffer, c.biome.buffer, c.grass.buffer, c.foliage.buffer, c.surf.buffer, c.surfId.buffer]);
};`;

  // Restituisce un worker pronto o null (in quel caso si genera sul thread principale)
  MC.createTerrainWorker = async function (seed, type) {
    try {
      if (typeof Worker === 'undefined' || location.protocol === 'file:') return null;
      const src = await loadSource();
      if (!src) return null;
      const url = URL.createObjectURL(new Blob(['self.window = self;\n' + src + '\n' + BODY], { type: 'text/javascript' }));
      const w = new Worker(url);
      w.postMessage({ init: true, seed, type });
      return w;
    } catch (e) {
      return null;
    }
  };
})();
