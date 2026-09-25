// Modelli e skin delle creature (in pixel da 1/16 di blocco, fronte = -Z, piedi a y = 0)
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const { mulberry32, hashString } = MC.util;
  const SZ = 128; // lato di una skin

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  const sh = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---------------- Definizioni ----------------
  // parte: n nome, b scatola [x0,y0,z0,x1,y1,z1], pv perno, a animazione, r rotazione fissa, inf gonfiaggio, p pittore, tint
  const P = (n, b, o) => Object.assign({ n, b }, o || {});

  const legs4 = (x, z0, z1, h, w, paint, ext) => [
    P('leg', [-x - w, 0, z0, -x, h, z0 + w], Object.assign({ pv: [-x - w / 2, h, z0 + w / 2], a: 'legA', p: paint }, ext)),
    P('leg', [x, 0, z0, x + w, h, z0 + w], Object.assign({ pv: [x + w / 2, h, z0 + w / 2], a: 'legB', p: paint }, ext)),
    P('leg', [-x - w, 0, z1 - w, -x, h, z1], Object.assign({ pv: [-x - w / 2, h, z1 - w / 2], a: 'legB', p: paint }, ext)),
    P('leg', [x, 0, z1 - w, x + w, h, z1], Object.assign({ pv: [x + w / 2, h, z1 - w / 2], a: 'legA', p: paint }, ext)),
  ];

  const humanoid = (headP, bodyP, armP, legP, o) => {
    o = o || {};
    const aw = o.armW || 4, lw = o.legW || 4;
    return [
      P('head', [-4, 24, -4, 4, 32, 4], { pv: [0, 24, 0], a: 'head', p: headP }),
      P('body', [-4, 12, -2, 4, 24, 2], { p: bodyP }),
      P('arm', [-4 - aw, 12, -aw / 2, -4, 24, aw / 2], { pv: [-4 - aw / 2, 22, 0], a: o.armsForward ? 'armFA' : 'armA', p: armP }),
      P('arm', [4, 12, -aw / 2, 4 + aw, 24, aw / 2], { pv: [4 + aw / 2, 22, 0], a: o.armsForward ? 'armFB' : 'armB', p: armP }),
      P('leg', [-lw, 0, -lw / 2, 0, 12, lw / 2], { pv: [-lw / 2, 12, 0], a: 'legA', p: legP }),
      P('leg', [0, 0, -lw / 2, lw, 12, lw / 2], { pv: [lw / 2, 12, 0], a: 'legB', p: legP }),
    ];
  };

  const DEFS = {
    pig: {
      name: 'Maiale', w: 0.9, h: 0.9, hp: 10, speed: 1.2, eye: 0.7,
      parts: () => [
        P('head', [-4, 8, -14, 4, 16, -6], { pv: [0, 12, -6], a: 'head', p: 'pigHead' }),
        P('snout', [-2, 9, -15, 2, 12, -14], { pv: [0, 12, -6], a: 'head', p: 'pigSnout' }),
        P('body', [-5, 5, -8, 5, 13, 8], { p: 'pigBody' }),
        ...legs4(1, -7, 7, 6, 4, 'pigLeg'),
      ],
    },
    cow: {
      name: 'Mucca', w: 0.9, h: 1.4, hp: 10, speed: 1.0, eye: 1.3,
      parts: () => [
        P('head', [-4, 16, -15, 4, 24, -9], { pv: [0, 20, -9], a: 'head', p: 'cowHead' }),
        P('horn', [-5, 22, -13, -4, 25, -12], { pv: [0, 20, -9], a: 'head', p: 'horn' }),
        P('horn', [4, 22, -13, 5, 25, -12], { pv: [0, 20, -9], a: 'head', p: 'horn' }),
        P('body', [-6, 12, -9, 6, 22, 9], { p: 'cowBody' }),
        P('udder', [-2, 10, 3, 2, 12, 9], { p: 'udder' }),
        ...legs4(2, -8, 8, 12, 4, 'cowLeg'),
      ],
    },
    sheep: {
      name: 'Pecora', w: 0.9, h: 1.3, hp: 8, speed: 1.0, eye: 1.2,
      parts: () => [
        P('head', [-3, 16, -14, 3, 22, -6], { pv: [0, 18, -6], a: 'head', p: 'sheepHead' }),
        P('woolhead', [-3, 18, -12, 3, 22, -6], { pv: [0, 18, -6], a: 'head', p: 'wool', inf: 0.6, tint: true }),
        P('body', [-4, 12, -8, 4, 18, 8], { p: 'sheepSkin' }),
        P('wool', [-4, 12, -8, 4, 18, 8], { p: 'wool', inf: 1.75, tint: true }),
        ...legs4(1, -7, 7, 12, 4, 'sheepLeg'),
        P('woolleg', [-5, 6, -7, -1, 12, -3], { pv: [-3, 12, -5], a: 'legA', p: 'wool', inf: 0.5, tint: true }),
        P('woolleg', [1, 6, -7, 5, 12, -3], { pv: [3, 12, -5], a: 'legB', p: 'wool', inf: 0.5, tint: true }),
        P('woolleg', [-5, 6, 3, -1, 12, 7], { pv: [-3, 12, 5], a: 'legB', p: 'wool', inf: 0.5, tint: true }),
        P('woolleg', [1, 6, 3, 5, 12, 7], { pv: [3, 12, 5], a: 'legA', p: 'wool', inf: 0.5, tint: true }),
      ],
    },
    chicken: {
      name: 'Gallina', w: 0.4, h: 0.7, hp: 4, speed: 1.0, eye: 0.6,
      parts: () => [
        P('head', [-2, 9, -6, 2, 15, -3], { pv: [0, 9, -4], a: 'head', p: 'chickenHead' }),
        P('beak', [-2, 11, -8, 2, 13, -6], { pv: [0, 9, -4], a: 'head', p: 'beak' }),
        P('wattle', [-1, 9, -7, 1, 11, -5], { pv: [0, 9, -4], a: 'head', p: 'wattle' }),
        P('body', [-3, 4, -4, 3, 10, 4], { p: 'chickenBody' }),
        P('wing', [-4, 5, -3, -3, 9, 3], { pv: [-3, 9, 0], a: 'wingL', p: 'chickenBody' }),
        P('wing', [3, 5, -3, 4, 9, 3], { pv: [3, 9, 0], a: 'wingR', p: 'chickenBody' }),
        P('leg', [-2, 0, -1, -1, 5, 0], { pv: [-1.5, 5, -0.5], a: 'legA', p: 'chickenLeg' }),
        P('leg', [1, 0, -1, 2, 5, 0], { pv: [1.5, 5, -0.5], a: 'legB', p: 'chickenLeg' }),
        P('foot', [-3, 0, -3, 0, 0.5, 0], { pv: [-1.5, 5, -0.5], a: 'legA', p: 'chickenLeg' }),
        P('foot', [0, 0, -3, 3, 0.5, 0], { pv: [1.5, 5, -0.5], a: 'legB', p: 'chickenLeg' }),
      ],
    },
    zombie: {
      name: 'Zombie', w: 0.6, h: 1.95, hp: 20, speed: 2.2, eye: 1.74, hostile: true, burns: true,
      parts: () => humanoid('zombieHead', 'zombieBody', 'zombieArm', 'zombieLeg', { armsForward: true }),
    },
    skeleton: {
      name: 'Scheletro', w: 0.6, h: 1.99, hp: 20, speed: 2.2, eye: 1.74, hostile: true, burns: true, ranged: true,
      parts: () => humanoid('skelHead', 'skelBody', 'bone', 'bone', { armW: 2, legW: 2 }),
    },
    creeper: {
      name: 'Creeper', w: 0.6, h: 1.7, hp: 20, speed: 2.0, eye: 1.5, hostile: true,
      parts: () => [
        P('head', [-4, 18, -4, 4, 26, 4], { pv: [0, 18, 0], a: 'head', p: 'creeperHead' }),
        P('body', [-4, 6, -2, 4, 18, 2], { p: 'creeper' }),
        ...legs4(0, -6, 6, 6, 4, 'creeper'),
      ],
    },
    spider: {
      name: 'Ragno', w: 1.4, h: 0.9, hp: 16, speed: 3.0, eye: 0.65, hostile: true, climbs: true,
      parts: () => {
        const ps = [
          P('head', [-4, 5, -11, 4, 13, -3], { pv: [0, 9, -3], a: 'head', p: 'spiderHead' }),
          P('neck', [-3, 6, -3, 3, 12, 3], { p: 'spider' }),
          P('abdomen', [-6, 5, 3, 6, 13, 15], { p: 'spiderBody' }),
        ];
        for (let i = 0; i < 4; i++) {
          const z = -1.5 + i * 1.2;
          ps.push(P('sleg', [3, 8, z - 1, 19, 10, z + 1], { pv: [3, 9, z], a: 'spiderR' + i, p: 'spider' }));
          ps.push(P('sleg', [-19, 8, z - 1, -3, 10, z + 1], { pv: [-3, 9, z], a: 'spiderL' + i, p: 'spider' }));
        }
        return ps;
      },
    },
    villager: {
      name: 'Villico', w: 0.6, h: 1.95, hp: 20, speed: 1.2, eye: 1.62,
      parts: () => [
        P('head', [-4, 24, -4, 4, 34, 4], { pv: [0, 24, 0], a: 'head', p: 'vilHead' }),
        P('nose', [-1, 23, -6, 1, 27, -4], { pv: [0, 24, 0], a: 'head', p: 'vilSkin' }),
        P('body', [-4, 12, -3, 4, 24, 3], { p: 'robe' }),
        P('robe', [-4, 6, -3, 4, 12, 3], { p: 'robe', inf: 0.3 }),
        P('arms', [-4, 17, -6, 4, 21, -2], { p: 'vilArms' }),
        P('armsL', [-8, 15, -5, -4, 23, -1], { pv: [-6, 22, -2], r: [-0.75, 0, 0], p: 'robeArm' }),
        P('armsR', [4, 15, -5, 8, 23, -1], { pv: [6, 22, -2], r: [-0.75, 0, 0], p: 'robeArm' }),
        P('leg', [-4, 0, -2, 0, 12, 2], { pv: [-2, 12, 0], a: 'legA', p: 'vilLeg' }),
        P('leg', [0, 0, -2, 4, 12, 2], { pv: [2, 12, 0], a: 'legB', p: 'vilLeg' }),
      ],
    },
    iron_golem: {
      name: 'Golem di ferro', w: 1.4, h: 2.7, hp: 100, speed: 1.1, eye: 2.4, golem: true,
      parts: () => [
        P('head', [-4, 33, -7.5, 4, 43, 0.5], { pv: [0, 33, -2], a: 'head', p: 'golemHead' }),
        P('nose', [-1, 34, -9.5, 1, 38, -7.5], { pv: [0, 33, -2], a: 'head', p: 'golem' }),
        P('body', [-9, 21, -6, 9, 33, 5], { p: 'golemBody' }),
        P('waist', [-4.5, 16, -3, 4.5, 21, 3], { p: 'golem' }),
        P('arm', [-13, 3, -3, -9, 33, 3], { pv: [-11, 31, 0], a: 'golemArmA', p: 'golemArm' }),
        P('arm', [9, 3, -3, 13, 33, 3], { pv: [11, 31, 0], a: 'golemArmB', p: 'golemArm' }),
        P('leg', [-7.5, 0, -2.5, -1.5, 16, 2.5], { pv: [-4.5, 16, 0], a: 'legA', p: 'golem' }),
        P('leg', [1.5, 0, -2.5, 7.5, 16, 2.5], { pv: [4.5, 16, 0], a: 'legB', p: 'golem' }),
      ],
    },
  };

  // ---------------- Pittori ----------------
  // f: faccia ('top','bottom','left','front','right','back'), x,y pixel nella faccia (y=0 in alto), w,h dimensioni della faccia
  function makePainters(rng, opt) {
    const n = (a) => 1 - a / 2 + rng() * a;
    const noise = (c, a) => sh(c, n(a));
    const eyes = (x, y, w, h, row, white, pupil, gap) => {
      const cx = w / 2;
      const g = gap || 1;
      if (y === row) {
        if (x === Math.floor(cx - g - 2)) return white;
        if (x === Math.floor(cx - g - 1)) return pupil;
        if (x === Math.floor(cx + g)) return pupil;
        if (x === Math.floor(cx + g + 1)) return white;
      }
      return null;
    };
    const PINK = [240, 160, 160], PINKD = [225, 135, 140];
    const COW = [72, 52, 36], WHITE = [232, 232, 226];
    const ZGREEN = [85, 140, 70], ZSHIRT = [40, 158, 168], ZPANTS = [62, 52, 140];
    const BONE = [205, 205, 200];
    const CREEP = [84, 186, 72];
    const SPIDER = [58, 48, 42];
    const VSKIN = [190, 140, 112];
    const GOLEM = [218, 212, 200];
    const robe = opt.robe || [120, 90, 50];
    const cowPatch = (x, y) => (Math.sin(x * 0.9 + opt.seed) + Math.cos(y * 0.7 + opt.seed * 2) + Math.sin((x + y) * 0.4)) > 1.2;
    return {
      pigHead: (f, x, y, w, h) => {
        if (f === 'front') { const e = eyes(x, y, w, h, 3, [250, 250, 250], [30, 20, 20], 1); if (e) return e; }
        return noise(y > h - 2 && f !== 'top' ? PINKD : PINK, 0.08);
      },
      pigSnout: (f, x, y) => (f === 'front' && y === 1 && (x === 0 || x === 3) ? [120, 60, 60] : noise([245, 175, 175], 0.06)),
      pigBody: (f, x, y) => noise(f === 'top' ? sh(PINK, 0.97) : PINK, 0.1),
      pigLeg: (f, x, y, w, h) => (y >= h - 1 ? [110, 70, 60] : noise(PINKD, 0.08)),
      cowHead: (f, x, y, w, h) => {
        if (f === 'front') {
          const e = eyes(x, y, w, h, 3, WHITE, [15, 15, 15], 2); if (e) return e;
          if (y >= 5) return noise([185, 150, 140], 0.08);
          if (x >= 2 && x <= 5 && y <= 4) return noise(WHITE, 0.05);
        }
        return noise(cowPatch(x + 30, y) ? WHITE : COW, 0.12);
      },
      horn: () => noise([215, 215, 205], 0.05),
      cowBody: (f, x, y) => noise(cowPatch(x, y + (f === 'top' ? 20 : 0)) ? WHITE : COW, 0.12),
      udder: () => noise([230, 150, 160], 0.06),
      cowLeg: (f, x, y, w, h) => (y >= h - 2 ? [60, 45, 35] : noise(cowPatch(x + 5, y) ? WHITE : COW, 0.1)),
      sheepHead: (f, x, y, w, h) => {
        if (f === 'front') { const e = eyes(x, y, w, h, 2, [250, 250, 250], [20, 20, 20], 1); if (e) return e; if (y === 4 && x > 1 && x < 4) return [200, 150, 150]; }
        return noise([214, 190, 170], 0.08);
      },
      sheepSkin: () => noise([214, 190, 170], 0.06),
      sheepLeg: (f, x, y, w, h) => (y >= h - 1 ? [90, 70, 60] : noise([214, 190, 170], 0.06)),
      wool: (f, x, y) => { const v = 0.86 + ((x * 7 + y * 13) % 5) * 0.03 + rng() * 0.06; return sh([238, 238, 238], v); },
      chickenHead: (f, x, y, w, h) => { if ((f === 'left' || f === 'right') && y === 2 && x === 1) return [20, 20, 20]; if (f === 'front' && y === 2 && (x === 0 || x === 3)) return [20, 20, 20]; return noise([245, 245, 245], 0.04); },
      beak: () => noise([240, 170, 30], 0.08),
      wattle: () => noise([210, 30, 30], 0.1),
      chickenBody: (f, x, y) => noise([245, 245, 245], 0.05),
      chickenLeg: () => noise([240, 170, 40], 0.08),
      zombieHead: (f, x, y, w, h) => {
        if (f === 'front') {
          if (y === 4 && (x === 1 || x === 2 || x === 5 || x === 6)) return [30, 50, 30];
          if (y === 3 && (x === 1 || x === 6)) return sh(ZGREEN, 0.7);
          if (y === 6 && x >= 3 && x <= 4) return sh(ZGREEN, 0.6);
        }
        if (f === 'top' || y < 2) return noise([50, 80, 45], 0.15);
        return noise(ZGREEN, 0.12);
      },
      zombieBody: (f, x, y, w, h) => (y >= h - 1 ? noise(ZPANTS, 0.1) : noise(ZSHIRT, 0.1)),
      zombieArm: (f, x, y, w, h) => (y < 4 && f !== 'bottom' ? noise(ZSHIRT, 0.1) : noise(ZGREEN, 0.12)),
      zombieLeg: (f, x, y, w, h) => (y >= h - 2 ? noise([70, 70, 70], 0.1) : noise(ZPANTS, 0.1)),
      skelHead: (f, x, y, w, h) => {
        if (f === 'front') {
          if (y >= 3 && y <= 4 && (x === 1 || x === 2 || x === 5 || x === 6)) return [25, 25, 25];
          if (y === 5 && (x === 3 || x === 4)) return [60, 60, 60];
          if (y === 6 && x > 0 && x < 7 && x % 2) return [70, 70, 70];
        }
        return noise(BONE, 0.08);
      },
      skelBody: (f, x, y, w, h) => {
        if ((f === 'front' || f === 'back') && y > 0 && y < 9 && y % 2 === 0 && x > 0 && x < w - 1) return [35, 35, 35];
        if ((f === 'front' || f === 'back') && (x === 3 || x === 4)) return noise(BONE, 0.06);
        if (y >= 9) return noise(BONE, 0.08);
        return f === 'front' || f === 'back' ? [30, 30, 30, 0] : noise(BONE, 0.08);
      },
      bone: (f, x, y) => noise(BONE, 0.08),
      creeperHead: (f, x, y, w, h) => {
        if (f === 'front') {
          const c = [15, 15, 15];
          if ((y === 2 || y === 3) && (x === 1 || x === 2 || x === 5 || x === 6)) return c;
          if (y === 4 && (x === 3 || x === 4)) return c;
          if ((y === 5 || y === 6) && x >= 2 && x <= 5) return c;
          if (y === 7 && (x === 2 || x === 5)) return c;
        }
        return rng() < 0.3 ? sh(CREEP, 0.55 + rng() * 0.2) : rng() < 0.2 ? sh(CREEP, 1.15) : noise(CREEP, 0.12);
      },
      creeper: () => (rng() < 0.3 ? sh(CREEP, 0.55 + rng() * 0.2) : rng() < 0.2 ? sh(CREEP, 1.15) : noise(CREEP, 0.12)),
      spiderHead: (f, x, y, w, h) => {
        if (f === 'front') {
          const red = [220, 20, 20];
          if (y === 3 && (x === 1 || x === 2 || x === 5 || x === 6)) return red;
          if (y === 2 && (x === 3 || x === 4)) return red;
          if (y === 5 && (x === 2 || x === 5)) return [180, 10, 10];
        }
        return noise(SPIDER, 0.2);
      },
      spider: () => noise(SPIDER, 0.25),
      spiderBody: (f, x, y) => ((f === 'top' && (x + y) % 5 === 0) ? [90, 20, 20] : noise(SPIDER, 0.25)),
      vilHead: (f, x, y, w, h) => {
        if (f === 'front') {
          if (y === 3 && x >= 1 && x <= 6 && x !== 3 && x !== 4) return [50, 35, 25];
          if (y === 4 && (x === 1 || x === 6)) return [245, 245, 245];
          if (y === 4 && (x === 2 || x === 5)) return [40, 130, 60];
          if (y === 8 && x >= 2 && x <= 5) return sh(VSKIN, 0.75);
        }
        if (f === 'top' || y < 1) return noise(opt.hair || [90, 60, 40], 0.1);
        return noise(VSKIN, 0.08);
      },
      vilSkin: () => noise(VSKIN, 0.06),
      robe: (f, x, y, w, h) => {
        if (opt.apron && f === 'front' && x > 1 && x < w - 2) return noise(opt.apron, 0.05);
        return noise(y === 0 ? sh(robe, 0.8) : robe, 0.08);
      },
      robeArm: (f, x, y, w, h) => (y > h - 3 ? noise(VSKIN, 0.06) : noise(sh(robe, 0.92), 0.08)),
      vilArms: (f, x, y, w, h) => (x < 2 || x >= w - 2 ? noise(sh(robe, 0.92), 0.08) : noise(VSKIN, 0.06)),
      vilLeg: (f, x, y, w, h) => (y >= h - 1 ? [60, 45, 35] : noise(sh(robe, 0.85), 0.08)),
      golemHead: (f, x, y, w, h) => {
        if (f === 'front') {
          if (y === 3 && (x === 1 || x === 2 || x === 5 || x === 6)) return [40, 40, 40];
          if (y === 4 && (x === 1 || x === 6)) return [180, 30, 30];
        }
        return noise(GOLEM, 0.08);
      },
      golem: (f, x, y) => ((x * 3 + y * 7) % 11 === 0 ? sh(GOLEM, 0.7) : noise(GOLEM, 0.08)),
      golemBody: (f, x, y, w, h) => {
        if (f !== 'bottom' && ((x * 5 + y * 3) % 17 === 0 || (y > h - 4 && (x + y) % 3 === 0 && rng() < 0.5))) return noise([70, 130, 40], 0.2);
        return (x * 3 + y * 7) % 13 === 0 ? sh(GOLEM, 0.7) : noise(GOLEM, 0.08);
      },
      golemArm: (f, x, y, w, h) => ((y > h * 0.6 && rng() < 0.12) ? noise([70, 130, 40], 0.2) : noise(GOLEM, 0.08)),
    };
  }

  // ---------------- Costruzione delle skin ----------------
  const skins = [];
  const skinIndex = {};
  const models = {};

  function faceRects(pt) {
    const [x0, y0, z0, x1, y1, z1] = pt.b;
    const w = Math.max(1, Math.round(x1 - x0)), h = Math.max(1, Math.round(y1 - y0)), d = Math.max(1, Math.round(z1 - z0));
    const [u, v] = pt.uv;
    return {
      top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
      left: [u, v + d, d, h], front: [u + d, v + d, w, h], right: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
      w, h, d,
    };
  }

  function buildSkin(type, variant, opt) {
    const def = DEFS[type];
    const parts = def.parts().map((p) => Object.assign({}, p));
    // impacchettamento a scaffali nella skin 128x128
    let cx = 0, cy = 0, rowH = 0;
    const sorted = parts.slice().sort((a, b) => (b.b[4] - b.b[1] + b.b[5] - b.b[2]) - (a.b[4] - a.b[1] + a.b[5] - a.b[2]));
    for (const p of sorted) {
      const w = Math.max(1, Math.round(p.b[3] - p.b[0])), h = Math.max(1, Math.round(p.b[4] - p.b[1])), d = Math.max(1, Math.round(p.b[5] - p.b[2]));
      const rw = 2 * d + 2 * w, rh = d + h;
      if (cx + rw > SZ) { cx = 0; cy += rowH; rowH = 0; }
      p.uv = [cx, cy];
      cx += rw; rowH = Math.max(rowH, rh);
    }
    const img = new Uint8Array(SZ * SZ * 4);
    const rng = mulberry32(hashString(type + ':' + variant));
    const painters = makePainters(rng, Object.assign({ seed: rng() * 10 }, opt || {}));
    for (const p of parts) {
      const fr = faceRects(p);
      const paint = painters[p.p] || (() => [255, 0, 255]);
      for (const f of ['top', 'bottom', 'left', 'front', 'right', 'back']) {
        const [u, v, fw, fh] = fr[f];
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
          const c = paint(f, x, y, fw, fh);
          const i = ((v + y) * SZ + (u + x)) * 4;
          img[i] = clamp(c[0]); img[i + 1] = clamp(c[1]); img[i + 2] = clamp(c[2]); img[i + 3] = c[3] === undefined ? 255 : c[3];
        }
      }
      // UV normalizzate per faccia nell'ordine del renderer: +X, -X, +Y, -Y, +Z, -Z
      const nrm = (r) => [r[0] / SZ, r[1] / SZ, (r[0] + r[2]) / SZ, (r[1] + r[3]) / SZ];
      p.uvs = [nrm(fr.right), nrm(fr.left), nrm(fr.top), nrm(fr.bottom), nrm(fr.back), nrm(fr.front)];
    }
    const key = type + ':' + variant;
    skinIndex[key] = skins.length;
    skins.push(img);
    if (!models[type]) models[type] = parts;
    return skinIndex[key];
  }

  const PROFESSIONS = {
    farmer: { name: 'Contadino', robe: [120, 90, 50], hair: [110, 80, 40] },
    librarian: { name: 'Bibliotecario', robe: [230, 230, 225], hair: [60, 45, 35] },
    cleric: { name: 'Chierico', robe: [120, 50, 140], hair: [40, 30, 25] },
    smith: { name: 'Fabbro', robe: [50, 50, 55], apron: [110, 110, 110], hair: [40, 30, 25] },
    butcher: { name: 'Macellaio', robe: [130, 40, 40], apron: [235, 235, 235], hair: [100, 70, 45] },
  };

  function build() {
    if (skins.length) return;
    for (const t of Object.keys(DEFS)) {
      if (t === 'villager') { for (const p in PROFESSIONS) buildSkin(t, p, PROFESSIONS[p]); }
      else buildSkin(t, 'default', {});
    }
  }

  MC.mobs = { DEFS, build, skins, skinIndex, models, SZ, PROFESSIONS };
})();
