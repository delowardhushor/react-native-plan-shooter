import { Skia, type SkCanvas, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { SCREEN_WIDTH as W, SCREEN_HEIGHT as H, GROUND_HEIGHT } from '../engine/Constants';
import { BOSS_EVERY } from '../engine/Levels';
import { bake, createPictureUnbounded, fillPaint, linear, radial, record, seeded, shaderPaint, strokePaint } from './gfx';

export const GROUND_Y = H - GROUND_HEIGHT;

// Scroll speeds in px/frame. Farther layers move slower, which is what sells the depth.
const SPEED = { farClouds: 0.25, farMountains: 0.2, nearMountains: 0.5, midClouds: 0.9, hills: 1.6, ground: 3 };

// Each biome is a full palette for the scenery; the world changes every BOSS_EVERY levels, right after a boss falls.
interface Biome {
  name: string;
  accent: string; // UI highlight colour that matches the scenery
  sky: string[];
  skyPos: number[];
  sun: { x: number; y: number; r: number; glow: [string, string, string]; core: string };
  stars: boolean;
  cloud: { light: string; shade: string; alpha: [number, number]; count: [number, number] }; // colours are "r,g,b"
  haze: string;
  farMtn: { colors: [string, string]; rim: string };
  nearMtn: { colors: [string, string]; rim: string };
  hills: [string, string];
  pine: { trunk: string; leaves: [string, string] };
  ground: [string, string, string];
  groundRim: string;
  stripe: string;
  streak: string;
  vignette: { rgb: string; alpha: number };
}

const BIOMES: Biome[] = [
  { // Clear day
    name: 'CLEAR SKIES',
    accent: '#ffb23e',
    sky: ['#1a58a4', '#3b84ca', '#8dc4eb', '#dcecf3'], skyPos: [0, 0.42, 0.8, 1],
    sun: { x: 0.8, y: 0.24, r: 170, glow: ['rgba(255,244,205,0.85)', 'rgba(255,230,170,0.3)', 'rgba(255,220,150,0)'], core: '#fffdf2' },
    stars: false,
    cloud: { light: '255,255,255', shade: '140,160,190', alpha: [0.55, 0.8], count: [5, 4] },
    haze: '226,240,248',
    farMtn: { colors: ['#8fa8c4', '#bcd2e4'], rim: 'rgba(255,255,255,0.35)' },
    nearMtn: { colors: ['#5f819f', '#9ebbd0'], rim: 'rgba(255,255,255,0.25)' },
    hills: ['#4d8250', '#2f5c3a'],
    pine: { trunk: '#2c2217', leaves: ['#35693f', '#1d4128'] },
    ground: ['#527f3a', '#3c6a2c', '#27481f'], groundRim: 'rgba(220,255,190,0.35)',
    stripe: 'rgba(10,30,5,0.17)', streak: 'rgba(255,255,255,0.13)',
    vignette: { rgb: '4,12,24', alpha: 0.5 },
  },
  { // Sunset
    name: 'SUNSET RIDGE',
    accent: '#ff8a5c',
    sky: ['#2a2d6b', '#8b4a92', '#f07a5c', '#ffc880'], skyPos: [0, 0.4, 0.76, 1],
    sun: { x: 0.72, y: 0.62, r: 230, glow: ['rgba(255,214,150,0.95)', 'rgba(255,150,100,0.4)', 'rgba(255,110,80,0)'], core: '#fff0c8' },
    stars: false,
    cloud: { light: '255,196,170', shade: '110,70,120', alpha: [0.5, 0.78], count: [5, 4] },
    haze: '255,190,150',
    farMtn: { colors: ['#7a5a92', '#d49aa6'], rim: 'rgba(255,214,170,0.45)' },
    nearMtn: { colors: ['#4e4274', '#a2708c'], rim: 'rgba(255,190,150,0.3)' },
    hills: ['#3d5a48', '#223a34'],
    pine: { trunk: '#241a1c', leaves: ['#2f5a46', '#173629'] },
    ground: ['#4a6a3c', '#355430', '#223c22'], groundRim: 'rgba(255,210,150,0.4)',
    stripe: 'rgba(30,15,5,0.2)', streak: 'rgba(255,225,190,0.15)',
    vignette: { rgb: '30,8,24', alpha: 0.55 },
  },
  { // Night
    name: 'MIDNIGHT RUN',
    accent: '#7fb4ff',
    sky: ['#04091c', '#0d1b42', '#1b3366', '#2f4d82'], skyPos: [0, 0.4, 0.78, 1],
    sun: { x: 0.8, y: 0.22, r: 150, glow: ['rgba(200,220,255,0.7)', 'rgba(140,170,240,0.22)', 'rgba(120,150,230,0)'], core: '#f4f7ff' },
    stars: true,
    cloud: { light: '84,104,160', shade: '20,30,64', alpha: [0.45, 0.65], count: [5, 4] },
    haze: '44,66,120',
    farMtn: { colors: ['#1a2b4d', '#2e4670'], rim: 'rgba(170,200,255,0.25)' },
    nearMtn: { colors: ['#101f3a', '#223a5c'], rim: 'rgba(150,180,240,0.2)' },
    hills: ['#12301f', '#0a1b14'],
    pine: { trunk: '#0c0d12', leaves: ['#17402c', '#0b2217'] },
    ground: ['#1d3c2c', '#142e21', '#0b1c13'], groundRim: 'rgba(150,200,255,0.25)',
    stripe: 'rgba(0,10,10,0.22)', streak: 'rgba(190,210,255,0.13)',
    vignette: { rgb: '1,4,14', alpha: 0.65 },
  },
  { // Storm
    name: 'STORM FRONT',
    accent: '#b5c7da',
    sky: ['#232a32', '#444d58', '#69737f', '#8f99a3'], skyPos: [0, 0.4, 0.78, 1],
    sun: { x: 0.6, y: 0.2, r: 200, glow: ['rgba(215,222,230,0.4)', 'rgba(200,208,218,0.15)', 'rgba(190,200,210,0)'], core: 'rgba(235,240,245,0.5)' },
    stars: false,
    cloud: { light: '170,178,188', shade: '60,68,80', alpha: [0.7, 0.92], count: [8, 6] },
    haze: '130,140,152',
    farMtn: { colors: ['#4d5864', '#76828f'], rim: 'rgba(210,220,230,0.2)' },
    nearMtn: { colors: ['#3a444f', '#5f6b78'], rim: 'rgba(200,210,220,0.18)' },
    hills: ['#3e5a42', '#26382b'],
    pine: { trunk: '#1c1a18', leaves: ['#2c4a36', '#172a1f'] },
    ground: ['#44593a', '#33472c', '#222f1e'], groundRim: 'rgba(200,215,190,0.25)',
    stripe: 'rgba(10,20,10,0.2)', streak: 'rgba(205,220,235,0.24)',
    vignette: { rgb: '6,10,16', alpha: 0.6 },
  },
  { // Arctic
    name: 'ARCTIC DRIFT',
    accent: '#6fdcff',
    sky: ['#4f86c0', '#8fc0e6', '#c9e4f4', '#f0f8fc'], skyPos: [0, 0.4, 0.78, 1],
    sun: { x: 0.2, y: 0.26, r: 170, glow: ['rgba(255,255,240,0.85)', 'rgba(235,245,255,0.3)', 'rgba(225,240,255,0)'], core: '#ffffff' },
    stars: false,
    cloud: { light: '255,255,255', shade: '150,175,205', alpha: [0.5, 0.75], count: [5, 4] },
    haze: '230,243,252',
    farMtn: { colors: ['#9db8d6', '#e2eef8'], rim: 'rgba(255,255,255,0.6)' },
    nearMtn: { colors: ['#7f9fc0', '#d2e3f2'], rim: 'rgba(255,255,255,0.5)' },
    hills: ['#c9dbe8', '#9db6c8'],
    pine: { trunk: '#3a2f2a', leaves: ['#3f7a6c', '#244f48'] },
    ground: ['#e3edf4', '#cddbe7', '#adc0d0'], groundRim: 'rgba(255,255,255,0.7)',
    stripe: 'rgba(90,120,160,0.16)', streak: 'rgba(255,255,255,0.3)',
    vignette: { rgb: '10,24,44', alpha: 0.42 },
  },
];

export const biomeIndexFor = (level: number) => Math.floor((Math.max(1, level) - 1) / BOSS_EVERY) % BIOMES.length;

export const biomeNameFor = (level: number) => BIOMES[biomeIndexFor(level)].name;

export const biomeAccentFor = (level: number) => BIOMES[biomeIndexFor(level)].accent;

type Harmonic = [k: number, weight: number, phase: number];

// A height profile that wraps seamlessly at tileWidth because every harmonic is an integer multiple
const makeRidge = (tileWidth: number, baseY: number, amp: number, harmonics: Harmonic[], ridged: boolean) => {
  const total = harmonics.reduce((a, h) => a + h[1], 0);
  return (x: number) => {
    let v = 0;
    harmonics.forEach(([k, w, ph]) => {
      const s = Math.sin((2 * Math.PI * k * x) / tileWidth + ph);
      v += w * (ridged ? 1 - Math.abs(s) : (s + 1) / 2);
    });
    return baseY - amp * (v / total);
  };
};

const terrainTile = (
  tileWidth: number, ridge: (x: number) => number, colors: string[], top: number, bottom: number, rim?: string
) =>
  record(tileWidth, H, c => {
    const fill = Skia.PathBuilder.Make();
    const edge = Skia.PathBuilder.Make();
    fill.moveTo(0, H);
    for (let x = 0; x <= tileWidth; x += 6) {
      const y = ridge(x);
      fill.lineTo(x, y);
      if (x === 0) edge.moveTo(x, y); else edge.lineTo(x, y);
    }
    fill.lineTo(tileWidth, H);
    fill.close();
    c.drawPath(fill.build(), shaderPaint(linear(0, top, 0, bottom, colors)));
    if (rim) c.drawPath(edge.build(), strokePaint(rim, 1.2));
  });

const drawCloud = (
  c: SkCanvas, cx: number, cy: number, s: number, alpha: number, rnd: () => number, shade: boolean,
  light: string, dark: string
) => {
  const puffs = 7;
  for (let i = 0; i < puffs; i++) {
    const u = i / (puffs - 1);
    const lift = Math.sin(u * Math.PI);
    const px = cx + (u - 0.5) * s * 3.2 + (rnd() - 0.5) * s * 0.2;
    const py = cy - lift * s * 0.35 + (rnd() - 0.5) * s * 0.15;
    const pr = s * (0.5 + lift * 0.55) * (0.85 + rnd() * 0.3);
    const colors = shade
      ? [`rgba(${dark},${alpha * 0.5})`, `rgba(${dark},${alpha * 0.3})`, `rgba(${dark},0)`]
      : [`rgba(${light},${alpha})`, `rgba(${light},${alpha * 0.8})`, `rgba(${light},0)`];
    const oy = shade ? pr * 0.28 : -pr * 0.08;
    c.drawCircle(px, py + oy, pr, shaderPaint(radial(px, py + oy, pr, colors, [0, 0.55, 1])));
  }
};

const cloudTile = (
  tileW: number, tileH: number, count: number, minSize: number, maxSize: number, alpha: number, seed: number,
  light: string, dark: string
): SkImage =>
  bake(tileW, tileH, c => {
    const rnd = seeded(seed);
    for (let n = 0; n < count; n++) {
      const cx = rnd() * tileW;
      const cy = tileH * (0.15 + rnd() * 0.7);
      const s = minSize + rnd() * (maxSize - minSize);
      const seedState = Math.floor(rnd() * 1e6) + 1;
      // Draw the cloud three times so ones crossing the tile edge wrap seamlessly
      [-tileW, 0, tileW].forEach(dx => {
        drawCloud(c, cx + dx, cy, s, alpha, seeded(seedState), true, light, dark);
        drawCloud(c, cx + dx, cy, s, alpha, seeded(seedState), false, light, dark);
      });
    }
  });

const drawPine = (c: SkCanvas, x: number, baseY: number, s: number, pine: Biome['pine']) => {
  c.drawRect(Skia.XYWHRect(x - 0.8 * s, baseY - 3 * s, 1.6 * s, 3 * s), fillPaint(pine.trunk));
  for (let t = 0; t < 3; t++) {
    const w = (5.5 - t * 1.3) * s;
    const y = baseY - (2.5 + t * 3.2) * s;
    const tri = Skia.PathBuilder.Make();
    tri.moveTo(x - w, y);
    tri.lineTo(x, y - 5 * s);
    tri.lineTo(x + w, y);
    tri.close();
    c.drawPath(tri.build(), shaderPaint(linear(x - w, 0, x + w, 0, pine.leaves)));
  }
};

interface Backdrop {
  sky: SkPicture;
  haze: SkPicture;
  ground: SkPicture;
  vignette: SkPicture;
  farClouds: SkImage;
  midClouds: SkImage;
  farMountains: SkPicture;
  nearMountains: SkPicture;
  hills: SkPicture;
  tiles: { farClouds: number; midClouds: number; farMountains: number; nearMountains: number; hills: number };
}

const cache = new Map<number, Backdrop>();

const buildBackdrop = (biome: Biome): Backdrop => {
  const tiles = { farClouds: 900, midClouds: 780, farMountains: 720, nearMountains: 560, hills: 640 };

  // Sky is unbounded so screen shake never reveals an edge
  const sky = createPictureUnbounded(c => {
    c.drawRect(Skia.XYWHRect(-60, -60, W + 120, GROUND_Y + 60 + 60),
      shaderPaint(linear(0, 0, 0, GROUND_Y, biome.sky, biome.skyPos)));
    if (biome.stars) {
      const rnd = seeded(404);
      for (let i = 0; i < 90; i++) {
        const r = 0.5 + rnd() * 0.9;
        c.drawCircle(rnd() * W, rnd() * GROUND_Y * 0.72, r, fillPaint(`rgba(255,255,255,${(0.35 + rnd() * 0.65).toFixed(2)})`));
      }
    }
    const { sun } = biome;
    const sx = W * sun.x;
    const sy = H * sun.y;
    c.drawCircle(sx, sy, sun.r, shaderPaint(radial(sx, sy, sun.r, sun.glow, [0, 0.35, 1])));
    c.drawCircle(sx, sy, 15, fillPaint(sun.core));
  });

  const haze = record(W, H, c => {
    c.drawRect(Skia.XYWHRect(0, GROUND_Y - H * 0.3, W, H * 0.3 + 2),
      shaderPaint(linear(0, GROUND_Y - H * 0.3, 0, GROUND_Y, [`rgba(${biome.haze},0)`, `rgba(${biome.haze},0.55)`])));
  });

  const farRidge = makeRidge(tiles.farMountains, GROUND_Y - 2, H * 0.3, [[2, 1, 0.4], [3, 0.7, 2.1], [5, 0.45, 4.2], [9, 0.2, 1.3]], true);
  const nearRidge = makeRidge(tiles.nearMountains, GROUND_Y, H * 0.2, [[2, 1, 1.2], [4, 0.6, 0.3], [7, 0.3, 2.6], [11, 0.15, 5]], true);
  const hillRidge = makeRidge(tiles.hills, GROUND_Y + 6, H * 0.075, [[1, 1, 0.2], [3, 0.5, 1.9], [5, 0.25, 3.3]], false);

  const farMountains = terrainTile(tiles.farMountains, farRidge, biome.farMtn.colors, GROUND_Y - H * 0.3, GROUND_Y, biome.farMtn.rim);
  const nearMountains = terrainTile(tiles.nearMountains, nearRidge, biome.nearMtn.colors, GROUND_Y - H * 0.2, GROUND_Y, biome.nearMtn.rim);

  const hills = record(tiles.hills, H, c => {
    const fill = Skia.PathBuilder.Make();
    fill.moveTo(0, H);
    for (let x = 0; x <= tiles.hills; x += 6) fill.lineTo(x, hillRidge(x));
    fill.lineTo(tiles.hills, H);
    fill.close();
    c.drawPath(fill.build(), shaderPaint(linear(0, GROUND_Y - H * 0.07, 0, GROUND_Y + 8, biome.hills)));
    const rnd = seeded(77);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * tiles.hills;
      drawPine(c, x, hillRidge(x) + 2, 0.8 + rnd() * 0.9, biome.pine);
    }
  });

  const ground = record(W, H, c => {
    c.drawRect(Skia.XYWHRect(-60, GROUND_Y, W + 120, GROUND_HEIGHT + 60),
      shaderPaint(linear(0, GROUND_Y, 0, H, biome.ground)));
    c.drawRect(Skia.XYWHRect(-60, GROUND_Y, W + 120, 2), fillPaint(biome.groundRim));
    c.drawRect(Skia.XYWHRect(-60, GROUND_Y + 2, W + 120, 10),
      shaderPaint(linear(0, GROUND_Y + 2, 0, GROUND_Y + 12, ['rgba(20,40,20,0.35)', 'rgba(20,40,20,0)'])));
  });

  const vignette = createPictureUnbounded(c => {
    const r = Math.hypot(W, H) * 0.55;
    c.drawRect(Skia.XYWHRect(-60, -60, W + 120, H + 120),
      shaderPaint(radial(W / 2, H / 2, r, [`rgba(${biome.vignette.rgb},0)`, `rgba(${biome.vignette.rgb},0)`, `rgba(${biome.vignette.rgb},${biome.vignette.alpha})`], [0, 0.55, 1])));
  });

  return {
    sky, haze, ground, vignette, tiles, farMountains, nearMountains, hills,
    farClouds: cloudTile(tiles.farClouds, Math.round(H * 0.62), biome.cloud.count[0], 16, 26, biome.cloud.alpha[0], 11, biome.cloud.light, biome.cloud.shade),
    midClouds: cloudTile(tiles.midClouds, Math.round(H * 0.7), biome.cloud.count[1], 26, 42, biome.cloud.alpha[1], 29, biome.cloud.light, biome.cloud.shade),
  };
};

