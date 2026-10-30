import { Skia, BlurStyle, type SkCanvas, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { MISSILES, type MissileType } from '../engine/Weapons';
import { EnemyType } from '../engine/Enemies';
import { bake, fillPaint, linear, poly, radial, record, shaderPaint, strokePaint } from './gfx';

// Sprites are authored facing RIGHT. Enemies are mirrored at draw time.
// Jet frame: 56 x 26. Gunship frame: 64 x 34. Missile frame: 28 x 8.
export const JET_FRAME = { width: 56, height: 26 };
export const GUNSHIP_FRAME = { width: 64, height: 34 };
export const DELTA_FRAME = { width: 48, height: 20 };
export const BOMBER_FRAME = { width: 80, height: 36 };
export const SNIPER_FRAME = { width: 60, height: 22 };
export const TITAN_FRAME = { width: 72, height: 40 };

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

// The player's own jet: cobalt and white with gold trim, so it never reads as a recoloured enemy.
// It evolves with the cannon level: wing cannons from tier 3, gold-plated nose and wingtip lights from tier 5.
export const HERO_TIERS = 5;

const HERO = {
  bodyTop: '#f6f9ff', bodyMid: '#4a86dc', bodyLow: '#16336a',
  wingNear: ['#8bb8f7', '#1e4690'] as [string, string], wingFar: '#17305f',
  canopy: ['#d4f8ff', '#1a6fd6'] as [string, string],
};

const drawHero = (c: SkCanvas, tier: number) => {
  const gold = tier >= 5 ? '#ffd35a' : '#ffb23e';

  // Far-side surfaces and the second (far) tail fin
  c.drawPath(poly([[37, 11], [28, 3.2], [22, 3.2], [25, 11]]), fillPaint(HERO.wingFar));
  c.drawPath(poly([[10, 11], [5.5, 6.2], [2, 6.2], [5, 11]]), fillPaint(HERO.wingFar));
  c.drawPath(poly([[22, 9.8], [14.5, 1.8], [10.5, 1.8], [13, 10]]), fillPaint('#1d3c75'));

  // Main tail fin with a gold flash
  c.drawPath(poly([[19, 9.8], [9, 0.4], [3.2, 0.4], [6.5, 10.2]]), shaderPaint(linear(0, 0, 0, 10, ['#eef4ff', '#5f93e0'])));
  c.drawPath(poly([[8.8, 1.8], [4.6, 1.8], [5.9, 5.8], [10.3, 5.8]]), fillPaint(gold));

  // Fuselage: white back fading to a deep blue belly
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
  c.drawPath(body.build(), shaderPaint(linear(0, 9, 0, 18, [HERO.bodyTop, HERO.bodyMid, HERO.bodyLow], [0, 0.5, 1])));

  // Gold racing stripe with a pale line under it
  c.drawLine(7.5, 12.7, 39, 12.3, strokePaint(gold, 1.2));
  c.drawLine(7.5, 13.7, 36, 13.3, strokePaint('rgba(255,255,255,0.45)', 0.5));

  // Panel lines, intake, radome and emblem
  const lines = strokePaint('rgba(0,0,0,0.22)', 0.6);
  c.drawLine(22, 9.6, 22, 17.8, lines);
  c.drawLine(31, 9.3, 31, 18, lines);
  c.drawPath(poly([[34, 13.9], [41, 14.2], [41, 17.7], [34, 17.9]]), fillPaint('rgba(5,10,30,0.55)'));
  c.drawLine(34, 14, 41, 14.3, strokePaint('rgba(255,255,255,0.5)', 0.5));
  c.drawPath(poly([[52.2, 12.4], [56, 14], [52.2, 15.7]]), fillPaint(tier >= 5 ? gold : 'rgba(22,30,50,0.9)'));
  c.drawCircle(27, 15.4, 1.8, fillPaint('#0f2a5c'));
  c.drawCircle(27, 15.4, 1.1, fillPaint(gold));
  c.drawCircle(27, 15.4, 0.4, fillPaint('#ffffff'));

  // Near wing and tailplane, lit from above, with a gold leading edge
  c.drawPath(poly([[39, 15.5], [27.5, 25.6], [19, 25.6], [23, 15.5]]), shaderPaint(linear(0, 15.5, 0, 25.6, HERO.wingNear)));
  c.drawLine(39, 15.5, 27.5, 25.6, strokePaint(gold, tier >= 2 ? 1.1 : 0.8));
  c.drawLine(31, 17.5, 22.5, 24.8, strokePaint('rgba(255,255,255,0.22)', 0.6));
  c.drawPath(poly([[11.5, 14.6], [5.5, 19.8], [1.5, 19.8], [5, 14.6]]), shaderPaint(linear(0, 14.6, 0, 19.8, HERO.wingNear)));

  // Wing cannons poke out ahead of the near wing from tier 3
  if (tier >= 3) {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(27, 20.3, 12, 1.7), 0.8, 0.8), fillPaint('#1b2740'));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(36.5, 20.1, 3.2, 2.1), 0.6, 0.6), fillPaint(gold));
  }

  // Canopy with a glint
  const canopy = Skia.PathBuilder.Make();
  canopy.moveTo(39.5, 9.5);
  canopy.cubicTo(41, 5.4, 47, 6, 51, 10.8);
  canopy.lineTo(51, 11);
  canopy.lineTo(39.5, 10.2);
  canopy.close();
  c.drawPath(canopy.build(), shaderPaint(linear(0, 5.6, 0, 10.6, HERO.canopy)));
  c.drawLine(45.2, 6.6, 45.4, 10.4, strokePaint('rgba(10,30,70,0.5)', 0.6));
  const glint = Skia.PathBuilder.Make();
  glint.moveTo(41.6, 8.6);
  glint.quadTo(44.4, 6.3, 47.8, 8.2);
  c.drawPath(glint.build(), strokePaint('rgba(255,255,255,0.85)', 0.9));

  // Spine highlight and a hot exhaust nozzle
  c.drawLine(12, 9.9, 36, 9.7, strokePaint('rgba(255,255,255,0.6)', 0.8));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(2.2, 11, 2.8, 4.8), 0.8, 0.8), fillPaint('#1d2228'));
  c.drawCircle(2.9, 13.4, 1.1, fillPaint('#ff9a4a'));

  // Navigation lights on the wingtips for the top tier
  if (tier >= 5) {
    c.drawCircle(19.8, 25, 0.9, fillPaint('#ff5a4a'));
    c.drawCircle(22.6, 3.4, 0.9, fillPaint('#5aff9a'));
  }
};

