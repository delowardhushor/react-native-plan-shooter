import { Skia, BlurStyle, type SkCanvas, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { MISSILE_SIZE } from '../engine/Constants';
import { bake, fillPaint, linear, poly, radial, record, shaderPaint, strokePaint } from './gfx';

// Sprites are authored facing RIGHT. Enemies are mirrored at draw time.
// Jet frame: 56 x 26. Gunship frame: 64 x 34. Missile frame: 28 x 8.
export const JET_FRAME = { width: 56, height: 26 };
export const GUNSHIP_FRAME = { width: 64, height: 34 };

interface JetPalette {
  bodyTop: string;
  bodyMid: string;
  bodyLow: string;
  wingNear: [string, string];
  wingFar: string;
  fin: string;
  canopy: [string, string];
  accent: string;
}

const PLAYER_PALETTE: JetPalette = {
  bodyTop: '#e6edf3', bodyMid: '#9fb0be', bodyLow: '#56646f',
  wingNear: ['#c3cfd9', '#5f6e7b'], wingFar: '#46525d', fin: '#d3dde6',
  canopy: ['#dff4ff', '#2a6cab'], accent: '#e23b2e',
};

const ENEMY_PALETTE: JetPalette = {
  bodyTop: '#8d939e', bodyMid: '#585d69', bodyLow: '#2b2e36',
  wingNear: ['#6d7280', '#2d3037'], wingFar: '#1f2227', fin: '#6a6f7b',
  canopy: ['#ffe2b0', '#a8501a'], accent: '#d8392b',
};

const drawJet = (c: SkCanvas, pal: JetPalette) => {
  // Far-side surfaces (drawn first so the fuselage overlaps them)
  c.drawPath(poly([[37, 11], [28, 3.2], [22, 3.2], [25, 11]]), fillPaint(pal.wingFar));
  c.drawPath(poly([[10, 11], [5.5, 6.2], [2, 6.2], [5, 11]]), fillPaint(pal.wingFar));

  // Vertical tail
  c.drawPath(poly([[19, 9.8], [9, 0.4], [3.2, 0.4], [6.5, 10.2]]), shaderPaint(linear(0, 0, 0, 10, [pal.fin, pal.bodyMid])));
  c.drawPath(poly([[8.6, 2.2], [5.2, 2.2], [6.2, 5.2], [9.6, 5.2]]), fillPaint(pal.accent));

  // Fuselage
  const body = Skia.PathBuilder.Make();
  body.moveTo(56, 14);
  body.cubicTo(51, 11, 45, 9.4, 36, 9.1);
  body.lineTo(9, 9.4);
  body.lineTo(3.5, 11);
  body.lineTo(3.5, 16.2);
  body.lineTo(9, 17.8);
  body.lineTo(36, 18);
  body.cubicTo(45, 18, 51, 16.6, 56, 14);
  body.close();
  c.drawPath(body.build(), shaderPaint(linear(0, 9, 0, 18, [pal.bodyTop, pal.bodyMid, pal.bodyLow], [0, 0.5, 1])));

  // Panel lines, intake and radome
  const lines = strokePaint('rgba(0,0,0,0.2)', 0.6);
  c.drawLine(22, 9.6, 22, 17.8, lines);
  c.drawLine(31, 9.3, 31, 18, lines);
  c.drawPath(poly([[34, 13.2], [41, 13.6], [41, 17.7], [34, 17.9]]), fillPaint('rgba(5,10,16,0.45)'));
  c.drawPath(poly([[52.2, 12.4], [56, 14], [52.2, 15.7]]), fillPaint('rgba(25,32,40,0.85)'));
  c.drawCircle(27, 13.6, 1.9, fillPaint(pal.accent));
  c.drawCircle(27, 13.6, 0.8, fillPaint('#ffffff'));

  // Near wing + tailplane (lit from above, darker toward the tip)
  c.drawPath(poly([[39, 15.5], [27.5, 25.6], [19, 25.6], [23, 15.5]]), shaderPaint(linear(0, 15.5, 0, 25.6, pal.wingNear)));
  c.drawLine(39, 15.5, 27.5, 25.6, strokePaint('rgba(255,255,255,0.45)', 0.8));
  c.drawPath(poly([[11.5, 14.6], [5.5, 19.8], [1.5, 19.8], [5, 14.6]]), shaderPaint(linear(0, 14.6, 0, 19.8, pal.wingNear)));

  // Canopy
  const canopy = Skia.PathBuilder.Make();
  canopy.moveTo(39.5, 9.5);
  canopy.cubicTo(41, 5.4, 47, 6, 51, 10.8);
  canopy.lineTo(51, 11);
  canopy.lineTo(39.5, 10.2);
  canopy.close();
  c.drawPath(canopy.build(), shaderPaint(linear(0, 5.6, 0, 10.6, pal.canopy)));
  c.drawLine(45.2, 6.6, 45.4, 10.4, strokePaint('rgba(0,0,0,0.45)', 0.6));
  const glint = Skia.PathBuilder.Make();
  glint.moveTo(41.6, 8.6);
  glint.quadTo(44.4, 6.3, 47.8, 8.2);
  c.drawPath(glint.build(), strokePaint('rgba(255,255,255,0.75)', 0.9));

  // Spine highlight + exhaust nozzle
  c.drawLine(12, 9.9, 36, 9.7, strokePaint('rgba(255,255,255,0.45)', 0.8));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(2.2, 11, 2.8, 4.8), 0.8, 0.8), fillPaint('#1d2228'));
};

