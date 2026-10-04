import { Skia, type SkCanvas, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { SCREEN_WIDTH as W, SCREEN_HEIGHT as H, GROUND_HEIGHT } from '../engine/Constants';
import { bake, createPictureUnbounded, fillPaint, linear, radial, record, seeded, shaderPaint, strokePaint } from './gfx';

export const GROUND_Y = H - GROUND_HEIGHT;

// Scroll speeds in px/frame. Farther layers move slower, which is what sells the depth.
const SPEED = { farClouds: 0.25, farMountains: 0.2, nearMountains: 0.5, midClouds: 0.9, hills: 1.6, ground: 3 };

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

const drawCloud = (c: SkCanvas, cx: number, cy: number, s: number, alpha: number, rnd: () => number, shade: boolean) => {
  const puffs = 7;
  for (let i = 0; i < puffs; i++) {
    const u = i / (puffs - 1);
    const lift = Math.sin(u * Math.PI);
    const px = cx + (u - 0.5) * s * 3.2 + (rnd() - 0.5) * s * 0.2;
    const py = cy - lift * s * 0.35 + (rnd() - 0.5) * s * 0.15;
    const pr = s * (0.5 + lift * 0.55) * (0.85 + rnd() * 0.3);
    const colors = shade
      ? [`rgba(140,160,190,${alpha * 0.5})`, `rgba(140,160,190,${alpha * 0.3})`, 'rgba(140,160,190,0)']
      : [`rgba(255,255,255,${alpha})`, `rgba(255,255,255,${alpha * 0.8})`, 'rgba(255,255,255,0)'];
    const oy = shade ? pr * 0.28 : -pr * 0.08;
    c.drawCircle(px, py + oy, pr, shaderPaint(radial(px, py + oy, pr, colors, [0, 0.55, 1])));
  }
};

const cloudTile = (tileW: number, tileH: number, count: number, minSize: number, maxSize: number, alpha: number, seed: number): SkImage =>
  bake(tileW, tileH, c => {
    const rnd = seeded(seed);
    for (let n = 0; n < count; n++) {
      const cx = rnd() * tileW;
      const cy = tileH * (0.15 + rnd() * 0.7);
      const s = minSize + rnd() * (maxSize - minSize);
      const seedState = Math.floor(rnd() * 1e6) + 1;
      // Draw the cloud three times so ones crossing the tile edge wrap seamlessly
      [-tileW, 0, tileW].forEach(dx => {
        drawCloud(c, cx + dx, cy, s, alpha, seeded(seedState), true);
        drawCloud(c, cx + dx, cy, s, alpha, seeded(seedState), false);
      });
    }
  });

const drawPine = (c: SkCanvas, x: number, baseY: number, s: number) => {
  c.drawRect(Skia.XYWHRect(x - 0.8 * s, baseY - 3 * s, 1.6 * s, 3 * s), fillPaint('#2c2217'));
  for (let t = 0; t < 3; t++) {
    const w = (5.5 - t * 1.3) * s;
    const y = baseY - (2.5 + t * 3.2) * s;
    const tri = Skia.PathBuilder.Make();
    tri.moveTo(x - w, y);
    tri.lineTo(x, y - 5 * s);
    tri.lineTo(x + w, y);
    tri.close();
    c.drawPath(tri.build(), shaderPaint(linear(x - w, 0, x + w, 0, ['#35693f', '#1d4128'])));
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

let cache: Backdrop | null = null;

const buildBackdrop = (): Backdrop => {
  const tiles = { farClouds: 900, midClouds: 780, farMountains: 720, nearMountains: 560, hills: 640 };

  // Sky is unbounded so screen shake never reveals an edge
  const sky = createPictureUnbounded(c => {
    c.drawRect(Skia.XYWHRect(-60, -60, W + 120, GROUND_Y + 60 + 60),
      shaderPaint(linear(0, 0, 0, GROUND_Y, ['#1a58a4', '#3b84ca', '#8dc4eb', '#dcecf3'], [0, 0.42, 0.8, 1])));
    const sx = W * 0.8;
    const sy = H * 0.24;
    c.drawCircle(sx, sy, 170, shaderPaint(radial(sx, sy, 170, ['rgba(255,244,205,0.85)', 'rgba(255,230,170,0.3)', 'rgba(255,220,150,0)'], [0, 0.35, 1])));
    c.drawCircle(sx, sy, 15, fillPaint('#fffdf2'));
  });

  const haze = record(W, H, c => {
    c.drawRect(Skia.XYWHRect(0, GROUND_Y - H * 0.3, W, H * 0.3 + 2),
      shaderPaint(linear(0, GROUND_Y - H * 0.3, 0, GROUND_Y, ['rgba(226,240,248,0)', 'rgba(226,240,248,0.55)'])));
  });

  const farRidge = makeRidge(tiles.farMountains, GROUND_Y - 2, H * 0.3, [[2, 1, 0.4], [3, 0.7, 2.1], [5, 0.45, 4.2], [9, 0.2, 1.3]], true);
  const nearRidge = makeRidge(tiles.nearMountains, GROUND_Y, H * 0.2, [[2, 1, 1.2], [4, 0.6, 0.3], [7, 0.3, 2.6], [11, 0.15, 5]], true);
  const hillRidge = makeRidge(tiles.hills, GROUND_Y + 6, H * 0.075, [[1, 1, 0.2], [3, 0.5, 1.9], [5, 0.25, 3.3]], false);

  const farMountains = terrainTile(tiles.farMountains, farRidge, ['#8fa8c4', '#bcd2e4'], GROUND_Y - H * 0.3, GROUND_Y, 'rgba(255,255,255,0.35)');
  const nearMountains = terrainTile(tiles.nearMountains, nearRidge, ['#5f819f', '#9ebbd0'], GROUND_Y - H * 0.2, GROUND_Y, 'rgba(255,255,255,0.25)');

  const hills = record(tiles.hills, H, c => {
    const fill = Skia.PathBuilder.Make();
    fill.moveTo(0, H);
    for (let x = 0; x <= tiles.hills; x += 6) fill.lineTo(x, hillRidge(x));
    fill.lineTo(tiles.hills, H);
    fill.close();
    c.drawPath(fill.build(), shaderPaint(linear(0, GROUND_Y - H * 0.07, 0, GROUND_Y + 8, ['#4d8250', '#2f5c3a'])));
    const rnd = seeded(77);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * tiles.hills;
      drawPine(c, x, hillRidge(x) + 2, 0.8 + rnd() * 0.9);
    }
  });

  const ground = record(W, H, c => {
    c.drawRect(Skia.XYWHRect(-60, GROUND_Y, W + 120, GROUND_HEIGHT + 60),
      shaderPaint(linear(0, GROUND_Y, 0, H, ['#527f3a', '#3c6a2c', '#27481f'])));
    c.drawRect(Skia.XYWHRect(-60, GROUND_Y, W + 120, 2), fillPaint('rgba(220,255,190,0.35)'));
    c.drawRect(Skia.XYWHRect(-60, GROUND_Y + 2, W + 120, 10),
      shaderPaint(linear(0, GROUND_Y + 2, 0, GROUND_Y + 12, ['rgba(20,40,20,0.35)', 'rgba(20,40,20,0)'])));
  });

  const vignette = createPictureUnbounded(c => {
    const r = Math.hypot(W, H) * 0.55;
    c.drawRect(Skia.XYWHRect(-60, -60, W + 120, H + 120),
      shaderPaint(radial(W / 2, H / 2, r, ['rgba(4,12,24,0)', 'rgba(4,12,24,0)', 'rgba(4,12,24,0.5)'], [0, 0.55, 1])));
  });

  return {
    sky, haze, ground, vignette, tiles, farMountains, nearMountains, hills,
    farClouds: cloudTile(tiles.farClouds, Math.round(H * 0.62), 5, 16, 26, 0.55, 11),
    midClouds: cloudTile(tiles.midClouds, Math.round(H * 0.7), 4, 26, 42, 0.8, 29),
  };
};

const getBackdrop = () => (cache ??= buildBackdrop());

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
const stripePaint = fillPaint('rgba(10,30,5,0.17)');
const streakPaint = strokePaint('rgba(255,255,255,0.13)', 1.2);

export const drawBackdrop = (c: SkCanvas, frame: number) => {
  const b = getBackdrop();
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
  c.drawPath(stripes.build(), stripePaint);

  // Fast streaks sell the speed
  for (let i = 0; i < 7; i++) {
    const y = ((i * 97 + 31) % 100) / 100 * (GROUND_Y - 10) + 5;
    const v = 13 + i * 2.5;
    const x = W + 60 - ((frame * v + i * 173) % (W + 160));
    c.drawLine(x, y, x + 34 + i * 4, y, streakPaint);
  }
};

export const drawVignette = (c: SkCanvas) => c.drawPicture(getBackdrop().vignette);