interface GunshipPalette {
  bodyTop: string; bodyMid: string; bodyLow: string;
  wingNear: [string, string]; wingFar: string; accent: string;
}

const GUNSHIP_PALETTE: GunshipPalette = {
  bodyTop: '#8c9272', bodyMid: '#555b44', bodyLow: '#2a2d22',
  wingNear: ['#6f7558', '#2f3326'], wingFar: '#23261c', accent: '#e08a2c',
};

const BOSS_PALETTE: GunshipPalette = {
  bodyTop: '#8d92a3', bodyMid: '#484d5e', bodyLow: '#1c1f28',
  wingNear: ['#5d6277', '#22252f'], wingFar: '#15171d', accent: '#e0322b',
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

const WAVER_PALETTE: JetPalette = {
  bodyTop: '#8cc7c0', bodyMid: '#3f7a74', bodyLow: '#183a3a',
  wingNear: ['#5fa099', '#1f4a48'], wingFar: '#142e2e', fin: '#5aa8a0',
  canopy: ['#e7ffd8', '#3a9a5a'], accent: '#ffd23a',
};

const RUSHER_PALETTE: JetPalette = {
  bodyTop: '#e09a78', bodyMid: '#98402c', bodyLow: '#3b1710',
  wingNear: ['#c25d3c', '#4a1d12'], wingFar: '#2e120b', fin: '#c25d3c',
  canopy: ['#fff1c8', '#c05a1a'], accent: '#ffcf3a',
};

const SNIPER_PALETTE: JetPalette = {
  bodyTop: '#b39ccf', bodyMid: '#5f4d85', bodyLow: '#241c38',
  wingNear: ['#8470ad', '#2c2342'], wingFar: '#1b1529', fin: '#8470ad',
  canopy: ['#ffd6f4', '#8a2a9a'], accent: '#ff3fb0',
};

const BOMBER_PALETTE: JetPalette = {
  bodyTop: '#bfae86', bodyMid: '#7d6c4a', bodyLow: '#36301f',
  wingNear: ['#988662', '#3d3524'], wingFar: '#2a2418', fin: '#8f7e5a',
  canopy: ['#ffe9b8', '#a66a1c'], accent: '#d8392b',
};

const CARRIER_PALETTE: JetPalette = {
  bodyTop: '#9bb2cc', bodyMid: '#4a6483', bodyLow: '#1b2a3f',
  wingNear: ['#6482a4', '#223248'], wingFar: '#14202f', fin: '#6482a4',
  canopy: ['#d6f6ff', '#2a7fb0'], accent: '#3ad0ff',
};

const PHANTOM_PALETTE: JetPalette = {
  bodyTop: '#9488ba', bodyMid: '#483d6e', bodyLow: '#16122a',
  wingNear: ['#645a8f', '#1f1936'], wingFar: '#110d20', fin: '#6a5f96',
  canopy: ['#d9fbff', '#2a8ab0'], accent: '#43e0ff',
};

const TITAN_PALETTE: JetPalette = {
  bodyTop: '#b3aaa6', bodyMid: '#5d4b4b', bodyLow: '#221a1a',
  wingNear: ['#7a6666', '#2a1f1f'], wingFar: '#171010', fin: '#7a6666',
  canopy: ['#ffd9c8', '#a8301f'], accent: '#ff3b2a',
};

// Swept delta wing: small and quick as the rusher, larger with wing pods as the Phantom boss
const drawDelta = (c: SkCanvas, pal: JetPalette, boss: boolean) => {
  c.drawPath(poly([[30, 9], [14, 0.5], [8, 0.5], [16, 9]]), fillPaint(pal.wingFar));
  c.drawPath(poly([[14, 8], [6, 1.5], [2, 1.5], [5, 8.4]]), shaderPaint(linear(0, 1.5, 0, 8, [pal.fin, pal.bodyMid])));
  c.drawPath(poly([[10.4, 2.6], [6.4, 2.6], [7.4, 4.6], [10.8, 4.6]]), fillPaint(pal.accent));

  const body = Skia.PathBuilder.Make();
  body.moveTo(48, 10);
  body.lineTo(34, 7.6);
  body.lineTo(6, 7.4);
  body.lineTo(2, 8.6);
  body.lineTo(2, 11.4);
  body.lineTo(6, 12.6);
  body.lineTo(34, 12.4);
  body.close();
  c.drawPath(body.build(), shaderPaint(linear(0, 7.4, 0, 12.6, [pal.bodyTop, pal.bodyMid, pal.bodyLow], [0, 0.5, 1])));

  c.drawPath(poly([[36, 11.6], [16, 19.5], [7, 19.5], [14, 11.6]]), shaderPaint(linear(0, 11.6, 0, 19.5, pal.wingNear)));
  c.drawLine(36, 11.6, 16, 19.5, strokePaint('rgba(255,255,255,0.4)', 0.8));
  c.drawRect(Skia.XYWHRect(8, 9.4, 22, 1.2), fillPaint(pal.accent));

  c.drawPath(poly([[28, 7.8], [31, 5.2], [37, 5.4], [41, 8.2]]), shaderPaint(linear(0, 5.2, 0, 8.2, pal.canopy)));
  c.drawLine(12, 7.8, 34, 7.7, strokePaint('rgba(255,255,255,0.4)', 0.7));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(1.4, 8.4, 2.6, 3.2), 0.8, 0.8), fillPaint('#1d2228'));

  if (boss) {
    // Wing-tip pods and a glowing seam give the boss a menacing silhouette
    c.drawOval(Skia.XYWHRect(10, 17, 12, 3.4), fillPaint(pal.bodyLow));
    c.drawCircle(21.5, 18.7, 1.2, fillPaint(pal.accent));
    c.drawOval(Skia.XYWHRect(14, 0, 12, 2.6), fillPaint(pal.wingFar));
    c.drawCircle(25, 1.3, 1, fillPaint(pal.accent));
    c.drawLine(8, 10, 40, 10, strokePaint(pal.accent, 0.6));
  }
};