interface GunshipPalette {
  bodyTop: string; bodyMid: string; bodyLow: string;
  wingNear: [string, string]; wingFar: string; accent: string;
}

const GUNSHIP_PALETTE: GunshipPalette = {
  bodyTop: '#8c9272', bodyMid: '#555b44', bodyLow: '#2a2d22',
  wingNear: ['#6f7558', '#2f3326'], wingFar: '#23261c', accent: '#e08a2c',
};

const drawGunship = (c: SkCanvas, pal: GunshipPalette) => {
  // Far wing + far engine
  c.drawPath(poly([[47, 14], [38, 1.5], [24, 1.5], [29, 14]]), fillPaint(pal.wingFar));
  c.drawOval(Skia.XYWHRect(25, 5, 21, 7), fillPaint('#1c1f17'));

  // Tail
  c.drawPath(poly([[18, 12.5], [9, 0.5], [1.5, 0.5], [4.5, 13]]), shaderPaint(linear(0, 0, 0, 13, ['#80856a', pal.bodyMid])));
  c.drawPath(poly([[9.5, 2.6], [5, 2.6], [6, 6.2], [10.8, 6.2]]), fillPaint(pal.accent));

  // Fuselage
  const body = Skia.PathBuilder.Make();
  body.moveTo(64, 19);
  body.cubicTo(58, 14, 50, 12, 40, 12);
  body.lineTo(10, 12.5);
  body.lineTo(3, 15.2);
  body.lineTo(3, 22);
  body.lineTo(10, 24.6);
  body.lineTo(40, 25);
  body.cubicTo(50, 25, 58, 23.6, 64, 19);
  body.close();
  c.drawPath(body.build(), shaderPaint(linear(0, 12, 0, 25, [pal.bodyTop, pal.bodyMid, pal.bodyLow], [0, 0.5, 1])));

  // Armour plating, accent stripe and belly gun
  const lines = strokePaint('rgba(0,0,0,0.25)', 0.7);
  [18, 28, 38, 48].forEach(x => c.drawLine(x, 12.4, x, 24.8, lines));
  c.drawRect(Skia.XYWHRect(11, 18.2, 36, 1.8), fillPaint(pal.accent));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(42, 24, 11, 3.4), 1.2, 1.2), fillPaint('#1b1d16'));
  c.drawLine(53, 25.7, 60, 25.7, strokePaint('#15170f', 1.4));

  // Near wing + engine nacelle
  c.drawPath(poly([[48, 21], [31, 33.6], [17, 33.6], [25, 21]]), shaderPaint(linear(0, 21, 0, 33.6, pal.wingNear)));
  c.drawLine(48, 21, 31, 33.6, strokePaint('rgba(255,255,255,0.35)', 0.9));
  c.drawOval(Skia.XYWHRect(23, 25.5, 24, 7.5), shaderPaint(linear(0, 25.5, 0, 33, ['#7d8366', '#26291e'])));
  c.drawOval(Skia.XYWHRect(43.5, 26.4, 4.4, 5.8), fillPaint('#0d0f0a'));
  c.drawOval(Skia.XYWHRect(22.5, 27.2, 3, 4.2), fillPaint('#ff9a3c'));

  // Cockpit glass
  const glass = Skia.PathBuilder.Make();
  glass.moveTo(47, 12.4);
  glass.cubicTo(50, 8.6, 57, 10, 60.5, 17);
  glass.lineTo(47, 15.5);
  glass.close();
  c.drawPath(glass.build(), shaderPaint(linear(0, 9, 0, 17, ['#ffe7b8', '#a14b16'])));
  const glint = Skia.PathBuilder.Make();
  glint.moveTo(50, 11.8);
  glint.quadTo(54, 9.8, 57.6, 13.2);
  c.drawPath(glint.build(), strokePaint('rgba(255,255,255,0.7)', 1));

  c.drawLine(10, 12.8, 40, 12.5, strokePaint('rgba(255,255,255,0.35)', 0.9));
};

