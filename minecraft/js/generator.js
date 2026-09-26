// Generazione procedurale del terreno
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const { hash2, hash3, mulberry32, clamp, lerp, smoothstep } = MC.util;
  const B = MC.B;

  const WH = 192, SEA = 63;

  const BIOMES = [
    { name: 'Oceano' }, { name: 'Pianura' }, { name: 'Foresta' }, { name: 'Foresta di betulle' }, { name: 'Taiga' },
    { name: 'Pianura innevata' }, { name: 'Taiga innevata' }, { name: 'Deserto' }, { name: 'Savana' }, { name: 'Giungla' },
    { name: 'Palude' }, { name: 'Calanchi' }, { name: 'Montagne' }, { name: 'Spiaggia' }, { name: 'Fiume' },
    { name: 'Oceano ghiacciato' }, { name: 'Prateria fiorita' }, { name: 'Foresta fitta' }, { name: 'Picchi innevati' },
  ];
  const BI = {
    OCEAN: 0, PLAINS: 1, FOREST: 2, BIRCH: 3, TAIGA: 4, SNOWY_PLAINS: 5, SNOWY_TAIGA: 6, DESERT: 7, SAVANNA: 8, JUNGLE: 9,
    SWAMP: 10, BADLANDS: 11, MOUNTAINS: 12, BEACH: 13, RIVER: 14, FROZEN_OCEAN: 15, MEADOW: 16, DARK_FOREST: 17, PEAKS: 18,
  };

  const TREE_DENSITY = new Float32Array(19);
  TREE_DENSITY[BI.PLAINS] = 0.0025; TREE_DENSITY[BI.FOREST] = 0.05; TREE_DENSITY[BI.BIRCH] = 0.045; TREE_DENSITY[BI.TAIGA] = 0.045;
  TREE_DENSITY[BI.SNOWY_PLAINS] = 0.002; TREE_DENSITY[BI.SNOWY_TAIGA] = 0.035; TREE_DENSITY[BI.SAVANNA] = 0.006; TREE_DENSITY[BI.JUNGLE] = 0.1;
  TREE_DENSITY[BI.SWAMP] = 0.02; TREE_DENSITY[BI.MOUNTAINS] = 0.004; TREE_DENSITY[BI.MEADOW] = 0.0012; TREE_DENSITY[BI.DARK_FOREST] = 0.085;
  TREE_DENSITY[BI.RIVER] = 0.004; TREE_DENSITY[BI.BEACH] = 0;

  const col = { h: 0, amp: 0, T: 0, H: 0, mount: 0, river: 0, swamp: 0, bad: 0 };

  class Generator {
    constructor(seed, type) {
      this.seed = seed >>> 0;
      this.type = type || 'normal';
      const mk = (k) => new MC.Simplex((this.seed ^ Math.imul(k, 0x9e3779b1)) >>> 0);
      this.nCont = mk(1); this.nEro = mk(2); this.nPeak = mk(3); this.nTemp = mk(4); this.nHum = mk(5);
      this.nDetail = mk(6); this.nRiver = mk(7); this.n3 = mk(8); this.nCaveA = mk(9); this.nCaveB = mk(10);
      this.nCheese = mk(11); this.nMisc = mk(12); this.nSurf = mk(13);
      // bande di terracotta dei calanchi
      const r = mulberry32(this.seed ^ 0x5bd1e995);
      const opts = [B.terracotta, B.terracotta, B.orange_terracotta, B.orange_terracotta, B.yellow_terracotta, B.red_terracotta, B.brown_terracotta, B.white_terracotta, B.light_gray_terracotta];
      this.bands = new Uint8Array(64);
      for (let i = 0; i < 64; i++) this.bands[i] = opts[Math.floor(r() * opts.length)];
    }

    column(x, z, o) {
      const cc = this.nCont.fbm2(x / 1100, z / 1100, 5) * 1.5 + 0.12;
      const e = this.nEro.fbm2(x / 700, z / 700, 3) * 1.4;
      const pk = 1 - Math.abs(this.nPeak.fbm2(x / 340, z / 340, 4) * 1.3);
      const T = this.nTemp.fbm2(x / 3000, z / 3000, 3) * 1.8 + this.nDetail.noise2D(x / 90, z / 90) * 0.03;
      const H = this.nHum.fbm2(x / 2400, z / 2400, 3) * 1.8 + this.nDetail.noise2D(x / 70 + 50, z / 70) * 0.03;

      let base;
      if (cc < -0.45) base = lerp(26, 42, smoothstep(-0.95, -0.45, cc));
      else if (cc < -0.15) base = lerp(42, SEA - 4, smoothstep(-0.45, -0.15, cc));
      else if (cc < 0.0) base = lerp(SEA - 4, SEA + 3, smoothstep(-0.15, 0.0, cc));
      else base = SEA + 3 + smoothstep(0, 0.9, cc) * 20;
      const land = smoothstep(-0.2, 0.05, cc);
      const rough = smoothstep(-0.4, 0.5, -e);
      const hills = this.nDetail.fbm2(x / 150, z / 150, 4) * (4 + 12 * rough);
      const mount = smoothstep(0.02, 0.4, cc) * smoothstep(0.05, -0.45, e);
      const pkc = clamp(pk, 0, 1);
      const peaks = Math.pow(pkc, 2.0) * 100 * mount;
      let h = base + hills * land + peaks;

      const rv = Math.abs(this.nRiver.fbm2(x / 650, z / 650, 3));
      const riverF = land * (1 - smoothstep(0.02, 0.07, rv)) * (1 - mount * 0.8);
      h = lerp(h, SEA - 5 + rv * 30, riverF);

      const swampF = land * smoothstep(0.5, 0.68, H) * smoothstep(-0.3, -0.1, T) * smoothstep(0.35, 0.15, T) * (1 - mount) * (1 - riverF);
      h = lerp(h, SEA + 0.6 + this.nDetail.noise2D(x / 18, z / 18) * 1.6, swampF * 0.9);

      const badF = land * smoothstep(0.55, 0.72, T) * smoothstep(-0.3, -0.5, H) * (1 - riverF) * (1 - mount * 0.5);
      if (badF > 0.001) {
        const hb = h + 16 * badF + Math.max(0, this.nDetail.fbm2(x / 70, z / 70, 2)) * 34 * badF;
        const step = 7;
        const fr = hb / step - Math.floor(hb / step);
        const tq = Math.floor(hb / step) * step + smoothstep(0.75, 1, fr) * step;
        h = lerp(h, tq, smoothstep(0, 0.6, badF));
      }
      o.h = h;
      o.amp = (2.2 + 20 * mount) * (1 - riverF * 0.8) * (1 - swampF) * (1 - badF * 0.7);
      o.T = T; o.H = H; o.mount = mount; o.river = riverF; o.swamp = swampF; o.bad = badF;
      return o;
    }

    biomeOf(o) {
      const h = o.h;
      const T = o.T - Math.max(0, h - (SEA + 45)) / 70;
      if (h < SEA - 3.5) {
        if (o.river > 0.5) return BI.RIVER;
        return T < -0.6 ? BI.FROZEN_OCEAN : BI.OCEAN;
      }
      if (o.river > 0.55 && h < SEA + 1) return BI.RIVER;
      if (o.mount > 0.3 && h > SEA + 52) return T < -0.45 ? BI.PEAKS : BI.MOUNTAINS;
      if (o.swamp > 0.5) return BI.SWAMP;
      if (o.bad > 0.5) return BI.BADLANDS;
      if (h < SEA + 2.2 && T > -0.55) return BI.BEACH;
      if (T < -0.58) return o.H > 0 ? BI.SNOWY_TAIGA : BI.SNOWY_PLAINS;
      if (T < -0.3) return BI.TAIGA;
      if (T < 0.3) {
        if (o.H < -0.35) return BI.PLAINS;
        if (o.H < -0.15) return BI.MEADOW;
        if (o.H < 0.2) return BI.FOREST;
        if (o.H < 0.42) return BI.BIRCH;
        return BI.DARK_FOREST;
      }
      if (o.H < -0.12) return BI.DESERT;
      if (o.H < 0.15) return BI.SAVANNA;
      return BI.JUNGLE;
    }

    // colori di erba e foglie
    tint(o, out, off) {
      const t = clamp((o.T + 1) / 2, 0, 1), hu = clamp((o.H + 1) / 2, 0, 1);
      const cold = [128, 180, 151], temp = [121, 192, 90], hotDry = [191, 183, 85], hotWet = [71, 205, 51];
      let g;
      if (t < 0.5) {
        const k = smoothstep(0.1, 0.5, t);
        g = [lerp(cold[0], temp[0], k), lerp(cold[1], temp[1], k), lerp(cold[2], temp[2], k)];
      } else {
        const hc = [lerp(hotDry[0], hotWet[0], hu), lerp(hotDry[1], hotWet[1], hu), lerp(hotDry[2], hotWet[2], hu)];
        const k = smoothstep(0.5, 0.9, t);
        g = [lerp(temp[0], hc[0], k), lerp(temp[1], hc[1], k), lerp(temp[2], hc[2], k)];
      }
      const sw = [106, 112, 57], bd = [144, 129, 77];
      g = [lerp(g[0], sw[0], o.swamp), lerp(g[1], sw[1], o.swamp), lerp(g[2], sw[2], o.swamp)];
      g = [lerp(g[0], bd[0], o.bad), lerp(g[1], bd[1], o.bad), lerp(g[2], bd[2], o.bad)];
      out.grass[off] = g[0]; out.grass[off + 1] = g[1]; out.grass[off + 2] = g[2];
      out.foliage[off] = g[0] * 0.82; out.foliage[off + 1] = g[1] * 0.9; out.foliage[off + 2] = g[2] * 0.78;
    }

    fillClimate(c) {
      const bx = c.cx * 16, bz = c.cz * 16;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        if (this.type === 'flat') { col.h = SEA; col.T = 0; col.H = -0.5; col.mount = 0; col.river = 0; col.swamp = 0; col.bad = 0; }
        else this.column(bx + x, bz + z, col);
        const ci = z * 16 + x;
        c.biome[ci] = this.type === 'flat' ? BI.PLAINS : this.biomeOf(col);
        this.tint(col, c, ci * 3);
      }
    }

    generateTerrain(c) {
      if (this.type === 'flat') return this.generateFlat(c);
      const bx = c.cx * 16, bz = c.cz * 16;
      const blocks = c.blocks;
      // colonne con bordo di 1 per la pendenza
      const Hs = new Float32Array(18 * 18);
      const AMP = new Float32Array(256);
      const cinfo = [];
      for (let z = -1; z <= 16; z++) for (let x = -1; x <= 16; x++) {
        this.column(bx + x, bz + z, col);
        Hs[(z + 1) * 18 + (x + 1)] = col.h;
        if (x >= 0 && x < 16 && z >= 0 && z < 16) {
          const ci = z * 16 + x;
          AMP[ci] = col.amp;
          c.biome[ci] = this.biomeOf(col);
          this.tint(col, c, ci * 3);
          cinfo[ci] = { T: col.T, mount: col.mount };
        }
      }
      // griglia 3D (passo 4 x 8 x 4)
      const GY = WH / 8 + 1;
      const N3 = new Float32Array(5 * GY * 5);
      for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++) for (let gy = 0; gy < GY; gy++) {
        N3[(gz * 5 + gx) * GY + gy] = this.n3.fbm3((bx + gx * 4) / 50, (gy * 8) / 34, (bz + gz * 4) / 50, 2);
      }
      // grotte (passo 4)
      const CY = WH / 4 + 1;
      const CA = new Float32Array(5 * CY * 5), CB = new Float32Array(5 * CY * 5), CH = new Float32Array(5 * CY * 5);
      for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++) for (let gy = 0; gy < CY; gy++) {
        const wx = bx + gx * 4, wy = gy * 4, wz = bz + gz * 4;
        const k = (gz * 5 + gx) * CY + gy;
        if (wy > 150) { CA[k] = 1; CB[k] = 1; CH[k] = 0; continue; }
        CA[k] = this.nCaveA.noise3D(wx / 42, wy / 26, wz / 42);
        CB[k] = this.nCaveB.noise3D(wx / 42, wy / 26, wz / 42);
        CH[k] = wy < 56 ? this.nCheese.fbm3(wx / 80, wy / 40, wz / 80, 2) : 0;
      }

      const col3 = new Float32Array(GY), cA = new Float32Array(CY), cB = new Float32Array(CY), cH = new Float32Array(CY);
      const bil = (arr, G, x, z, out) => {
        const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
        const i00 = (gz * 5 + gx) * G, i10 = (gz * 5 + gx + 1) * G, i01 = ((gz + 1) * 5 + gx) * G, i11 = ((gz + 1) * 5 + gx + 1) * G;
        for (let g = 0; g < G; g++) {
          const a = arr[i00 + g] + (arr[i10 + g] - arr[i00 + g]) * fx;
          const b = arr[i01 + g] + (arr[i11 + g] - arr[i01 + g]) * fx;
          out[g] = a + (b - a) * fz;
        }
      };

      const W = B.water, AIR = 0;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const ci = z * 16 + x;
        const wx = bx + x, wz = bz + z;
        const h = Hs[(z + 1) * 18 + (x + 1)];
        const amp = AMP[ci];
        const biome = c.biome[ci];
        const info = cinfo[ci];
        bil(N3, GY, x, z, col3);
        const slope = Math.max(Math.abs(Hs[(z + 1) * 18 + x + 2] - Hs[(z + 1) * 18 + x]), Math.abs(Hs[(z + 2) * 18 + x + 1] - Hs[z * 18 + x + 1])) / 2;
        const minY = Math.max(1, Math.floor(h - amp - 2)), maxY = Math.min(WH - 1, Math.ceil(h + amp + 2));
        const sn = this.nSurf.noise2D(wx / 12, wz / 12);
        const sn2 = this.nSurf.noise2D(wx / 30 + 100, wz / 30);
        const fillerDepth = 3 + Math.floor((sn + 1) * 1.5);
        const frozen = biome === BI.FROZEN_OCEAN || biome === BI.SNOWY_PLAINS || biome === BI.SNOWY_TAIGA || biome === BI.PEAKS || (biome === BI.RIVER && info.T < -0.5);
        const snowLine = SEA + 78 + sn * 8 - (info.T < -0.2 ? 25 : 0);
        const deepY = 12 + Math.floor(sn * 3);

        // scelta di blocchi superficie
        let top = B.grass, fill = B.dirt, uwTop = B.sand, uwFill = B.sand;
        switch (biome) {
          case BI.DESERT: top = B.sand; fill = B.sand; break;
          case BI.BEACH: top = sn2 > 0.55 ? B.gravel : B.sand; fill = top; break;
          case BI.SNOWY_PLAINS: case BI.SNOWY_TAIGA: top = B.snowy_grass; break;
          case BI.TAIGA: top = sn2 > 0.3 ? B.podzol : sn2 < -0.5 ? B.coarse_dirt : B.grass; break;
          case BI.SAVANNA: top = sn2 > 0.5 ? B.coarse_dirt : B.grass; break;
          case BI.JUNGLE: top = sn2 > 0.55 ? B.podzol : B.grass; break;
          case BI.DARK_FOREST: top = sn2 > 0.6 ? B.moss_block : B.grass; break;
          case BI.BADLANDS: top = B.red_sand; fill = B.red_sand; break;
          case BI.MOUNTAINS: case BI.PEAKS: top = B.stone; fill = B.stone; break;
          case BI.SWAMP: uwTop = B.clay; uwFill = B.dirt; break;
          case BI.RIVER: uwTop = sn2 > 0.2 ? B.gravel : sn2 < -0.4 ? B.clay : B.sand; uwFill = uwTop === B.clay ? B.dirt : B.sand; break;
          case BI.OCEAN: case BI.FROZEN_OCEAN: uwTop = h < 45 ? B.gravel : (sn2 > 0.45 ? B.gravel : B.sand); uwFill = uwTop; break;
        }
        const steep = slope > 1.7;
        if ((biome === BI.MOUNTAINS || biome === BI.PEAKS) && slope < 0.9 && info.T > -0.3) { top = B.grass; fill = B.dirt; }
        else if (steep && biome !== BI.BADLANDS && biome !== BI.DESERT) { top = sn2 > 0.3 ? B.gravel : B.stone; fill = B.stone; }

        let sinceAir = 0;
        let surfY = -1;
        for (let y = WH - 1; y >= 0; y--) {
          const i = (y << 8) | (z << 4) | x;
          let solid;
          if (y > maxY) solid = false;
          else if (y < minY) solid = true;
          else {
            const gy = y >> 3, fy = (y & 7) / 8;
            const n = col3[gy] + (col3[gy + 1] - col3[gy]) * fy;
            solid = h - y + n * amp > 0;
          }
          if (!solid) {
            sinceAir = 0;
            if (y <= SEA) blocks[i] = (y === SEA && frozen) ? B.ice : W;
            else blocks[i] = AIR;
            continue;
          }
          if (surfY < 0) surfY = y;
          let b;
          if (y === 0) b = B.bedrock;
          else if (y <= 4 && hash3(this.seed, wx, y, wz) < (5 - y) / 5.5) b = B.bedrock;
          else {
            const k = sinceAir;
            const under = y < SEA;
            if (biome === BI.BADLANDS && y >= SEA - 6 && k > 0 && k < 40) b = this.bands[(y + Math.floor(sn * 2)) & 63];
            else if (k === 0) {
              if (under) b = uwTop;
              else if (y > snowLine && (biome === BI.MOUNTAINS || biome === BI.PEAKS || steep)) b = B.snow;
              else b = top;
              if (b === B.grass && y > snowLine - 4 && info.T < 0) b = B.snowy_grass;
            } else if (k < fillerDepth) b = under ? uwFill : fill;
            else if (k < fillerDepth + 3 && (biome === BI.DESERT || biome === BI.BEACH) && !under) b = B.sandstone;
            else b = y < deepY ? B.deepslate : B.stone;
            if (y < deepY - 3 && b === B.stone) b = B.deepslate;
          }
          blocks[i] = b;
          sinceAir++;
        }

        // grotte
        bil(CA, CY, x, z, cA); bil(CB, CY, x, z, cB); bil(CH, CY, x, z, cH);
        const nearWater = surfY < SEA + 3;
        const lim = Math.min(surfY, 150);
        for (let y = 1; y <= lim; y++) {
          if (nearWater && y > surfY - 7) break;
          const i = (y << 8) | (z << 4) | x;
          const b = blocks[i];
          if (b === B.bedrock || b === W || b === AIR || b === B.ice) continue;
          const gy = y >> 2, fy = (y & 3) / 4;
          const a = cA[gy] + (cA[gy + 1] - cA[gy]) * fy;
          const bb = cB[gy] + (cB[gy + 1] - cB[gy]) * fy;
          let thr = 0.012 + (y < 30 ? 0.006 : 0);
          if (y > surfY - 4) thr *= 0.6; // entrate più strette
          let carve = a * a + bb * bb < thr;
          if (!carve && y < 56) {
            const ch = cH[gy] + (cH[gy + 1] - cH[gy]) * fy;
            carve = ch > 0.56 + (y > 40 ? (y - 40) * 0.02 : 0);
          }
          if (carve) blocks[i] = y <= 10 ? B.lava : AIR;
        }
        // superficie finale
        let sy = WH - 1;
        while (sy > 0 && (blocks[(sy << 8) | (z << 4) | x] === AIR || blocks[(sy << 8) | (z << 4) | x] === W || blocks[(sy << 8) | (z << 4) | x] === B.ice)) sy--;
        c.surf[ci] = sy;
        c.surfId[ci] = blocks[(sy << 8) | (z << 4) | x];
      }

      this.generateOres(c);
    }

    generateOres(c) {
      const rng = mulberry32((this.seed ^ Math.imul(c.cx, 0x632be5ab) ^ Math.imul(c.cz, 0x85157af5)) >>> 0);
      const blocks = c.blocks;
      const vein = (id, count, size, ymin, ymax) => {
        for (let n = 0; n < count; n++) {
          let x = Math.floor(rng() * 16), z = Math.floor(rng() * 16);
          let y = ymin + Math.floor(rng() * (ymax - ymin));
          for (let k = 0; k < size; k++) {
            if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < WH) {
              const i = (y << 8) | (z << 4) | x;
              const b = blocks[i];
              if (b === B.stone || b === B.deepslate) blocks[i] = id;
            }
            const d = Math.floor(rng() * 6);
            if (d === 0) x++; else if (d === 1) x--; else if (d === 2) z++; else if (d === 3) z--; else if (d === 4) y++; else y--;
          }
        }
      };
      vein(B.dirt, 6, 24, 5, 120);
      vein(B.gravel, 5, 24, 5, 120);
      vein(B.granite, 5, 30, 5, 110);
      vein(B.diorite, 5, 30, 5, 110);
      vein(B.andesite, 5, 30, 5, 110);
      vein(B.coal_ore, 18, 12, 5, 135);
      vein(B.iron_ore, 14, 8, 3, 72);
      vein(B.copper_ore, 7, 9, 30, 96);
      vein(B.gold_ore, 4, 8, 3, 34);
      vein(B.redstone_ore, 6, 7, 2, 16);
      vein(B.lapis_ore, 3, 6, 2, 32);
      vein(B.diamond_ore, 2, 6, 2, 16);
      // smeraldi nelle montagne
      let mountain = 0;
      for (let i = 0; i < 256; i++) if (c.biome[i] === BI.MOUNTAINS || c.biome[i] === BI.PEAKS) mountain++;
      if (mountain > 64) vein(B.emerald_ore, 4, 1, 40, 170);
      // ametista rara
      if (rng() < 0.04) vein(B.amethyst_block, 1, 14, 10, 40);
    }

    generateFlat(c) {
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const ci = z * 16 + x;
        c.biome[ci] = BI.PLAINS;
        col.T = 0.1; col.H = -0.4; col.swamp = 0; col.bad = 0;
        this.tint(col, c, ci * 3);
        c.blocks[(0 << 8) | (z << 4) | x] = B.bedrock;
        for (let y = 1; y <= 3; y++) c.blocks[(y << 8) | (z << 4) | x] = B.dirt;
        c.blocks[(4 << 8) | (z << 4) | x] = B.grass;
        c.surf[ci] = 4; c.surfId[ci] = B.grass;
      }
    }

    // ------------------ Decorazione ------------------
    // Scrive solo dentro il chunk c; considera anche gli alberi dei chunk vicini
    populate(world, c) {
      if (this.type === 'flat') return;
      const bx = c.cx * 16, bz = c.cz * 16;
      const blocks = c.blocks;
      const M = 6;
      const self = this;
      const REPL = MC.BL.REPLACEABLE;
      const isLeaf = (b) => b === B.oak_leaves || b === B.birch_leaves || b === B.spruce_leaves || b === B.jungle_leaves || b === B.acacia_leaves;
      const put = (x, y, z, id, mode) => {
        x -= bx; z -= bz;
        if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1 || y >= WH) return;
        const i = (y << 8) | (z << 4) | x;
        const cur = blocks[i];
        if (mode === 1) { // tronco
          if (cur === 0 || isLeaf(cur) || (REPL[cur] && cur !== B.water && cur !== B.lava)) blocks[i] = id;
        } else if (mode === 2) { // foglie
          if (cur === 0 || cur === B.tall_grass || cur === B.fern) blocks[i] = id;
        } else if (mode === 3) { // sostituisci terreno
          if (cur !== B.bedrock) blocks[i] = id;
        }
      };
      const getSurfChunk = (x, z) => {
        const ch = world.getChunk(x >> 4, z >> 4);
        return ch && ch.state >= 1 ? ch : null;
      };

      for (let wz = bz - M; wz < bz + 16 + M; wz++) {
        for (let wx = bx - M; wx < bx + 16 + M; wx++) {
          const ch = getSurfChunk(wx, wz);
          if (!ch) continue;
          const ci = ((wz & 15) << 4) | (wx & 15);
          const s = ch.surf[ci];
          const sid = ch.surfId[ci];
          const biome = ch.biome[ci];
          const r = hash2(this.seed ^ 0xa1b2c3, wx, wz);
          const inside = wx >= bx && wx < bx + 16 && wz >= bz && wz < bz + 16;
          const rng = mulberry32((this.seed ^ Math.imul(wx, 0x2545f491) ^ Math.imul(wz, 0x9e3779b9)) >>> 0);
          const groundOk = (sid === B.grass || sid === B.podzol || sid === B.snowy_grass || sid === B.dirt || sid === B.coarse_dirt || sid === B.moss_block) && s >= SEA && s < WH - 20;

          if (groundOk && r < TREE_DENSITY[biome] && !this.inVillage(wx, wz)) {
            this.tree(biome, wx, s, wz, rng, put);
            continue;
          }
          // massi muschiosi nella taiga
          if (groundOk && (biome === BI.TAIGA || biome === BI.SNOWY_TAIGA) && r > 0.9985) {
            const rad = 1 + Math.floor(rng() * 2);
            for (let dy = -1; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
              if (dx * dx + dy * dy + dz * dz <= rad * rad + 1) put(wx + dx, s + dy + 1, wz + dz, B.mossy_cobblestone, dy < 1 ? 3 : 1);
            }
            continue;
          }
          if (!inside) continue;
          const lx = wx - bx, lz = wz - bz;
          const above = ((s + 1) << 8) | (lz << 4) | lx;
          if (s + 1 >= WH || blocks[above] !== 0) continue;
          const r2 = hash2(this.seed ^ 0x77aa55, wx, wz);
          // cactus e arbusti nel deserto
          if (sid === B.sand && (biome === BI.DESERT) && s >= SEA) {
            if (r < 0.006 && this._clearAround(blocks, lx, s + 1, lz)) {
              const hgt = 1 + Math.floor(rng() * 3);
              for (let k = 1; k <= hgt; k++) if (s + k < WH) blocks[((s + k) << 8) | (lz << 4) | lx] = B.cactus;
            } else if (r2 < 0.012) blocks[above] = B.dead_bush;
            continue;
          }
          if ((sid === B.red_sand || sid === B.terracotta) && r2 < 0.012) { blocks[above] = B.dead_bush; continue; }
          // canna da zucchero vicino all'acqua
          if ((sid === B.grass || sid === B.sand || sid === B.dirt) && s === SEA && r2 < 0.18) {
            if (this._nearWater(world, wx, s, wz)) {
              const hgt = 1 + Math.floor(rng() * 3);
              for (let k = 1; k <= hgt; k++) blocks[((s + k) << 8) | (lz << 4) | lx] = B.sugar_cane;
              continue;
            }
          }
          if (!groundOk) continue;
          // fiori
          const fl = this.nMisc.noise2D(wx / 28, wz / 28);
          let flowerChance = 0.0;
          if (biome === BI.MEADOW) flowerChance = 0.14;
          else if (biome === BI.PLAINS || biome === BI.FOREST || biome === BI.BIRCH) flowerChance = fl > 0.4 ? 0.12 : 0.006;
          else if (biome === BI.SWAMP) flowerChance = 0.02;
          else if (biome === BI.JUNGLE || biome === BI.SAVANNA || biome === BI.DARK_FOREST) flowerChance = 0.004;
          if (r2 < flowerChance) {
            let f;
            if (biome === BI.SWAMP) f = B.blue_orchid;
            else {
              const ft = this.nMisc.noise2D(wx / 60 + 300, wz / 60);
              const list = biome === BI.MEADOW
                ? [B.cornflower, B.allium, B.oxeye_daisy, B.pink_tulip, B.dandelion, B.poppy, B.lily_of_the_valley]
                : [B.dandelion, B.poppy, B.oxeye_daisy, B.dandelion, B.poppy, B.cornflower, B.lily_of_the_valley];
              f = list[Math.min(list.length - 1, Math.floor((ft * 0.5 + 0.5) * list.length + (rng() - 0.5) * 1.5 + list.length) % list.length)];
            }
            blocks[above] = f;
            continue;
          }
          // zucche
          if ((biome === BI.PLAINS || biome === BI.MEADOW) && r2 > 0.9992) { blocks[above] = B.pumpkin; continue; }
          // funghi
          if ((biome === BI.DARK_FOREST || biome === BI.TAIGA || biome === BI.SWAMP) && r2 > 0.985) { blocks[above] = r2 > 0.993 ? B.red_mushroom : B.brown_mushroom; continue; }
          // erba alta / felci
          let grassChance = 0.1;
          switch (biome) {
            case BI.PLAINS: grassChance = 0.3; break;
            case BI.MEADOW: grassChance = 0.4; break;
            case BI.SAVANNA: grassChance = 0.4; break;
            case BI.JUNGLE: grassChance = 0.35; break;
            case BI.FOREST: case BI.BIRCH: case BI.DARK_FOREST: grassChance = 0.15; break;
            case BI.TAIGA: case BI.SNOWY_TAIGA: grassChance = 0.12; break;
            case BI.SWAMP: grassChance = 0.15; break;
            case BI.SNOWY_PLAINS: case BI.PEAKS: grassChance = 0.02; break;
            case BI.MOUNTAINS: grassChance = 0.12; break;
          }
          if (sid === B.snowy_grass) grassChance *= 0.2;
          if (r2 < flowerChance + grassChance) {
            const fern = (biome === BI.TAIGA || biome === BI.SNOWY_TAIGA || biome === BI.JUNGLE) && rng() < 0.5;
            blocks[above] = fern ? B.fern : B.tall_grass;
          }
        }
      }
      void self;
      this._populateVillages(c);
    }

    _clearAround(blocks, x, y, z) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nx > 15 || nz < 0 || nz > 15) return false;
        if (blocks[(y << 8) | (nz << 4) | nx] !== 0) return false;
      }
      return true;
    }

    _nearWater(world, x, y, z) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ch = world.getChunk((x + dx) >> 4, (z + dz) >> 4);
        if (!ch) continue;
        const b = ch.blocks[(y << 8) | (((z + dz) & 15) << 4) | ((x + dx) & 15)];
        if (b === B.water) return true;
      }
      return false;
    }

    tree(biome, x, y, z, rng, put) {
      switch (biome) {
        case BI.BIRCH:
          if (rng() < 0.8) return this.oak(x, y, z, rng, put, B.birch_log, B.birch_leaves, 5 + Math.floor(rng() * 3));
          return this.oak(x, y, z, rng, put, B.oak_log, B.oak_leaves, 4 + Math.floor(rng() * 3));
        case BI.TAIGA: case BI.SNOWY_TAIGA: case BI.MOUNTAINS: case BI.SNOWY_PLAINS: case BI.PEAKS:
          return this.spruce(x, y, z, rng, put);
        case BI.JUNGLE:
          if (rng() < 0.45) return this.bush(x, y, z, rng, put);
          return this.jungle(x, y, z, rng, put);
        case BI.SAVANNA:
          return this.acacia(x, y, z, rng, put);
        case BI.DARK_FOREST:
          if (rng() < 0.6) return this.bigOak(x, y, z, rng, put);
          return this.oak(x, y, z, rng, put, B.oak_log, B.oak_leaves, 5 + Math.floor(rng() * 2));
        case BI.SWAMP:
          return this.swampOak(x, y, z, rng, put);
        case BI.FOREST:
          if (rng() < 0.2) return this.oak(x, y, z, rng, put, B.birch_log, B.birch_leaves, 5 + Math.floor(rng() * 3));
          if (rng() < 0.12) return this.bigOak(x, y, z, rng, put);
          return this.oak(x, y, z, rng, put, B.oak_log, B.oak_leaves, 4 + Math.floor(rng() * 3));
        default:
          if (rng() < 0.1) return this.bigOak(x, y, z, rng, put);
          return this.oak(x, y, z, rng, put, B.oak_log, B.oak_leaves, 4 + Math.floor(rng() * 3));
      }
    }

    oak(x, y, z, rng, put, log, leaf, h) {
      put(x, y, z, B.dirt, 3);
      for (let yy = y + h - 2; yy <= y + h + 1; yy++) {
        const top = yy >= y + h;
        const r = top ? 1 : 2;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          const corner = Math.abs(dx) === r && Math.abs(dz) === r;
          if (corner && (top || rng() < 0.5)) continue;
          if (yy === y + h + 1 && (dx !== 0 && dz !== 0)) continue;
          put(x + dx, yy, z + dz, leaf, 2);
        }
      }
      for (let k = 1; k <= h; k++) put(x, y + k, z, log, 1);
    }

    bigOak(x, y, z, rng, put) {
      const h = 6 + Math.floor(rng() * 4);
      put(x, y, z, B.dirt, 3);
      const blobs = [[0, h, 0, 3]];
      const nb = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < nb; i++) {
        const a = rng() * Math.PI * 2, d = 2 + rng() * 1.5;
        const bxo = Math.round(Math.cos(a) * d), bzo = Math.round(Math.sin(a) * d), by = h - 2 - Math.floor(rng() * 3);
        blobs.push([bxo, by, bzo, 2]);
        // ramo
        const steps = Math.max(Math.abs(bxo), Math.abs(bzo));
        for (let s = 1; s <= steps; s++) {
          put(x + Math.round((bxo * s) / steps), y + by - steps + s, z + Math.round((bzo * s) / steps), B.oak_log, 1);
        }
      }
      for (const [ox, oy, oz, r] of blobs) {
        for (let dx = -r; dx <= r; dx++) for (let dy = -1; dy <= r - 1; dy++) for (let dz = -r; dz <= r; dz++) {
          const d = dx * dx + dz * dz + dy * dy * 1.6;
          if (d <= r * r + 0.5 && !(d > r * r - 1 && rng() < 0.3)) put(x + ox + dx, y + oy + dy, z + oz + dz, B.oak_leaves, 2);
        }
      }
      for (let k = 1; k <= h; k++) put(x, y + k, z, B.oak_log, 1);
    }

    swampOak(x, y, z, rng, put) {
      const h = 4 + Math.floor(rng() * 2);
      for (let yy = y + h - 2; yy <= y + h + 1; yy++) {
        const r = yy >= y + h ? 2 : 3;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
          if (yy === y + h + 1 && Math.abs(dx) + Math.abs(dz) > 2) continue;
          put(x + dx, yy, z + dz, B.oak_leaves, 2);
        }
      }
      for (let k = 1; k <= h; k++) put(x, y + k, z, B.oak_log, 1);
    }

    spruce(x, y, z, rng, put) {
      const h = 7 + Math.floor(rng() * 5);
      put(x, y, z, B.dirt, 3);
      const topY = y + h + 1;
      const start = y + 2 + Math.floor(rng() * 2);
      let r = 0, maxR = 2 + (rng() < 0.5 ? 1 : 0);
      put(x, topY + 1, z, B.spruce_leaves, 2);
      for (let yy = topY; yy >= start; yy--) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (r > 0 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
          put(x + dx, yy, z + dz, B.spruce_leaves, 2);
        }
        r++;
        if (r > maxR) { r = 1; maxR = Math.min(maxR + (rng() < 0.5 ? 1 : 0), 3); }
      }
      for (let k = 1; k <= h; k++) put(x, y + k, z, B.spruce_log, 1);
    }

    jungle(x, y, z, rng, put) {
      const h = 9 + Math.floor(rng() * 9);
      put(x, y, z, B.dirt, 3);
      for (let yy = y + h - 2; yy <= y + h + 1; yy++) {
        const r = yy >= y + h ? 2 : 3;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dz * dz > r * r + 1) continue;
          put(x + dx, yy, z + dz, B.jungle_leaves, 2);
        }
      }
      // rami laterali
      for (let i = 0; i < 2; i++) {
        const by = y + 4 + Math.floor(rng() * (h - 6));
        const d = Math.floor(rng() * 4);
        const ox = [1, -1, 0, 0][d], oz = [0, 0, 1, -1][d];
        put(x + ox, by, z + oz, B.jungle_log, 1);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(x + ox * 2 + dx, by + 1, z + oz * 2 + dz, B.jungle_leaves, 2);
        put(x + ox * 2, by + 2, z + oz * 2, B.jungle_leaves, 2);
      }
      for (let k = 1; k <= h; k++) put(x, y + k, z, B.jungle_log, 1);
    }

    bush(x, y, z, rng, put) {
      put(x, y + 1, z, B.jungle_log, 1);
      for (let yy = y + 1; yy <= y + 2; yy++) {
        const r = yy === y + 1 ? 2 : 1;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.6) continue;
          put(x + dx, yy, z + dz, B.oak_leaves, 2);
        }
      }
    }

    acacia(x, y, z, rng, put) {
      const h = 5 + Math.floor(rng() * 3);
      const d = Math.floor(rng() * 4);
      const ox = [1, -1, 0, 0][d], oz = [0, 0, 1, -1][d];
      const bend = 2 + Math.floor(rng() * 2);
      let cx = x, cz = z;
      put(x, y, z, B.dirt, 3);
      for (let k = 1; k <= h; k++) {
        if (k > bend) { cx += ox; cz += oz; }
        put(cx, y + k, cz, B.acacia_log, 1);
      }
      const ty = y + h;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > 4) continue;
        put(cx + dx, ty + 1, cz + dz, B.acacia_leaves, 2);
      }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(cx + dx, ty + 2, cz + dz, B.acacia_leaves, 2);
      // secondo ramo
      if (rng() < 0.6) {
        const ox2 = -ox, oz2 = -oz;
        let bx2 = x, bz2 = z;
        for (let k = 1; k <= 2; k++) { bx2 += ox2; bz2 += oz2; put(bx2, y + bend + k, bz2, B.acacia_log, 1); }
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 3) put(bx2 + dx, y + bend + 3, bz2 + dz, B.acacia_leaves, 2);
      }
    }

    // ---------------- Villaggi ----------------
    villageInCell(gx, gz) {
      if (this.type !== 'normal') return null;
      if (!this._vcache) this._vcache = new Map();
      const key = gx * 100003 + gz;
      if (this._vcache.has(key)) return this._vcache.get(key);
      let v = null;
      const VC = 400;
      if (hash2(this.seed ^ 0x51ab, gx, gz) < 0.62) {
        const x = gx * VC + 70 + Math.floor(hash2(this.seed ^ 0x1234, gx, gz) * (VC - 140));
        const z = gz * VC + 70 + Math.floor(hash2(this.seed ^ 0x4321, gx, gz) * (VC - 140));
        this.column(x, z, col);
        const b = this.biomeOf(col);
        const ok = [BI.PLAINS, BI.MEADOW, BI.SAVANNA, BI.DESERT, BI.TAIGA, BI.SNOWY_PLAINS].includes(b);
        if (ok && col.h > SEA + 1.5 && col.h < SEA + 28 && col.amp < 7 && col.river < 0.2) {
          v = this._planVillage(x, z, b, hash2(this.seed ^ 0x77, gx, gz));
        }
      }
      this._vcache.set(key, v);
      return v;
    }

    villagesNear(x, z, r) {
      const VC = 400, out = [];
      const g0x = Math.floor((x - r - 200) / VC), g1x = Math.floor((x + r + 200) / VC);
      const g0z = Math.floor((z - r - 200) / VC), g1z = Math.floor((z + r + 200) / VC);
      for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
        const v = this.villageInCell(gx, gz);
        if (v && Math.abs(v.x - x) < r + v.R && Math.abs(v.z - z) < r + v.R) out.push(v);
      }
      return out;
    }

    inVillage(x, z) {
      const vs = this.villagesNear(x, z, 0);
      for (const v of vs) if (Math.hypot(x - v.x, z - v.z) < v.R) return true;
      return false;
    }

    _planVillage(x, z, biome, hseed) {
      const rng = mulberry32((hseed * 4294967296) >>> 0);
      const floorAt = (bx, bz) => { this.column(bx, bz, col); return Math.round(col.h + 0.3); };
      const v = { x, z, biome, roads: [], buildings: [], R: 20, size: 0 };
      v.wellY = floorAt(x, z);
      v.buildings.push({ type: 'well', x0: x - 2, z0: z - 2, w: 5, d: 5, rot: 0, y: v.wellY });
      const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      let smith = false;
      for (let di = 0; di < 4; di++) {
        if (rng() < 0.12) continue;
        const L = 18 + Math.floor(rng() * 20);
        const [rx, rz] = DIRS[di];
        v.roads.push({ x0: x + rx * 3, z0: z + rz * 3, x1: x + rx * L, z1: z + rz * L });
        v.R = Math.max(v.R, L + 14);
        let side = rng() < 0.5 ? 1 : -1;
        for (let t = 7; t < L - 2; t += 9 + Math.floor(rng() * 3)) {
          side = -side;
          const sx = -rz * side, sz = rx * side; // perpendicolare
          const roll = rng();
          let type = roll < 0.42 ? 'house' : roll < 0.62 ? 'bighouse' : roll < 0.85 ? 'farm' : 'smith';
          if (type === 'smith' && smith) type = 'house';
          if (type === 'smith') smith = true;
          const dims = { house: [5, 5], bighouse: [7, 6], farm: [9, 7], smith: [7, 7] }[type];
          // la porta (fronte locale -Z) guarda la strada: direzione verso la strada = -s
          const toRoad = [-sx, -sz];
          const rot = DIRS.findIndex((d) => d[0] === toRoad[0] && d[1] === toRoad[1]);
          const W = rot % 2 ? dims[1] : dims[0], D = rot % 2 ? dims[0] : dims[1];
          const dist = 3 + (rot % 2 ? dims[1] : dims[1]) / 2;
          const cx = x + rx * t + sx * (dist + 0.5), cz = z + rz * t + sz * (dist + 0.5);
          const x0 = Math.round(cx - W / 2), z0 = Math.round(cz - D / 2);
          const b = { type, x0, z0, w: W, d: D, lw: dims[0], ld: dims[1], rot, y: floorAt(x0 + (W >> 1), z0 + (D >> 1)) };
          // evita sovrapposizioni
          if (v.buildings.some((o) => x0 < o.x0 + o.w + 1 && x0 + W + 1 > o.x0 && z0 < o.z0 + o.d + 1 && z0 + D + 1 > o.z0)) continue;
          v.buildings.push(b);
          v.size++;
        }
        // lampione a fine strada
        const lx = x + rx * (L - 1) + (-rz) * 2, lz = z + rz * (L - 1) + rx * 2;
        v.buildings.push({ type: 'lamp', x0: lx, z0: lz, w: 1, d: 1, lw: 1, ld: 1, rot: 0, y: floorAt(lx, lz) });
      }
      v.desert = biome === BI.DESERT;
      v.snowy = biome === BI.SNOWY_PLAINS;
      v.taiga = biome === BI.TAIGA;
      return v;
    }

    _populateVillages(c) {
      const bx = c.cx * 16, bz = c.cz * 16;
      const vs = this.villagesNear(bx + 8, bz + 8, 24);
      if (!vs.length) return;
      const blocks = c.blocks;
      const inside = (x, z) => x >= bx && x < bx + 16 && z >= bz && z < bz + 16;
      const setW = (x, y, z, id, meta) => {
        if (!inside(x, z) || y < 1 || y >= WH) return;
        const i = (y << 8) | ((z - bz) << 4) | (x - bx);
        blocks[i] = id;
        c.setMeta(i, meta || 0);
      };
      const getW = (x, y, z) => (inside(x, z) && y >= 0 && y < WH ? blocks[(y << 8) | ((z - bz) << 4) | (x - bx)] : 0);
      const soft = (b) => b === 0 || b === B.water || MC.BL.REPLACEABLE[b] || (MC.blocks[b] && (MC.blocks[b].key.endsWith('_leaves') || MC.blocks[b].key.endsWith('_log') || MC.blocks[b].shape === 'cross'));
      for (const v of vs) {
        const wood = v.taiga || v.snowy ? 'spruce' : 'oak';
        const M = {
          planks: v.desert ? B.cut_sandstone : B[wood + '_planks'], log: v.desert ? B.sandstone : B[wood + '_log'],
          floor: v.desert ? B.sandstone : B.cobblestone, stairs: v.desert ? B.sandstone_stairs : B[wood === 'spruce' ? 'spruce_stairs' : 'oak_stairs'],
          slab: v.desert ? B.sandstone_slab : B[wood === 'spruce' ? 'spruce_slab' : 'oak_slab'], fence: wood === 'spruce' ? B.spruce_fence : B.oak_fence,
        };
        // strade
        for (const r of v.roads) {
          const minx = Math.min(r.x0, r.x1) - 1, maxx = Math.max(r.x0, r.x1) + 1, minz = Math.min(r.z0, r.z1) - 1, maxz = Math.max(r.z0, r.z1) + 1;
          for (let z = Math.max(minz, bz); z <= Math.min(maxz, bz + 15); z++) for (let x = Math.max(minx, bx); x <= Math.min(maxx, bx + 15); x++) {
            const ci = ((z - bz) << 4) | (x - bx);
            let y = c.surf[ci];
            const top = blocks[(y << 8) | ci];
            if (top === B.water || top === B.ice) { setW(x, MC.SEA, z, M.planks, 0); continue; }
            setW(x, y, z, v.desert ? B.smooth_stone : B.dirt_path, 0);
            for (let k = 1; k <= 4; k++) { const b = getW(x, y + k, z); if (b && soft(b)) setW(x, y + k, z, 0, 0); }
          }
        }
        // edifici
        for (const b of v.buildings) {
          if (b.x0 > bx + 15 || b.x0 + b.w < bx || b.z0 > bz + 15 || b.z0 + b.d < bz) continue;
          this._buildStructure(b, M, v, setW, getW, soft, bx, bz);
        }
      }
    }

    _buildStructure(b, M, v, setW, getW, soft) {
      const lw = b.lw, ld = b.ld, rot = b.rot, Y = b.y;
      // trasforma coordinate locali -> mondo
      const T = (lx, lz) => {
        let x = lx, z = lz;
        if (rot === 1) { x = ld - 1 - lz; z = lx; }
        else if (rot === 2) { x = lw - 1 - lx; z = ld - 1 - lz; }
        else if (rot === 3) { x = lz; z = lw - 1 - lx; }
        return [b.x0 + x, b.z0 + z];
      };
      const rf = (f) => (f + rot) & 3; // ruota una direzione (0 -Z, 1 +X, 2 +Z, 3 -X)
      const dirToFace = [5, 0, 4, 1]; // direzione -> indice faccia (per i blocchi orientati)
      const dirToWall = [3, 2, 4, 1]; // direzione del muro -> meta torce/scale (muro a -Z =3, +X =2, +Z =4, -X =1)
      const S = (lx, ly, lz, id, meta) => { const [x, z] = T(lx, lz); setW(x, Y + ly, z, id, meta || 0); };
      const Ffill = (x0, y0, z0, x1, y1, z1, id, meta) => { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) S(x, y, z, id, meta); };
      const stairs = (lx, ly, lz, dir) => S(lx, ly, lz, M.stairs, rf(dir));
      // fondamenta e pulizia
      const H = b.type === 'bighouse' ? 9 : b.type === 'house' ? 8 : b.type === 'well' ? 5 : 4;
      if (b.type !== 'lamp') {
        for (let lz = 0; lz < ld; lz++) for (let lx = 0; lx < lw; lx++) {
          const [x, z] = T(lx, lz);
          for (let y = Y + 1; y <= Y + H; y++) setW(x, y, z, 0, 0);
          for (let k = 0; k < 10; k++) { const y = Y - k; const cur = getW(x, y, z); if (k > 0 && cur && !soft(cur)) break; setW(x, y, z, k === 0 && b.type === 'farm' ? B.dirt : M.floor, 0); }
        }
      }
      if (b.type === 'well') {
        Ffill(0, 0, 0, 4, 0, 4, M.floor);
        Ffill(1, -3, 1, 3, 0, 3, M.floor);
        Ffill(2, -2, 2, 2, 0, 2, B.water);
        Ffill(1, 1, 1, 3, 1, 3, M.floor); S(2, 1, 2, B.water);
        for (const [x, z] of [[1, 1], [3, 1], [1, 3], [3, 3]]) { S(x, 2, z, M.fence); S(x, 3, z, M.fence); }
        Ffill(1, 4, 1, 3, 4, 3, M.slab);
        return;
      }
      if (b.type === 'lamp') {
        const [x, z] = T(0, 0);
        let y = Y;
        for (let k = 0; k < 6; k++) { if (getW(x, y, z) && !soft(getW(x, y, z))) break; y--; }
        setW(x, y + 1, z, M.fence); setW(x, y + 2, z, M.fence); setW(x, y + 3, z, B.lantern);
        return;
      }
      if (b.type === 'farm') {
        Ffill(0, 0, 0, lw - 1, 0, ld - 1, M.log, rot % 2 ? 2 : 1);
        for (let lz = 1; lz < ld - 1; lz++) for (let lx = 1; lx < lw - 1; lx++) {
          if (lx === (lw >> 1)) { S(lx, 0, lz, B.water); continue; }
          S(lx, 0, lz, B.farmland);
          const st = 2 + Math.floor(hash2(this.seed, b.x0 * 31 + lx, b.z0 * 17 + lz) * 6);
          S(lx, 1, lz, B.wheat, st);
        }
        return;
      }
      if (b.type === 'house') {
        Ffill(0, 0, 0, 4, 0, 4, M.floor);
        for (let y = 1; y <= 3; y++) for (let lz = 0; lz < 5; lz++) for (let lx = 0; lx < 5; lx++) {
          const edge = lx === 0 || lz === 0 || lx === 4 || lz === 4;
          if (!edge) continue;
          const corner = (lx === 0 || lx === 4) && (lz === 0 || lz === 4);
          S(lx, y, lz, corner ? M.log : M.planks, 0);
        }
        S(2, 1, 0, B.oak_door, rf(0)); S(2, 2, 0, B.oak_door, rf(0) | 8);
        S(0, 2, 2, B.glass_pane); S(4, 2, 2, B.glass_pane); S(2, 2, 4, B.glass_pane);
        // tetto a piramide
        for (let i = 0; i < 5; i++) { stairs(i, 4, 0, 2); stairs(i, 4, 4, 0); }
        for (let i = 1; i < 4; i++) { stairs(0, 4, i, 1); stairs(4, 4, i, 3); }
        for (let i = 1; i < 4; i++) { stairs(i, 5, 1, 2); stairs(i, 5, 3, 0); }
        stairs(1, 5, 2, 1); stairs(3, 5, 2, 3);
        S(2, 5, 2, M.planks); S(2, 6, 2, M.slab);
        S(1, 1, 2, B.bed, rf(2)); S(1, 1, 3, B.bed, rf(2) | 4); S(3, 1, 3, B.crafting_table, dirToFace[rf(0)]);
        S(1, 1, 1, B.lantern);
        return;
      }
      if (b.type === 'bighouse') {
        Ffill(0, 0, 0, 6, 0, 5, M.floor);
        for (let y = 1; y <= 4; y++) for (let lz = 0; lz < 6; lz++) for (let lx = 0; lx < 7; lx++) {
          const edge = lx === 0 || lz === 0 || lx === 6 || lz === 5;
          if (!edge) continue;
          const corner = (lx === 0 || lx === 6) && (lz === 0 || lz === 5);
          S(lx, y, lz, corner ? M.log : M.planks, 0);
        }
        S(3, 1, 0, B.oak_door, rf(0)); S(3, 2, 0, B.oak_door, rf(0) | 8);
        for (const [lx, lz] of [[1, 0], [5, 0], [1, 5], [5, 5], [0, 2], [0, 3], [6, 2], [6, 3]]) S(lx, 2, lz, B.glass_pane);
        S(3, 3, 5, B.glass_pane);
        // tetto a capanna lungo X
        for (let lx = -1; lx <= 7; lx++) { stairs(lx, 5, 0, 2); stairs(lx, 5, 5, 0); stairs(lx, 6, 1, 2); stairs(lx, 6, 4, 0); S(lx, 7, 2, M.slab); S(lx, 7, 3, M.slab); }
        for (const lx of [0, 6]) { S(lx, 5, 1, M.planks); S(lx, 5, 2, M.planks); S(lx, 5, 3, M.planks); S(lx, 5, 4, M.planks); S(lx, 6, 2, M.planks); S(lx, 6, 3, M.planks); }
        S(1, 1, 4, B.chest, dirToFace[rf(2)] | 8); S(2, 1, 4, B.bookshelf); S(5, 1, 3, B.blue_bed, rf(2)); S(5, 1, 4, B.blue_bed, rf(2) | 4); S(5, 1, 1, B.crafting_table, dirToFace[rf(1)]);
        S(1, 1, 1, B.lantern); S(3, 4, 3, B.lantern, 1);
        return;
      }
      if (b.type === 'smith') {
        Ffill(0, 0, 0, 6, 0, 6, M.floor);
        for (let y = 1; y <= 3; y++) for (let lz = 0; lz < 7; lz++) for (let lx = 0; lx < 7; lx++) {
          if (lz === 0) { if ((lx === 0 || lx === 6) ) S(lx, y, lz, M.log); continue; }
          if (lx === 0 || lx === 6 || lz === 6) S(lx, y, lz, B.cobblestone);
        }
        for (let lz = 0; lz < 7; lz++) for (let lx = 0; lx < 7; lx++) S(lx, 4, lz, B.cobblestone_slab);
        S(1, 1, 5, B.furnace, dirToFace[rf(0)]); S(2, 1, 5, B.furnace, dirToFace[rf(0)]);
        S(5, 1, 5, B.chest, dirToFace[rf(0)] | 8);
        S(5, 1, 3, B.crafting_table, dirToFace[rf(3)]);
        S(3, 3, 3, B.lantern);
        for (let lx = 1; lx < 6; lx++) if (lx !== 3) S(lx, 1, 0, M.fence);
        void dirToWall;
      }
    }

    // Trova una colonna adatta per lo spawn
    findSpawn() {
      if (this.type === 'flat') return { x: 8, z: 8 };
      for (let r = 0; r < 4000; r += 16) {
        const steps = Math.max(1, Math.floor((r * 2 * Math.PI) / 32));
        for (let s = 0; s < steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
          this.column(x, z, col);
          const b = this.biomeOf(col);
          if (col.h > SEA + 2 && col.h < SEA + 30 && b !== BI.OCEAN && b !== BI.RIVER && b !== BI.MOUNTAINS && b !== BI.PEAKS && b !== BI.SWAMP && col.amp < 6) {
            return { x, z };
          }
        }
      }
      return { x: 0, z: 0 };
    }

    biomeAt(x, z) {
      if (this.type === 'flat') return BI.PLAINS;
      this.column(x, z, col);
      return this.biomeOf(col);
    }
  }

  MC.Generator = Generator;
  MC.BIOMES = BIOMES;
  MC.BI = BI;
  MC.WH = WH;
  MC.SEA = SEA;
})();
