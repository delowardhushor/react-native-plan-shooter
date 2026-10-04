import { Skia, BlendMode, StrokeCap, type SkCanvas, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { PLANE_SIZE, ENEMY_SIZE, ROAMER_SIZE } from '../engine/Constants';
import { EnemyType, type Enemy, type GameState, type Particle } from '../engine/GameLoop';
import { GROUND_Y, drawBackdrop, drawVignette } from './Backdrop';
import { createPictureUnbounded, fillPaint, strokePaint } from './gfx';
import { GUNSHIP_FRAME, JET_FRAME, getSprites, type Sprites } from './Sprites';

const normalPaint = Skia.Paint();
const additivePaint = Skia.Paint();
additivePaint.setBlendMode(BlendMode.Plus);
const shadowPaint = fillPaint('#000000');
const ringPaint = strokePaint('#fff1c4', 2);
const sparkPaint = strokePaint('#ffd98a', 1.5);
sparkPaint.setStrokeCap(StrokeCap.Round);
sparkPaint.setBlendMode(BlendMode.Plus);

// Briefly washes a sprite white when it takes a hit
const hitPaint = Skia.Paint();
hitPaint.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color('rgba(255,255,255,0.75)'), BlendMode.SrcATop));

const blit = (c: SkCanvas, img: SkImage, cx: number, cy: number, size: number, paint: typeof normalPaint, alpha: number) => {
  paint.setAlphaf(alpha);
  c.drawImageRect(
    img,
    { x: 0, y: 0, width: img.width(), height: img.height() },
    { x: cx - size / 2, y: cy - size / 2, width: size, height: size },
    paint,
  );
};

// Soft contact shadow that shrinks and fades as the aircraft climbs, anchoring it above the ground
const drawShadow = (c: SkCanvas, x: number, y: number, w: number, h: number) => {
  const alt = Math.max(0, GROUND_Y - (y + h));
  const t = Math.min(1, alt / GROUND_Y);
  const sw = w * (0.95 - 0.5 * t);
  const sh = 6 * (1 - 0.5 * t) + 2;
  shadowPaint.setAlphaf(0.36 * (1 - t * 0.85));
  c.drawOval({ x: x + w / 2 - sw / 2 - alt * 0.1, y: GROUND_Y + 30 - t * 14 - sh / 2, width: sw, height: sh }, shadowPaint);
};

interface AircraftOpts {
  pic: SkPicture;
  frame: { width: number; height: number };
  x: number; y: number; w: number; h: number;
  flip: boolean;
  tilt: number;
  hit: boolean;
  glows: Array<[x: number, y: number, size: number]>; // frame coordinates
  frameCount: number;
  S: Sprites;
  muzzle?: boolean;
}

const drawAircraft = (c: SkCanvas, o: AircraftOpts) => {
  const sx = o.w / o.frame.width;
  const sy = o.h / o.frame.height;
  c.save();
  c.translate(o.x + o.w / 2, o.y + o.h / 2);
  c.rotate(o.flip ? -o.tilt : o.tilt, 0, 0);
  c.scale(o.flip ? -sx : sx, sy);
  c.translate(-o.frame.width / 2, -o.frame.height / 2);

  // Engine glow flickers a little so it feels alive
  const flicker = 0.82 + 0.18 * Math.sin(o.frameCount * 1.9);
  o.glows.forEach(([gx, gy, size]) => blit(c, o.S.engineGlow, gx, gy, size * flicker, additivePaint, 0.95));

  if (o.hit) c.saveLayer(hitPaint);
  c.drawPicture(o.pic);
  if (o.hit) c.restore();

  if (o.muzzle) blit(c, o.S.flash, o.frame.width + 3, o.frame.height / 2 + 1, 18, additivePaint, 1);
  c.restore();
};

const drawEnemy = (c: SkCanvas, S: Sprites, e: Enemy, frameCount: number) => {
  drawShadow(c, e.x, e.y, e.width, e.height);
  if (e.type === EnemyType.ROAMER) {
    drawAircraft(c, {
      pic: S.roamer, frame: GUNSHIP_FRAME, x: e.x, y: e.y, w: ROAMER_SIZE.width, h: ROAMER_SIZE.height,
      flip: true, tilt: e.vy * 2.2, hit: e.hitFlash > 0, glows: [[22, 29, 18], [5, 18, 20]], frameCount, S,
    });
  } else {
    drawAircraft(c, {
      pic: S.enemy, frame: JET_FRAME, x: e.x, y: e.y, w: ENEMY_SIZE.width, h: ENEMY_SIZE.height,
      flip: true, tilt: 0, hit: e.hitFlash > 0, glows: [[2, 13.5, 22]], frameCount, S,
    });
  }
};