// Only the biome in play is built; keeping a couple around avoids a rebuild when bouncing between menu and level
const getBackdrop = (biomeIndex: number) => {
  let b = cache.get(biomeIndex);
  if (!b) {
    if (cache.size >= 2) cache.delete(cache.keys().next().value as number);
    b = buildBackdrop(BIOMES[biomeIndex]);
    cache.set(biomeIndex, b);
  }
  return b;
};

const drawPictureTiled = (c: SkCanvas, pic: SkPicture, tileW: number, offset: number) => {
  for (let x = -(offset % tileW); x < W; x += tileW) {
    c.save();
    c.translate(x, 0);
    c.drawPicture(pic);
    c.restore();
  }
};

const drawImageTiled = (c: SkCanvas, img: SkImage, tileW: number, offset: number, y: number) => {
  for (let x = -(offset % tileW); x < W; x += tileW) c.drawImage(img, x, y);
};

const STRIPE_W = 46;
const STRIPE_FAN = 2.7;
const stripePaints = BIOMES.map(b => fillPaint(b.stripe));
const streakPaints = BIOMES.map(b => strokePaint(b.streak, 1.2));

export const drawBackdrop = (c: SkCanvas, frame: number, level: number) => {
  const biome = biomeIndexFor(level);
  const b = getBackdrop(biome);
  c.drawPicture(b.sky);

  drawImageTiled(c, b.farClouds, b.tiles.farClouds, frame * SPEED.farClouds, 0);
  drawPictureTiled(c, b.farMountains, b.tiles.farMountains, frame * SPEED.farMountains);
  c.drawPicture(b.haze);
  drawPictureTiled(c, b.nearMountains, b.tiles.nearMountains, frame * SPEED.nearMountains);
  drawImageTiled(c, b.midClouds, b.tiles.midClouds, frame * SPEED.midClouds, H * 0.04);
  drawPictureTiled(c, b.hills, b.tiles.hills, frame * SPEED.hills);

  c.drawPicture(b.ground);

  // Farmland stripes fan out from a vanishing point so the ground reads in perspective
  const vpX = W * 0.45;
  const off = (frame * SPEED.ground) % (STRIPE_W * 2);
  const stripes = Skia.PathBuilder.Make();
  for (let i = -6; i * STRIPE_W < W + STRIPE_W * 4; i += 2) {
    const xt = i * STRIPE_W - off;
    const xb = vpX + (xt - vpX) * STRIPE_FAN;
    const xb2 = vpX + (xt + STRIPE_W - vpX) * STRIPE_FAN;
    stripes.moveTo(xt, GROUND_Y);
    stripes.lineTo(xt + STRIPE_W, GROUND_Y);
    stripes.lineTo(xb2, H);
    stripes.lineTo(xb, H);
    stripes.close();
  }
  c.drawPath(stripes.build(), stripePaints[biome]);

  // Fast streaks sell the speed
  for (let i = 0; i < 7; i++) {
    const y = ((i * 97 + 31) % 100) / 100 * (GROUND_Y - 10) + 5;
    const v = 13 + i * 2.5;
    const x = W + 60 - ((frame * v + i * 173) % (W + 160));
    c.drawLine(x, y, x + 34 + i * 4, y, streakPaints[biome]);
  }
};

export const drawVignette = (c: SkCanvas, level: number) => c.drawPicture(getBackdrop(biomeIndexFor(level)).vignette);