// Heavy twin-engine bomber; the carrier boss adds hangar doors and a radar dish
const drawBomber = (c: SkCanvas, pal: JetPalette, carrier: boolean) => {
  c.drawPath(poly([[56, 15], [44, 2], [28, 2], [36, 15]]), fillPaint(pal.wingFar));
  c.drawPath(poly([[22, 13], [10, 0.8], [2, 0.8], [6, 13.5]]), shaderPaint(linear(0, 0.8, 0, 13, [pal.fin, pal.bodyMid])));
  c.drawPath(poly([[12.6, 3], [6.4, 3], [8, 7], [14, 7]]), fillPaint(pal.accent));

  const body = Skia.PathBuilder.Make();
  body.moveTo(80, 19.5);
  body.cubicTo(73, 14.5, 61, 12.4, 48, 12.2);
  body.lineTo(10, 12.8);
  body.lineTo(3, 15.5);
  body.lineTo(3, 24.5);
  body.lineTo(10, 27.2);
  body.lineTo(48, 27.6);
  body.cubicTo(61, 27.6, 73, 24.4, 80, 19.5);
  body.close();
  c.drawPath(body.build(), shaderPaint(linear(0, 12, 0, 27.6, [pal.bodyTop, pal.bodyMid, pal.bodyLow], [0, 0.5, 1])));

  const lines = strokePaint('rgba(0,0,0,0.25)', 0.7);
  [16, 26, 36, 46].forEach(x => c.drawLine(x, 12.8, x, 27.4, lines));
  c.drawRect(Skia.XYWHRect(12, 21.6, 44, 1.6), fillPaint(pal.accent));

  c.drawPath(poly([[58, 25], [40, 35.5], [22, 35.5], [32, 25]]), shaderPaint(linear(0, 25, 0, 35.5, pal.wingNear)));
  c.drawLine(58, 25, 40, 35.5, strokePaint('rgba(255,255,255,0.35)', 0.9));
  c.drawOval(Skia.XYWHRect(28, 28.5, 24, 7), shaderPaint(linear(0, 28.5, 0, 35.5, [pal.bodyTop, pal.bodyLow])));
  c.drawOval(Skia.XYWHRect(47, 29.4, 4.6, 5.2), fillPaint('#0d0f0a'));
  c.drawOval(Skia.XYWHRect(27.5, 30, 3, 4), fillPaint('#ff9a3c'));

  const glass = Skia.PathBuilder.Make();
  glass.moveTo(60, 13.2);
  glass.cubicTo(64, 9.4, 71, 10.6, 75, 16.4);
  glass.lineTo(60, 15.6);
  glass.close();
  c.drawPath(glass.build(), shaderPaint(linear(0, 9.6, 0, 16, pal.canopy)));
  c.drawLine(12, 13.2, 48, 12.9, strokePaint('rgba(255,255,255,0.35)', 0.9));

  if (carrier) {
    c.drawRect(Skia.XYWHRect(22, 15.4, 28, 6), fillPaint('rgba(5,10,18,0.75)'));
    [30, 38, 46].forEach(x => c.drawLine(x, 15.4, x, 21.4, strokePaint(pal.accent, 0.8)));
    c.drawLine(40, 12.4, 40, 7.6, strokePaint(pal.bodyLow, 1));
    c.drawOval(Skia.XYWHRect(34, 5.6, 12, 3.2), fillPaint(pal.bodyTop));
    c.drawCircle(40, 7.2, 1, fillPaint(pal.accent));
  }
};

