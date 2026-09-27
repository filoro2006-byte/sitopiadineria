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
    player: {
      name: 'Giocatore', w: 0.6, h: 1.8, hp: 20, speed: 4.3, eye: 1.62, noSpawn: true,
      parts: () => humanoid('steveHead', 'steveBody', 'steveArm', 'steveLeg'),
    },
    wolf: {
      name: 'Lupo', w: 0.6, h: 0.85, hp: 8, speed: 3.0, eye: 0.7, xp: [1, 3],
      parts: () => [
        P('head', [-3, 9, -12, 3, 15, -8], { pv: [0, 12, -8], a: 'head', p: 'wolfHead' }),
        P('snout', [-1.5, 9, -15, 1.5, 12, -12], { pv: [0, 12, -8], a: 'head', p: 'wolfSnout' }),
        P('ear', [-3, 15, -10, -1, 17, -9], { pv: [0, 12, -8], a: 'head', p: 'wolfDark' }),
        P('ear', [1, 15, -10, 3, 17, -9], { pv: [0, 12, -8], a: 'head', p: 'wolfDark' }),
        P('collar', [-3, 8.6, -9.2, 3, 9.8, -7.6], { pv: [0, 12, -8], a: 'head', p: 'collar', inf: 0.35, cond: 'tamed' }),
        P('mane', [-4, 7, -8, 4, 14, -3], { p: 'wolfFur' }),
        P('body', [-3, 7, -4, 3, 13, 4], { p: 'wolfFur' }),
        P('tail', [-1, 9, 4, 1, 11, 12], { pv: [0, 11, 4], a: 'tail', p: 'wolfFur' }),
        ...legs4(0.5, -6, 4, 7, 2, 'wolfFur'),
      ],
    },
    cat: {
      name: 'Gatto', w: 0.6, h: 0.7, hp: 10, speed: 2.4, eye: 0.55, xp: [1, 3],
      parts: () => [
        P('head', [-2.5, 7, -13, 2.5, 12, -8], { pv: [0, 9.5, -8], a: 'head', p: 'catHead' }),
        P('nose', [-1.5, 7, -14, 1.5, 9, -13], { pv: [0, 9.5, -8], a: 'head', p: 'catLight' }),
        P('ear', [-2, 12, -11, -1, 13, -9], { pv: [0, 9.5, -8], a: 'head', p: 'catFur' }),
        P('ear', [1, 12, -11, 2, 13, -9], { pv: [0, 9.5, -8], a: 'head', p: 'catFur' }),
        P('collar', [-2.5, 6.8, -9, 2.5, 7.8, -7.8], { pv: [0, 9.5, -8], a: 'head', p: 'collar', inf: 0.3, cond: 'tamed' }),
        P('body', [-2, 5, -8, 2, 9, 8], { p: 'catFur' }),
        P('tail', [-0.5, 8, 8, 0.5, 9, 16], { pv: [0, 8.5, 8], a: 'tail', r: [-0.8, 0, 0], p: 'catFur' }),
        ...legs4(0, -7, 7, 5, 2, 'catFur'),
      ],
    },
    enderman: {
      name: 'Enderman', w: 0.6, h: 2.9, hp: 40, speed: 2.4, eye: 2.55, xp: [5, 5], neutral: true,
      parts: () => [
        P('head', [-4, 38, -4, 4, 46, 4], { pv: [0, 38, 0], a: 'head', p: 'endHead' }),
        P('eyes', [-3, 40.5, -4.15, 3, 41.5, -4.05], { pv: [0, 38, 0], a: 'head', p: 'endEyes', glow: true }),
        P('body', [-4, 28, -2, 4, 38, 2], { p: 'ender' }),
        P('arm', [-6, 5, -1, -4, 37, 1], { pv: [-5, 36, 0], a: 'armA', p: 'ender' }),
        P('arm', [4, 5, -1, 6, 37, 1], { pv: [5, 36, 0], a: 'armB', p: 'ender' }),
        P('leg', [-3, 0, -1, -1, 28, 1], { pv: [-2, 28, 0], a: 'legA', p: 'ender' }),
        P('leg', [1, 0, -1, 3, 28, 1], { pv: [2, 28, 0], a: 'legB', p: 'ender' }),
      ],
    },
    cod: {
      name: 'Merluzzo', w: 0.5, h: 0.3, hp: 3, speed: 1.6, eye: 0.15, xp: [1, 3], water: true,
      parts: () => [
        P('body', [-1, 0, -4, 1, 3, 3], { p: 'codBody' }),
        P('head', [-1, 0.2, -6, 1, 2.6, -4], { p: 'codHead' }),
        P('fin', [-0.2, 3, -2, 0.2, 4, 2], { p: 'codFin' }),
        P('tail', [-0.2, 0, 3, 0.2, 3, 6], { pv: [0, 1.5, 3], a: 'tailFish', p: 'codFin' }),
      ],
    },
    zombified_piglin: {
      name: 'Piglin zombificato', w: 0.6, h: 1.95, hp: 20, speed: 2.3, eye: 1.74, xp: [5, 5], neutral: true, fireImmune: true,
      parts: () => [
        P('head', [-5, 24, -4, 5, 32, 4], { pv: [0, 24, 0], a: 'head', p: 'piglinHead' }),
        P('snout', [-2, 24, -5, 2, 27, -4], { pv: [0, 24, 0], a: 'head', p: 'piglinSnout' }),
        P('ear', [-6, 26, -1, -5, 31, 2], { pv: [0, 24, 0], a: 'head', r: [0, 0, 0.3], p: 'piglinSkin' }),
        P('ear', [5, 26, -1, 6, 31, 2], { pv: [0, 24, 0], a: 'head', r: [0, 0, -0.3], p: 'piglinSkin' }),
        P('body', [-4, 12, -2, 4, 24, 2], { p: 'piglinBody' }),
        P('arm', [-8, 12, -2, -4, 24, 2], { pv: [-6, 22, 0], a: 'armA', p: 'piglinArm' }),
        P('arm', [4, 12, -2, 8, 24, 2], { pv: [6, 22, 0], a: 'armB', p: 'piglinSkin' }),
        P('leg', [-4, 0, -2, 0, 12, 2], { pv: [-2, 12, 0], a: 'legA', p: 'piglinLeg' }),
        P('leg', [0, 0, -2, 4, 12, 2], { pv: [2, 12, 0], a: 'legB', p: 'piglinLeg' }),
      ],
    },
    ghast: {
      name: 'Ghast', w: 4, h: 4, hp: 10, speed: 1.2, eye: 2.5, xp: [5, 5], hostile: true, flies: true, fireImmune: true, scale: 4,
      parts: () => {
        const ps = [P('body', [-8, 0, -8, 8, 16, 8], { p: 'ghastBody' })];
        const T = [[-5, -5], [0, -5], [5, -5], [-5, 0], [0, 0], [5, 0], [-5, 5], [0, 5], [5, 5]];
        T.forEach(([x, z], i) => { const L = 7 + ((i * 5) % 6); ps.push(P('tent', [x - 1, -L, z - 1, x + 1, 0, z + 1], { pv: [x, 0, z], a: 'tent' + i, p: 'ghastTent' })); });
        return ps;
      },
    },
    blaze: {
      name: 'Blaze', w: 0.6, h: 1.8, hp: 20, speed: 2.2, eye: 1.5, xp: [10, 10], hostile: true, flies: true, fireImmune: true, glow: true,
      parts: () => {
        const ps = [P('head', [-4, 20, -4, 4, 28, 4], { pv: [0, 20, 0], a: 'head', p: 'blazeHead' })];
        for (let i = 0; i < 12; i++) {
          const ring = Math.floor(i / 4), y = [12, 6, 0][ring], r = [9, 7, 5][ring];
          ps.push(P('rod', [r - 1, y, -1, r + 1, y + 8, 1], { pv: [0, y, 0], a: 'rod' + i, p: 'blazeRod' }));
        }
        return ps;
      },
    },
    magma_cube: {
      name: 'Cubo di magma', w: 0.52, h: 0.52, hp: 1, speed: 2.0, eye: 0.35, xp: [1, 4], hostile: true, fireImmune: true, cube: true,
      parts: () => {
        const ps = [P('core', [-2, 2, -2, 2, 6, 2], { p: 'magmaCore', glow: true })];
        for (let i = 0; i < 8; i++) ps.push(P('slice', [-4, i, -4, 4, i + 1, 4], { pv: [0, 0, 0], a: 'slice' + i, p: i === 4 ? 'magmaEyes' : 'magma' }));
        return ps;
      },
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
    const catCoat = (f, x, y) => {
      const c = opt.cat || [230, 170, 90];
      if (opt.catPattern === 'tabby' && ((x + (f === 'top' ? y * 2 : 0)) % 3 === 0)) return noise(sh(c, 0.6), 0.08);
      if (opt.catPattern === 'siamese') return noise(y < 2 || f === 'bottom' ? [80, 60, 50] : c, 0.06);
      return noise(c, 0.1);
    };
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
      // giocatore (aspetto classico)
      steveHead: (f, x, y, w, h) => {
        const HAIR = [60, 40, 25], SKIN = [196, 138, 104];
        if (f === 'top') return noise(HAIR, 0.1);
        if (f === 'front') {
          if (y < 2) return noise(HAIR, 0.1);
          if (y === 4 && (x === 1 || x === 6)) return [245, 245, 245];
          if (y === 4 && (x === 2 || x === 5)) return [70, 60, 150];
          if (y === 6 && x >= 3 && x <= 4) return [150, 90, 70];
          if (y === 7 && x >= 2 && x <= 5) return [110, 60, 45];
          return noise(SKIN, 0.05);
        }
        if (f === 'back' || y < 3) return noise(HAIR, 0.1);
        return noise(SKIN, 0.05);
      },
      steveBody: (f, x, y, w, h) => (y < 1 && (f === 'front' || f === 'back') && x > 2 && x < 5 ? noise([196, 138, 104], 0.05) : noise([0, 170, 170], 0.08)),
      steveArm: (f, x, y, w, h) => (y < 4 && f !== 'bottom' ? noise([0, 170, 170], 0.08) : noise([196, 138, 104], 0.05)),
      steveLeg: (f, x, y, w, h) => (y >= h - 2 ? noise([80, 80, 80], 0.08) : noise([60, 60, 160], 0.08)),
      // lupo
      wolfHead: (f, x, y, w, h) => {
        if (f === 'front') { if (y === 2 && (x === 1 || x === 4)) return [20, 20, 20]; if (y === 2 && (x === 0 || x === 5)) return [240, 240, 240]; }
        return noise(y >= h - 2 ? [230, 225, 220] : [212, 207, 200], 0.08);
      },
      wolfSnout: (f, x, y, w, h) => (f === 'front' && y === 0 && x === 1 ? [25, 25, 25] : noise([222, 216, 208], 0.06)),
      wolfDark: () => noise([150, 140, 130], 0.1),
      wolfFur: (f, x, y) => noise(f === 'top' ? [196, 190, 182] : [214, 209, 202], 0.12),
      collar: () => noise([200, 30, 30], 0.08),
      // gatto (varianti di mantello)
      catHead: (f, x, y, w, h) => {
        if (f === 'front') {
          if (y === 1 && (x === 0 || x === 4)) return [40, 170, 60];
          if (y === 1 && (x === 1 || x === 3)) return [20, 20, 20];
        }
        return catCoat(f, x, y);
      },
      catFur: (f, x, y) => catCoat(f, x, y),
      catLight: () => noise(opt.catLight || [240, 225, 200], 0.06),
      // enderman
      endHead: () => noise([22, 22, 26], 0.2),
      endEyes: (f, x) => (f === 'front' ? (x === 0 || x === 5 ? [230, 120, 255] : x === 1 || x === 4 ? [200, 60, 240] : [0, 0, 0, 0]) : [0, 0, 0, 0]),
      ender: () => noise(rng() < 0.1 ? [34, 30, 40] : [16, 16, 18], 0.3),
      // merluzzo
      codBody: (f, x, y, w, h) => (f === 'bottom' || y >= h - 1 ? noise([225, 210, 180], 0.06) : noise([190, 162, 116], 0.12)),
      codHead: (f, x, y) => ((f === 'left' || f === 'right') && y === 1 && x === 0 ? [20, 20, 20] : noise([200, 172, 125], 0.08)),
      codFin: () => noise([160, 130, 90], 0.1),
      // piglin zombificato
      piglinHead: (f, x, y, w, h) => {
        if (f === 'front') {
          if (y === 3 && (x === 2 || x === 7)) return [240, 240, 240];
          if (y === 3 && (x === 3 || x === 6)) return [30, 20, 20];
          if (y >= 5 && (x === 1 || x === 8) && f === 'front') return [230, 220, 190];
        }
        if ((f === 'left' || f === 'top') && x < 4 && y < 5) return noise([90, 140, 70], 0.2);
        return noise([230, 140, 140], 0.1);
      },
      piglinSnout: (f, x, y) => (f === 'front' && y === 1 && (x === 1 || x === 2) ? [120, 60, 60] : noise([240, 160, 160], 0.06)),
      piglinSkin: () => noise([230, 140, 140], 0.1),
      piglinBody: (f, x, y, w, h) => {
        if (f === 'front' && x >= 2 && x <= 5 && y >= 3 && y <= 8) return y % 2 ? [220, 215, 200] : [90, 50, 50];
        if (y >= h - 2) return noise([90, 60, 40], 0.1);
        return noise(rng() < 0.3 ? [100, 150, 80] : [230, 140, 140], 0.12);
      },
      piglinArm: (f, x, y, w, h) => (y > h - 5 ? noise([215, 210, 195], 0.06) : noise([230, 140, 140], 0.1)),
      piglinLeg: (f, x, y, w, h) => (y >= h - 2 ? [60, 40, 30] : noise([110, 80, 50], 0.12)),
      // ghast
      ghastBody: (f, x, y, w, h) => {
        if (f === 'front') {
          const shoot = opt.shoot;
          const eye = (ex) => x >= ex && x < ex + 2 && y >= 5 && y < (shoot ? 8 : 6);
          if (eye(3) || eye(11)) return shoot ? [200, 30, 30] : [40, 40, 40];
          if (x >= 5 && x <= 10 && y >= 10 && y <= (shoot ? 13 : 11)) return shoot ? [70, 20, 20] : [60, 60, 60];
          if (!shoot && ((x === 4 && y === 7) || (x === 11 && y === 7))) return [140, 140, 140];
        }
        return noise([240, 240, 240], 0.06);
      },
      ghastTent: () => noise([228, 228, 228], 0.06),
      // blaze
      blazeHead: (f, x, y) => {
        if (f === 'front') { if (y === 3 && (x === 1 || x === 2 || x === 5 || x === 6)) return [40, 20, 5]; if (y === 6 && x > 1 && x < 6) return [120, 50, 0]; }
        return noise(rng() < 0.3 ? [255, 230, 90] : [240, 180, 30], 0.1);
      },
      blazeRod: (f, x, y) => noise(y % 3 === 0 ? [255, 230, 120] : [245, 170, 20], 0.08),
      // cubo di magma
      magma: (f, x, y) => noise(rng() < 0.25 ? [200, 60, 0] : [60, 15, 5], 0.2),
      magmaEyes: (f, x) => (f === 'front' && (x === 1 || x === 2 || x === 5 || x === 6) ? [255, 200, 40] : noise(rng() < 0.25 ? [200, 60, 0] : [60, 15, 5], 0.2)),
      magmaCore: () => noise([255, 150, 20], 0.1),
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

  const CAT_VARIANTS = {
    default: { cat: [235, 170, 90], catPattern: 'tabby' }, black: { cat: [28, 28, 34], catLight: [60, 60, 70] },
    siamese: { cat: [240, 225, 205], catPattern: 'siamese' }, white: { cat: [245, 245, 245] }, gray: { cat: [130, 130, 135], catPattern: 'tabby' },
  };
  function build() {
    if (skins.length) return;
    for (const t of Object.keys(DEFS)) {
      if (t === 'villager') { for (const p in PROFESSIONS) buildSkin(t, p, PROFESSIONS[p]); }
      else if (t === 'cat') { for (const v in CAT_VARIANTS) buildSkin(t, v, CAT_VARIANTS[v]); }
      else buildSkin(t, 'default', {});
    }
    buildSkin('ghast', 'shoot', { shoot: true });
  }

  MC.mobs = { DEFS, build, skins, skinIndex, models, SZ, PROFESSIONS, CAT_VARIANTS };
})();