const drawMissile = (c: SkCanvas) => {
  // Tail fins
  c.drawPath(poly([[7, 1.6], [2, 0], [0, 0], [3.6, 3.2]]), fillPaint('#3a424b'));
  c.drawPath(poly([[7, 6.4], [2, 8], [0, 8], [3.6, 4.8]]), fillPaint('#2b3239'));
  // Body
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(5, 1.4, 19, 5.2), 2.4, 2.4),
    shaderPaint(linear(0, 1.4, 0, 6.6, ['#f1f4f7', '#a9b4be', '#5f6b76'], [0, 0.5, 1])));
  c.drawRect(Skia.XYWHRect(13, 1.4, 2, 5.2), fillPaint('#f08a24'));
  // Warhead
  c.drawPath(poly([[23, 1.4], [28, 4], [23, 6.6]]), shaderPaint(linear(0, 1.4, 0, 6.6, ['#ff6a55', '#8e1710'])));
  c.drawLine(7, 2.2, 22, 2.2, strokePaint('rgba(255,255,255,0.6)', 0.7));
};

// Soft round glow sprite (baked once)
const glowImage = (size: number, colors: string[], pos?: number[]) =>
  bake(size, size, c => {
    c.drawCircle(size / 2, size / 2, size / 2, shaderPaint(radial(size / 2, size / 2, size / 2, colors, pos)));
  });

const FIRE_RAMP = ['#fffbe3', '#ffe27d', '#ffb12f', '#ff7418', '#d63a12', '#7a1d0c'];
const SMOKE_RAMP = ['#d2d2d2', '#a3a3a3', '#737373', '#4b4b4b'];

const hexAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export interface Sprites {
  player: SkPicture;
  enemy: SkPicture;
  roamer: SkPicture;
  missile: SkPicture;
  bullet: SkImage;
  enemyBullet: SkImage;
  flash: SkImage;
  engineGlow: SkImage;
  fire: SkImage[];
  smoke: SkImage[];
}

let cache: Sprites | null = null;

export const getSprites = (): Sprites => {
  if (cache) return cache;

  const bullet = bake(32, 14, c => {
    const glow = Skia.Paint();
    glow.setColor(Skia.Color('#ffd34a'));
    glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3, true));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(5, 4, 22, 6), 3, 3), glow);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(8, 5.4, 17, 3.2), 1.6, 1.6),
      shaderPaint(linear(8, 0, 25, 0, ['rgba(255,210,80,0.0)', '#fff3b0', '#ffffff'], [0, 0.55, 1])));
  });

  const enemyBullet = glowImage(28, ['#ffffff', '#ffd9a0', 'rgba(255,90,40,0.9)', 'rgba(255,40,20,0)'], [0, 0.2, 0.5, 1]);
  const flash = glowImage(64, ['#ffffff', 'rgba(255,238,170,0.9)', 'rgba(255,170,60,0.35)', 'rgba(255,120,30,0)'], [0, 0.25, 0.6, 1]);
  const engineGlow = glowImage(48, ['rgba(255,255,255,0.95)', 'rgba(130,200,255,0.7)', 'rgba(255,150,50,0.35)', 'rgba(255,100,20,0)'], [0, 0.18, 0.5, 1]);
  const fire = FIRE_RAMP.map(col => glowImage(32, [hexAlpha(col, 1), hexAlpha(col, 0.92), hexAlpha(col, 0)], [0, 0.55, 1]));
  const smoke = SMOKE_RAMP.map(col => glowImage(32, [hexAlpha(col, 0.7), hexAlpha(col, 0.4), hexAlpha(col, 0)], [0, 0.5, 1]));

  cache = {
    player: record(JET_FRAME.width, JET_FRAME.height, c => drawJet(c, PLAYER_PALETTE)),
    enemy: record(JET_FRAME.width, JET_FRAME.height, c => drawJet(c, ENEMY_PALETTE)),
    roamer: record(GUNSHIP_FRAME.width, GUNSHIP_FRAME.height, c => drawGunship(c, GUNSHIP_PALETTE)),
    missile: record(MISSILE_SIZE.width, MISSILE_SIZE.height, drawMissile),
    bullet, enemyBullet, flash, engineGlow, fire, smoke,
  };
  return cache;
};