// Slender sniper: long needle nose with a glowing red-eyed lens
const drawSniper = (c: SkCanvas, pal: JetPalette) => {
  c.drawPath(poly([[36, 10], [26, 2], [22, 2], [28, 10]]), fillPaint(pal.wingFar));
  c.drawPath(poly([[14, 9.5], [7, 2], [3, 2], [6, 9.8]]), shaderPaint(linear(0, 2, 0, 9.5, [pal.fin, pal.bodyMid])));
  c.drawPath(poly([[8.4, 3.2], [5, 3.2], [5.8, 5.4], [9.2, 5.4]]), fillPaint(pal.accent));

  const body = Skia.PathBuilder.Make();
  body.moveTo(60, 11.4);
  body.lineTo(46, 9.6);
  body.lineTo(8, 9.4);
  body.lineTo(3, 10.4);
  body.lineTo(3, 12.8);
  body.lineTo(8, 13.8);
  body.lineTo(46, 13.6);
  body.close();
  c.drawPath(body.build(), shaderPaint(linear(0, 9.4, 0, 13.8, [pal.bodyTop, pal.bodyMid, pal.bodyLow], [0, 0.5, 1])));

  c.drawPath(poly([[40, 12.6], [26, 21.5], [19, 21.5], [25, 12.6]]), shaderPaint(linear(0, 12.6, 0, 21.5, pal.wingNear)));
  c.drawLine(40, 12.6, 26, 21.5, strokePaint('rgba(255,255,255,0.4)', 0.8));
  c.drawPath(poly([[34, 9.6], [37, 7], [43, 7.2], [46, 9.6]]), shaderPaint(linear(0, 7, 0, 9.6, pal.canopy)));
  c.drawLine(10, 9.8, 44, 9.8, strokePaint('rgba(255,255,255,0.4)', 0.7));
  c.drawCircle(52, 11.4, 1.5, fillPaint(pal.accent));
  c.drawCircle(52, 11.4, 0.6, fillPaint('#ffffff'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(1.6, 10.2, 2.6, 3), 0.8, 0.8), fillPaint('#1d2228'));
};

