import { Skia, BlendMode, StrokeCap, type SkCanvas, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { PLANE_SIZE, SCREEN_WIDTH, SCREEN_HEIGHT } from '../engine/Constants';
import { EnemyType } from '../engine/Enemies';
import type { Boss, Enemy, EnemyBullet, GameState, Particle, Pickup } from '../engine/GameLoop';
import { GROUND_Y, drawBackdrop, drawVignette } from './Backdrop';
import { createPictureUnbounded, fillPaint, strokePaint } from './gfx';
import {
  BOSS_FRAMES, BOSS_GLOWS, ENEMY_FRAMES, ENEMY_GLOWS, JET_FRAME, MEDIC_FRAME, ROCKET_FRAME, SEEKER_FRAME,
  getSprites, type Sprites,
} from './Sprites';

const normalPaint = Skia.Paint();
const additivePaint = Skia.Paint();
additivePaint.setBlendMode(BlendMode.Plus);
const shadowPaint = fillPaint('#000000');
const ringPaint = strokePaint('#fff1c4', 2);
const lockPaint = strokePaint('#ff3b2a', 1.5);
const hurtPaint = fillPaint('#ff2a2a');
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

const drawPickup = (c: SkCanvas, S: Sprites, p: Pickup, frameCount: number) => {
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12 + p.age * 0.02);
  blit(c, S.healGlow, cx, cy, 58 + 14 * pulse, additivePaint, 0.55 + 0.35 * pulse);
  c.save();
  c.translate(cx, cy);
  c.rotate(Math.sin(p.age * 0.05) * 6, 0, 0);
  c.translate(-MEDIC_FRAME.width / 2, -MEDIC_FRAME.height / 2);
  c.drawPicture(S.medic);
  c.restore();
};

// Projectiles are authored pointing right and rotated to their heading
const drawEnemyBullet = (c: SkCanvas, S: Sprites, b: EnemyBullet, frameCount: number) => {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  if (b.kind === 'bullet') {
    blit(c, S.enemyBullet, cx, cy, 24, normalPaint, 1);
    return;
  }
  if (b.kind === 'orb') {
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.3 + b.age * 0.1);
    blit(c, S.orb, cx, cy, 34 + 6 * pulse, normalPaint, 1);
    blit(c, S.flash, cx, cy, 16, additivePaint, 0.6);
    return;
  }

  const angle = (Math.atan2(b.vy, b.vx) * 180) / Math.PI;
  c.save();
  c.translate(cx, cy);
  c.rotate(angle, 0, 0);
  const flicker = 0.8 + 0.2 * Math.sin(frameCount * 2.1);
  if (b.kind === 'bolt') {
    normalPaint.setAlphaf(1);
    c.drawImage(S.bolt, -20, -7, normalPaint);
  } else if (b.kind === 'rocket') {
    blit(c, S.engineGlow, -ROCKET_FRAME.width / 2 - 2, 0, 18 * flicker, additivePaint, 0.95);
    c.translate(-ROCKET_FRAME.width / 2, -ROCKET_FRAME.height / 2);
    c.drawPicture(S.rocket);
  } else {
    blit(c, S.engineGlowCyan, -SEEKER_FRAME.width / 2, 0, 20 * flicker, additivePaint, 0.9);
    c.translate(-SEEKER_FRAME.width / 2, -SEEKER_FRAME.height / 2);
    c.drawPicture(S.seeker);
  }
  c.restore();
};

// Where each boss's pulsing core sits, as a fraction of its (mirrored) box
const BOSS_CORE: Array<[x: number, y: number]> = [[0.66, 0.2], [0.5, 0.28], [0.45, 0.5], [0.39, 0.5]];

const drawEnemy = (c: SkCanvas, S: Sprites, e: Enemy, frameCount: number) => {
  drawShadow(c, e.x, e.y, e.width, e.height);
  const dashing = e.type === EnemyType.RUSHER && e.mode === 2;
  const glows = ENEMY_GLOWS[e.type].map(([gx, gy, size]) => [gx, gy, dashing ? size * 1.6 : size] as [number, number, number]);
  const tilt = e.type === EnemyType.STANDARD || e.type === EnemyType.BOMBER ? 0 : e.vy * 2.2;
  drawAircraft(c, {
    pic: S.enemies[e.type], frame: ENEMY_FRAMES[e.type], x: e.x, y: e.y, w: e.width, h: e.height,
    flip: true, tilt, hit: e.hitFlash > 0, glows, frameCount, S,
  });

  const noseY = e.y + e.height / 2;
  if (e.type === EnemyType.RUSHER && e.mode === 1) {
    // Lock-on: a thin line down the dash path plus a pulsing nose light
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.9);
    lockPaint.setAlphaf(0.25 + 0.35 * pulse);
    c.drawLine(e.x, noseY, 0, noseY, lockPaint);
    blit(c, S.flash, e.x + 2, noseY, 22 + 8 * pulse, additivePaint, 0.8);
  }
  if (e.type === EnemyType.SNIPER && e.charge > 0) {
    blit(c, S.flash, e.x + 2, noseY, 10 + 26 * e.charge, additivePaint, 0.4 + 0.6 * e.charge);
  }
};