const drawParticle = (c: SkCanvas, S: Sprites, p: Particle) => {
  const t = 1 - p.life / p.maxLife;
  switch (p.kind) {
    case 'fire': {
      const idx = Math.min(S.fire.length - 1, Math.floor(t * S.fire.length));
      // Only the white-hot core glows additively; cooler stages are opaque so they read against a bright sky
      blit(c, S.fire[idx], p.x, p.y, p.size * 2.6 * (1 - 0.35 * t), idx < 2 ? additivePaint : normalPaint, 1 - t * 0.45);
      break;
    }
    case 'flash':
      blit(c, S.flash, p.x, p.y, p.size * 2 * (0.5 + t * 1.1), additivePaint, 1 - t);
      break;
    case 'ring':
      ringPaint.setAlphaf((1 - t) * 0.5);
      ringPaint.setStrokeWidth((1 - t) * 2 + 0.5);
      c.drawCircle(p.x, p.y, p.size * (0.25 + 0.75 * t), ringPaint);
      break;
    case 'spark':
      sparkPaint.setAlphaf(1 - t);
      sparkPaint.setStrokeWidth(p.size);
      c.drawLine(p.x, p.y, p.x - p.vx * 1.8, p.y - p.vy * 1.8, sparkPaint);
      break;
  }
};

const drawSmoke = (c: SkCanvas, S: Sprites, p: Particle) => {
  const t = 1 - p.life / p.maxLife;
  const idx = Math.min(S.smoke.length - 1, Math.floor(t * S.smoke.length));
  blit(c, S.smoke[idx], p.x, p.y, p.size * 2 * (1 + t * 1.3), normalPaint, (1 - t) * 0.85);
};

// Draws the whole scene into a fresh picture for Skia to present
export const renderFrame = (state: GameState): SkPicture =>
  createPictureUnbounded(c => {
    const S = getSprites();
    const f = state.frameCount;
    const { plane } = state;

    c.save();
    if (state.shake > 0) {
      c.translate((Math.random() - 0.5) * state.shake * 2, (Math.random() - 0.5) * state.shake * 2);
    }

    drawBackdrop(c, f);

    const playerAlive = plane.y > -500;
    if (playerAlive) drawShadow(c, plane.x, plane.y, plane.width, plane.height);

    state.enemies.forEach(e => drawEnemy(c, S, e, f));

    // Smoke sits behind the aircraft, fire and sparks in front
    state.particles.forEach(p => { if (p.kind === 'smoke') drawSmoke(c, S, p); });

    state.missiles.forEach(m => {
      const angle = (Math.atan2(m.vy, m.vx) * 180) / Math.PI;
      c.save();
      c.translate(m.x + m.width / 2, m.y + m.height / 2);
      c.rotate(angle, 0, 0);
      c.translate(-m.width / 2, -m.height / 2);
      blit(c, S.engineGlow, 0, m.height / 2, 20 * (0.8 + 0.2 * Math.sin(f * 2.3)), additivePaint, 0.95);
      c.drawPicture(S.missile);
      c.restore();
    });

    if (playerAlive) {
      drawAircraft(c, {
        pic: S.player, frame: JET_FRAME, x: plane.x, y: plane.y, w: PLANE_SIZE.width, h: PLANE_SIZE.height,
        flip: false, tilt: plane.tilt, hit: false, glows: [[2, 13.5, 24]], frameCount: f, S, muzzle: plane.muzzle > 0,
      });
    }

    state.bullets.forEach(b => {
      normalPaint.setAlphaf(1);
      c.drawImage(S.bullet, b.x + b.width - 25, b.y + b.height / 2 - 7, normalPaint);
    });
    state.enemyBullets.forEach(b => blit(c, S.enemyBullet, b.x + b.width / 2, b.y + b.height / 2, 24, normalPaint, 1));

    state.particles.forEach(p => { if (p.kind !== 'smoke') drawParticle(c, S, p); });

    c.restore();
    drawVignette(c);
  });