// Flying fortress: armoured slab hull, twin cannons and a pulsing reactor dome
const drawTitan = (c: SkCanvas, pal: JetPalette) => {
  c.drawPath(poly([[48, 8], [38, 0.8], [22, 0.8], [26, 8]]), shaderPaint(linear(0, 0.8, 0, 8, [pal.wingNear[0], pal.wingFar])));
  c.drawPath(poly([[48, 32], [38, 39.2], [22, 39.2], [26, 32]]), shaderPaint(linear(0, 32, 0, 39.2, [pal.wingNear[0], pal.wingFar])));

  const hull = Skia.PathBuilder.Make();
  hull.moveTo(72, 20);
  hull.lineTo(62, 10);
  hull.lineTo(40, 6);
  hull.lineTo(12, 8);
  hull.lineTo(2, 14);
  hull.lineTo(2, 26);
  hull.lineTo(12, 32);
  hull.lineTo(40, 34);
  hull.lineTo(62, 30);
  hull.close();
  c.drawPath(hull.build(), shaderPaint(linear(0, 6, 0, 34, [pal.bodyTop, pal.bodyMid, pal.bodyLow], [0, 0.5, 1])));

  const lines = strokePaint('rgba(0,0,0,0.3)', 0.8);
  [14, 24, 34, 54].forEach(x => c.drawLine(x, 7, x, 33, lines));
  c.drawRect(Skia.XYWHRect(10, 19.2, 24, 1.8), fillPaint(pal.accent));
  c.drawLine(8, 9, 60, 11, strokePaint('rgba(255,255,255,0.35)', 0.9));

  // Cannons
  [14, 25].forEach(y => {
    c.drawRect(Skia.XYWHRect(56, y, 14, 2.6), fillPaint('#14100f'));
    c.drawRect(Skia.XYWHRect(68, y - 0.4, 3, 3.4), fillPaint(pal.accent));
  });

  // Reactor dome
  c.drawCircle(44, 20, 8, fillPaint('#1b1111'));
  c.drawCircle(44, 20, 6.2, shaderPaint(radial(44, 20, 6.2, ['#ffffff', '#ff8a5e', pal.accent, '#5a0f08'], [0, 0.25, 0.65, 1])));

  [12, 18, 24].forEach(y => c.drawRect(Skia.XYWHRect(0.8, y, 3, 4), fillPaint('#1d2228')));
};