const drawBoss = (c: SkCanvas, S: Sprites, b: Boss, frameCount: number) => {
  drawShadow(c, b.x, b.y, b.width, b.height);
  drawAircraft(c, {
    pic: S.bosses[b.kind], frame: BOSS_FRAMES[b.kind], x: b.x, y: b.y, w: b.width, h: b.height,
    flip: true, tilt: b.dying > 0 ? 6 : b.vy * 1.5, hit: b.hitFlash > 0,
    glows: BOSS_GLOWS[b.kind], frameCount, S,
  });
  if (b.dying === 0) {
    // Pulsing red core + warning light, hotter in phase 2
    const pulse = 0.55 + 0.45 * Math.sin(frameCount * (b.phase === 2 ? 0.45 : 0.2));
    const [cx, cy] = BOSS_CORE[b.kind];
    blit(c, S.flash, b.x + b.width * cx, b.y + b.height * cy, 26, additivePaint, 0.35 + 0.5 * pulse);
    if (b.phase === 2 && frameCount % 6 < 3) {
      blit(c, S.fire[3], b.x + b.width * 0.36, b.y + b.height * 0.5, 18, normalPaint, 0.9);
    }
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

    const playerAlive = plane.alive;
    const blinkHidden = plane.invulnerable > 0 && Math.floor(plane.invulnerable / 5) % 2 === 0;
    if (playerAlive) drawShadow(c, plane.x, plane.y, plane.width, plane.height);

    state.pickups.forEach(p => drawPickup(c, S, p, f));
    state.enemies.forEach(e => drawEnemy(c, S, e, f));
    if (state.boss) drawBoss(c, S, state.boss, f);

    // Smoke sits behind the aircraft, fire and sparks in front
    state.particles.forEach(p => { if (p.kind === 'smoke') drawSmoke(c, S, p); });

    state.missiles.forEach(m => {
      const angle = (Math.atan2(m.vy, m.vx) * 180) / Math.PI;
      const glow = m.type === 'lance' ? S.engineGlowCyan : S.engineGlow;
      c.save();
      c.translate(m.x + m.width / 2, m.y + m.height / 2);
      c.rotate(angle, 0, 0);
      c.translate(-m.width / 2, -m.height / 2);
      blit(c, glow, 0, m.height / 2, (m.type === 'blast' ? 26 : 20) * (0.8 + 0.2 * Math.sin(f * 2.3)), additivePaint, 0.95);
      c.drawPicture(S.missiles[m.type]);
      c.restore();
    });

    if (playerAlive && !blinkHidden) {
      drawAircraft(c, {
        pic: S.player, frame: JET_FRAME, x: plane.x, y: plane.y, w: PLANE_SIZE.width, h: PLANE_SIZE.height,
        flip: false, tilt: plane.tilt, hit: false, glows: [[2, 13.5, 24]], frameCount: f, S, muzzle: plane.muzzle > 0,
      });
    }

    state.bullets.forEach(b => {
      normalPaint.setAlphaf(1);
      if (b.vy === 0) {
        c.drawImage(S.bullet, b.x + b.width - 25, b.y + b.height / 2 - 7, normalPaint);
      } else {
        c.save();
        c.rotate((Math.atan2(b.vy, b.vx) * 180) / Math.PI, b.x + b.width, b.y + b.height / 2);
        c.drawImage(S.bullet, b.x + b.width - 25, b.y + b.height / 2 - 7, normalPaint);
        c.restore();
      }
    });
    state.enemyBullets.forEach(b => drawEnemyBullet(c, S, b, f));

    if (playerAlive && state.heal > 0) {
      const t = state.heal / 40;
      blit(c, S.healGlow, plane.x + plane.width / 2, plane.y + plane.height / 2, 70 + 60 * (1 - t), additivePaint, t);
    }

    state.particles.forEach(p => { if (p.kind !== 'smoke') drawParticle(c, S, p); });

    c.restore();
    drawVignette(c);
    if (state.hurt > 0) {
      hurtPaint.setAlphaf((state.hurt / 18) * 0.3);
      c.drawRect({ x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }, hurtPaint);
    }
  });

// Backdrop with the player's jet cruising, used behind the menu screens
export const renderMenuFrame = (frame: number): SkPicture =>
  createPictureUnbounded(c => {
    const S = getSprites();
    drawBackdrop(c, frame);
    const x = SCREEN_WIDTH * 0.16;
    const y = SCREEN_HEIGHT * 0.5 + Math.sin(frame * 0.035) * 14;
    drawShadow(c, x, y, PLANE_SIZE.width, PLANE_SIZE.height);
    drawAircraft(c, {
      pic: S.player, frame: JET_FRAME, x, y, w: PLANE_SIZE.width, h: PLANE_SIZE.height,
      flip: false, tilt: Math.cos(frame * 0.035) * 6, hit: false, glows: [[2, 13.5, 24]], frameCount: frame, S,
    });
    drawVignette(c);
  });