export interface Frame { width: number; height: number }
type Glows = Array<[x: number, y: number, size: number]>;

// Where each enemy's sprite is authored and where its engines glow (frame coordinates)
export const ENEMY_FRAMES: Record<EnemyType, Frame> = {
  [EnemyType.STANDARD]: JET_FRAME,
  [EnemyType.ROAMER]: GUNSHIP_FRAME,
  [EnemyType.WAVER]: JET_FRAME,
  [EnemyType.RUSHER]: DELTA_FRAME,
  [EnemyType.SNIPER]: SNIPER_FRAME,
  [EnemyType.BOMBER]: BOMBER_FRAME,
};

export const ENEMY_GLOWS: Record<EnemyType, Glows> = {
  [EnemyType.STANDARD]: [[2, 13.5, 22]],
  [EnemyType.ROAMER]: [[22, 29, 18], [5, 18, 20]],
  [EnemyType.WAVER]: [[2, 13.5, 22]],
  [EnemyType.RUSHER]: [[2, 10, 20]],
  [EnemyType.SNIPER]: [[2, 11.6, 18]],
  [EnemyType.BOMBER]: [[3, 19.5, 22], [28, 32, 18]],
};

export const BOSS_FRAMES: Frame[] = [GUNSHIP_FRAME, BOMBER_FRAME, DELTA_FRAME, TITAN_FRAME];

export const BOSS_GLOWS: Glows[] = [
  [[5, 18, 26], [22, 29, 22], [4, 22, 20]],
  [[3, 19.5, 28], [28, 32, 22]],
  [[2, 10, 26]],
  [[2, 14, 22], [2, 20, 26], [2, 26, 22]],
];

const drawHomingMissile = (c: SkCanvas) => {
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

// Fat, slow, orange shell with a dark armoured nose
const drawBlastMissile = (c: SkCanvas) => {
  c.drawPath(poly([[8, 1.5], [3, 0], [0, 0], [4.5, 4.2]]), fillPaint('#3a2a22'));
  c.drawPath(poly([[8, 9.5], [3, 11], [0, 11], [4.5, 6.8]]), fillPaint('#2a1d17'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(5, 0.8, 21, 9.4), 4.2, 4.2),
    shaderPaint(linear(0, 0.8, 0, 10.2, ['#ffd896', '#ff8f2d', '#9c3d0a'], [0, 0.45, 1])));
  c.drawRect(Skia.XYWHRect(13, 0.8, 2.4, 9.4), fillPaint('#2b1d14'));
  c.drawRect(Skia.XYWHRect(18.5, 0.8, 1.2, 9.4), fillPaint('#2b1d14'));
  c.drawPath(poly([[25, 1.2], [30, 5.5], [25, 9.8]]), shaderPaint(linear(0, 1.2, 0, 9.8, ['#5a4a42', '#1d1511'])));
  c.drawLine(7, 2, 24, 2, strokePaint('rgba(255,255,255,0.55)', 0.9));
};

// Slender energy lance that glows cyan-white
const drawLanceMissile = (c: SkCanvas) => {
  const glow = Skia.Paint();
  glow.setColor(Skia.Color('#43d9ff'));
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 2.5, true));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(3, 0.8, 34, 4.4), 2.2, 2.2), glow);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(0, 1.6, 36, 2.8), 1.4, 1.4),
    shaderPaint(linear(0, 0, 36, 0, ['rgba(95,227,255,0)', '#8eeeff', '#ffffff'], [0, 0.5, 1])));
  c.drawPath(poly([[32, 0.6], [40, 3], [32, 5.4]]), fillPaint('#ffffff'));
};

const MISSILE_DRAW: Record<MissileType, (c: SkCanvas) => void> = {
  homing: drawHomingMissile,
  blast: drawBlastMissile,
  lance: drawLanceMissile,
};

export const MEDIC_FRAME = { width: 28, height: 28 };
export const ROCKET_FRAME = { width: 18, height: 8 };
export const SEEKER_FRAME = { width: 18, height: 12 };

// Floating repair crate: white case, red cross
const drawMedic = (c: SkCanvas) => {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(1.5, 1.5, 25, 25), 6, 6),
    shaderPaint(linear(0, 1.5, 0, 26.5, ['#ffffff', '#d4e6dc', '#8db5a0'])));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(1.5, 1.5, 25, 25), 6, 6), strokePaint('#2f8f5b', 1.6));
  c.drawRect(Skia.XYWHRect(11, 5.5, 6, 17), fillPaint('#e5333d'));
  c.drawRect(Skia.XYWHRect(5.5, 11, 17, 6), fillPaint('#e5333d'));
  c.drawLine(11, 6, 17, 6, strokePaint('rgba(255,255,255,0.55)', 0.8));
  c.drawLine(5, 3.6, 23, 3.6, strokePaint('rgba(255,255,255,0.7)', 1));
};

// Unguided warhead: grey body, orange band, red nose, flame at the tail
const drawRocket = (c: SkCanvas) => {
  c.drawPath(poly([[0, 4], [5, 1.4], [5, 6.6]]), fillPaint('#ffb43a'));
  c.drawPath(poly([[3, 0], [7, 2.2], [3.6, 3.2]]), fillPaint('#3a424b'));
  c.drawPath(poly([[3, 8], [7, 5.8], [3.6, 4.8]]), fillPaint('#2b3239'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(4, 1.4, 10, 5.2), 2, 2),
    shaderPaint(linear(0, 1.4, 0, 6.6, ['#e6ecf0', '#9aa6b1', '#56626d'], [0, 0.5, 1])));
  c.drawRect(Skia.XYWHRect(8, 1.4, 1.6, 5.2), fillPaint('#f08a24'));
  c.drawPath(poly([[13, 1.4], [18, 4], [13, 6.6]]), shaderPaint(linear(0, 1.4, 0, 6.6, ['#ff6a55', '#8e1710'])));
};

// Seeker drone: cyan hull, glowing red eye
const drawSeeker = (c: SkCanvas) => {
  c.drawPath(poly([[7, 3], [2, 0], [0, 0], [3.4, 4.6]]), fillPaint('#22405a'));
  c.drawPath(poly([[7, 9], [2, 12], [0, 12], [3.4, 7.4]]), fillPaint('#1a3248'));
  c.drawOval(Skia.XYWHRect(2, 2, 15, 8), shaderPaint(linear(0, 2, 0, 10, ['#bdeeff', '#3aa6d6', '#14405c'], [0, 0.5, 1])));
  c.drawRect(Skia.XYWHRect(8, 2.4, 1.4, 7.2), fillPaint('#0f2c42'));
  c.drawCircle(13.4, 6, 2.2, fillPaint('#ff3b3b'));
  c.drawCircle(13.4, 6, 0.9, fillPaint('#ffffff'));
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
  heroes: SkPicture[]; // index = cannon level - 1
  enemies: Record<EnemyType, SkPicture>;
  bosses: SkPicture[];
  missiles: Record<MissileType, SkPicture>;
  medic: SkPicture;
  rocket: SkPicture;
  seeker: SkPicture;
  bolt: SkImage;
  orb: SkImage;
  healGlow: SkImage;
  bullet: SkImage;
  enemyBullet: SkImage;
  flash: SkImage;
  engineGlow: SkImage;
  engineGlowCyan: SkImage;
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

  // Pulse-laser streak, authored pointing right like the other projectiles
  const bolt = bake(40, 14, c => {
    const glow = Skia.Paint();
    glow.setColor(Skia.Color('#3ad8ff'));
    glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3, true));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(4, 4, 32, 6), 3, 3), glow);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(4, 5.4, 32, 3.2), 1.6, 1.6),
      shaderPaint(linear(4, 0, 36, 0, ['rgba(120,230,255,0)', '#9cf0ff', '#ffffff'], [0, 0.6, 1])));
  });
  const orb = glowImage(48, ['#ffffff', '#ffd0b0', 'rgba(255,80,50,0.95)', 'rgba(200,20,30,0)'], [0, 0.2, 0.55, 1]);
  const healGlow = glowImage(64, ['rgba(220,255,230,0.95)', 'rgba(90,255,160,0.5)', 'rgba(40,220,120,0)'], [0, 0.4, 1]);

  const enemyBullet = glowImage(28, ['#ffffff', '#ffd9a0', 'rgba(255,90,40,0.9)', 'rgba(255,40,20,0)'], [0, 0.2, 0.5, 1]);
  const flash = glowImage(64, ['#ffffff', 'rgba(255,238,170,0.9)', 'rgba(255,170,60,0.35)', 'rgba(255,120,30,0)'], [0, 0.25, 0.6, 1]);
  const engineGlow = glowImage(48, ['rgba(255,255,255,0.95)', 'rgba(130,200,255,0.7)', 'rgba(255,150,50,0.35)', 'rgba(255,100,20,0)'], [0, 0.18, 0.5, 1]);
  const engineGlowCyan = glowImage(48, ['rgba(255,255,255,0.95)', 'rgba(110,230,255,0.75)', 'rgba(60,170,255,0.35)', 'rgba(40,120,255,0)'], [0, 0.18, 0.5, 1]);
  const fire = FIRE_RAMP.map(col => glowImage(32, [hexAlpha(col, 1), hexAlpha(col, 0.92), hexAlpha(col, 0)], [0, 0.55, 1]));
  const smoke = SMOKE_RAMP.map(col => glowImage(32, [hexAlpha(col, 0.7), hexAlpha(col, 0.4), hexAlpha(col, 0)], [0, 0.5, 1]));

  cache = {
    heroes: Array.from({ length: HERO_TIERS }, (_, i) => record(JET_FRAME.width, JET_FRAME.height, c => drawHero(c, i + 1))),
    enemies: {
      [EnemyType.STANDARD]: record(JET_FRAME.width, JET_FRAME.height, c => drawJet(c, ENEMY_PALETTE)),
      [EnemyType.ROAMER]: record(GUNSHIP_FRAME.width, GUNSHIP_FRAME.height, c => drawGunship(c, GUNSHIP_PALETTE)),
      [EnemyType.WAVER]: record(JET_FRAME.width, JET_FRAME.height, c => drawJet(c, WAVER_PALETTE)),
      [EnemyType.RUSHER]: record(DELTA_FRAME.width, DELTA_FRAME.height, c => drawDelta(c, RUSHER_PALETTE, false)),
      [EnemyType.SNIPER]: record(SNIPER_FRAME.width, SNIPER_FRAME.height, c => drawSniper(c, SNIPER_PALETTE)),
      [EnemyType.BOMBER]: record(BOMBER_FRAME.width, BOMBER_FRAME.height, c => drawBomber(c, BOMBER_PALETTE, false)),
    },
    bosses: [
      record(GUNSHIP_FRAME.width, GUNSHIP_FRAME.height, c => drawGunship(c, BOSS_PALETTE)),
      record(BOMBER_FRAME.width, BOMBER_FRAME.height, c => drawBomber(c, CARRIER_PALETTE, true)),
      record(DELTA_FRAME.width, DELTA_FRAME.height, c => drawDelta(c, PHANTOM_PALETTE, true)),
      record(TITAN_FRAME.width, TITAN_FRAME.height, c => drawTitan(c, TITAN_PALETTE)),
    ],
    missiles: {
      homing: record(MISSILES.homing.size.width, MISSILES.homing.size.height, MISSILE_DRAW.homing),
      blast: record(MISSILES.blast.size.width, MISSILES.blast.size.height, MISSILE_DRAW.blast),
      lance: record(MISSILES.lance.size.width, MISSILES.lance.size.height, MISSILE_DRAW.lance),
    },
    medic: record(MEDIC_FRAME.width, MEDIC_FRAME.height, drawMedic),
    rocket: record(ROCKET_FRAME.width, ROCKET_FRAME.height, drawRocket),
    seeker: record(SEEKER_FRAME.width, SEEKER_FRAME.height, drawSeeker),
    bolt, orb, healGlow,
    bullet, enemyBullet, flash, engineGlow, engineGlowCyan, fire, smoke,
  };
  return cache;
};
