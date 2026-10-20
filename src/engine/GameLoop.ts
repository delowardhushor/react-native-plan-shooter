import {
  SCREEN_WIDTH, SCREEN_HEIGHT, PLANE_SIZE, BULLET_SIZE, BULLET_SPEED, GROUND_HEIGHT,
  ENEMY_BULLET_SIZE, ROAMER_SPEED_X, ROAMER_SPEED_Y, PARTICLE_LIFETIME, PARTICLE_SPEED,
  PLAYER_SPEED, PLANE_MAX_TILT, MAX_PARTICLES, PLAYER_LIVES, RESPAWN_FRAMES, INVULNERABLE_FRAMES,
} from './Constants';
import { getLevelConfig, type LevelConfig } from './Levels';
import { cannonStats, missileStats, type MissileType } from './Weapons';
import { BOSS_DEFS, ENEMY_DEFS, EnemyType, bossKindFor } from './Enemies';

export { EnemyType };

export interface Position {
  x: number;
  y: number;
}

export interface Box extends Position {
  width: number;
  height: number;
}

export interface Plane extends Box {
  vx: number;
  vy: number;
  tilt: number;         // degrees, smoothed from vy for a banking effect
  muzzle: number;       // frames of muzzle flash remaining
  alive: boolean;
  invulnerable: number; // frames of post-respawn protection remaining
}

export interface Enemy extends Box {
  type: EnemyType;
  hp: number;
  maxHp: number;
  vy: number;
  lastFiredFrame: number;
  targetX: number;
  hitFlash: number; // frames of white hit-flash remaining
  age: number;      // frames since spawning
  baseY: number;    // centre line of a weaving flight path
  mode: number;     // per-type behaviour state (rusher: 0 track, 1 lock on, 2 dash)
  timer: number;
  charge: number;   // 0..1 wind-up before a shot, drawn as a warning glow
}

export interface Boss extends Box {
  kind: number;     // index into BOSS_DEFS, picks hull, movement and attack pattern
  hp: number;
  maxHp: number;
  vy: number;
  targetX: number;
  entered: boolean;
  phase: 1 | 2;
  lastFiredFrame: number;
  volley: number;
  burst: number;    // shots left in the current rapid-fire burst
  hitFlash: number;
  dying: number; // 0 while alive, then counts frames since defeat
}

export type ParticleKind = 'fire' | 'smoke' | 'spark' | 'flash' | 'ring';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export interface Bullet extends Box {
  vx: number;
  vy: number;
  damage: number;
}

export interface EnemyBullet extends Box {
  vx: number;
  vy: number;
}

export interface Missile extends Box {
  type: MissileType;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  speed: number;
  hits: object[]; // piercing missiles remember what they've already damaged
}

export interface Loadout {
  cannon: number;
  missile: MissileType;
  missileLevel: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  plane: Plane;
  bullets: Bullet[];
  missiles: Missile[];
  enemyBullets: EnemyBullet[];
  enemies: Enemy[];
  boss: Boss | null;
  particles: Particle[];
  config: LevelConfig;
  loadout: Loadout;
  frameCount: number;
  lastFiredFrame: number;
  lastMissileFrame: number;
  missileRequested: boolean;
  spawnTimer: number;
  bossState: 0 | 1 | 2; // 0 = not yet, 1 = warning, 2 = boss fight
  bossTimer: number;
  respawnTimer: number;
  banner: { title: string; sub: string } | null;
  bannerTimer: number;
  score: number;
  kills: number;
  lives: number;
  level: number;
  shake: number; // screen-shake intensity, decays every frame
  status: GameStatus;
  endTimer: number; // frames since the run ended
}

export type SoundFn = (type: 'shoot' | 'hit' | 'destroy') => void;

const GROUND_Y = SCREEN_HEIGHT - GROUND_HEIGHT;

export const createInitialState = (level: number, loadout: Loadout): GameState => {
  const config = getLevelConfig(level);
  return {
    plane: {
      x: 20,
      y: SCREEN_HEIGHT / 2 - PLANE_SIZE.height / 2,
      width: PLANE_SIZE.width,
      height: PLANE_SIZE.height,
      vx: 0,
      vy: 0,
      tilt: 0,
      muzzle: 0,
      alive: true,
      invulnerable: 90,
    },
    bullets: [],
    missiles: [],
    enemyBullets: [],
    enemies: [],
    boss: null,
    particles: [],
    config,
    loadout,
    frameCount: 0,
    lastFiredFrame: 0,
    lastMissileFrame: -9999,
    missileRequested: false,
    spawnTimer: 100,
    bossState: 0,
    bossTimer: 0,
    respawnTimer: 0,
    banner: {
      title: `LEVEL ${level}`,
      sub: config.isBoss ? 'BOSS BATTLE AHEAD' : `DESTROY ${config.killTarget} ENEMY PLANES`,
    },
    bannerTimer: 150,
    score: 0,
    kills: 0,
    lives: PLAYER_LIVES,
    level,
    shake: 0,
    status: 'playing',
    endTimer: 0,
  };
};

// 0..1, how recharged the equipped missile is
export const missileCharge = (state: GameState) => {
  const { cooldown } = missileStats(state.loadout.missile, state.loadout.missileLevel);
  return Math.min(1, (state.frameCount - state.lastMissileFrame) / cooldown);
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const emit = (
  gameState: GameState,
  kind: ParticleKind,
  x: number, y: number, vx: number, vy: number,
  life: number, size: number
) => {
  if (gameState.particles.length >= MAX_PARTICLES) return;
  gameState.particles.push({ kind, x, y, vx, vy, life, maxLife: life, size });
};

// Layered explosion: flash + shockwave ring + fireball + sparks + rising smoke
export const spawnExplosion = (gameState: GameState, x: number, y: number, scale = 1) => {
  emit(gameState, 'flash', x, y, 0, 0, 8, 30 * scale);
  emit(gameState, 'ring', x, y, 0, 0, 16, 38 * scale);
  for (let i = 0; i < Math.round(9 * scale); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(0.4, PARTICLE_SPEED * 0.6) * scale;
    emit(gameState, 'fire', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(16, PARTICLE_LIFETIME), rand(6, 13) * scale);
  }
  for (let i = 0; i < Math.round(14 * scale); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(3, PARTICLE_SPEED * 1.6);
    emit(gameState, 'spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(10, 24), rand(1.2, 2.2));
  }
  for (let i = 0; i < Math.round(6 * scale); i++) {
    emit(gameState, 'smoke', x + rand(-6, 6), y + rand(-6, 6), rand(-1.2, 0.6), rand(-1.2, -0.2), rand(40, 70), rand(9, 16) * scale);
  }
};

const spawnHitSparks = (gameState: GameState, x: number, y: number) => {
  for (let i = 0; i < 3; i++) {
    const a = rand(-Math.PI * 0.8, Math.PI * 0.8) + Math.PI; // spray back toward the shooter
    const sp = rand(1.5, 4);
    emit(gameState, 'spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(6, 12), 1.4);
  }
};

const updateEffects = (gameState: GameState) => {
  gameState.particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    if (p.kind === 'fire' || p.kind === 'spark') {
      p.vx *= 0.94;
      p.vy *= 0.94;
    } else if (p.kind === 'smoke') {
      p.vx *= 0.98;
      p.vy = p.vy * 0.98 - 0.01; // smoke drifts upward
    }
  });
  gameState.particles = gameState.particles.filter(p => p.life > 0);
  gameState.shake *= 0.88;
  if (gameState.shake < 0.3) gameState.shake = 0;
};

const isRectCollision = (rect1: Box, rect2: Box) => (
  rect1.x < rect2.x + rect2.width &&
  rect1.x + rect1.width > rect2.x &&
  rect1.y < rect2.y + rect2.height &&
  rect1.height + rect1.y > rect2.y
);

// Wings and tail don't count: the player is only hurt by hits near the fuselage
const playerHitbox = (plane: Plane): Box => ({
  x: plane.x + 8, y: plane.y + 6, width: plane.width - 16, height: plane.height - 12,
});

type Target = Enemy | Boss;

const damageTarget = (t: Target, amount: number) => {
  t.hp -= amount;
  t.hitFlash = 4;
};

// Everything a shot can hit this frame
const forEachTarget = (s: GameState, cb: (t: Target) => void) => {
  s.enemies.forEach(e => { if (e.hp > 0) cb(e); });
  if (s.boss && s.boss.dying === 0 && s.boss.hp > 0) cb(s.boss);
};

const firstHit = (s: GameState, box: Box): Target | null => {
  for (const e of s.enemies) {
    if (e.hp > 0 && isRectCollision(e, box)) return e;
  }
  if (s.boss && s.boss.dying === 0 && s.boss.hp > 0 && isRectCollision(s.boss, box)) return s.boss;
  return null;
};

const setBanner = (s: GameState, title: string, sub: string, frames: number) => {
  s.banner = { title, sub };
  s.bannerTimer = frames;
};

const killPlayer = (s: GameState, onSound: SoundFn) => {
  const { plane } = s;
  spawnExplosion(s, plane.x + plane.width / 2, plane.y + plane.height / 2, 1.6);
  onSound('destroy');
  s.shake = 14;
  plane.alive = false;
  plane.vx = 0;
  plane.vy = 0;
  s.lives -= 1;
  s.enemyBullets = [];
  if (s.lives <= 0) {
    s.status = 'lost';
    s.endTimer = 0;
  } else {
    s.respawnTimer = RESPAWN_FRAMES;
  }
};

const winLevel = (s: GameState) => {
  s.status = 'won';
  s.endTimer = 0;
  s.enemies.forEach(e => spawnExplosion(s, e.x + e.width / 2, e.y + e.height / 2, 0.9));
  s.enemies = [];
  s.enemyBullets = [];
  s.missiles = [];
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const makeEnemy = (s: GameState, type: EnemyType, x: number, y: number): Enemy => {
  const def = ENEMY_DEFS[type];
  let targetX = SCREEN_WIDTH * 0.6;
  if (type === EnemyType.ROAMER) targetX = SCREEN_WIDTH * 0.45 + Math.random() * (SCREEN_WIDTH * 0.35);
  if (type === EnemyType.SNIPER) targetX = SCREEN_WIDTH * 0.62 + Math.random() * (SCREEN_WIDTH * 0.2);
  if (type === EnemyType.RUSHER) targetX = SCREEN_WIDTH * 0.62 + Math.random() * (SCREEN_WIDTH * 0.15);
  return {
    type,
    hp: def.hp,
    maxHp: def.hp,
    vy: type === EnemyType.ROAMER ? ROAMER_SPEED_Y * (Math.random() > 0.5 ? 1 : -1) : 0,
    lastFiredFrame: s.frameCount + Math.floor(rand(0, 50)),
    targetX,
    hitFlash: 0,
    age: 0,
    baseY: y,
    mode: 0,
    timer: 0,
    charge: 0,
    x,
    y,
    width: def.size.width,
    height: def.size.height,
  };
};

// Weighted pick from what the level allows, skipping types already at their on-screen cap
const pickEnemyType = (s: GameState): EnemyType => {
  const open = s.config.roster.filter(r => s.enemies.filter(e => e.type === r.type).length < r.max);
  const total = open.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of open) {
    roll -= r.weight;
    if (roll <= 0) return r.type;
  }
  return EnemyType.STANDARD;
};

const spawnEnemy = (s: GameState) => {
  const type = pickEnemyType(s);
  const { height } = ENEMY_DEFS[type].size;
  // Weavers need headroom on both sides of their centre line
  const margin = type === EnemyType.WAVER ? 50 : 0;
  const y = rand(60 + margin, Math.max(61 + margin, GROUND_Y - height - 6 - margin));
  s.enemies.push(makeEnemy(s, type, SCREEN_WIDTH, y));
};

const spawnBoss = (s: GameState) => {
  const kind = bossKindFor(s.config.bossIndex);
  const def = BOSS_DEFS[kind];
  const hp = Math.round(s.config.bossHp * def.hpMul);
  s.boss = {
    kind,
    x: SCREEN_WIDTH + 10,
    y: Math.min(90, GROUND_Y - def.size.height),
    width: def.size.width,
    height: def.size.height,
    hp,
    maxHp: hp,
    vy: 0.9,
    targetX: SCREEN_WIDTH - def.size.width - 24,
    entered: false,
    phase: 1,
    lastFiredFrame: s.frameCount,
    volley: 0,
    burst: 0,
    hitFlash: 0,
    dying: 0,
  };
};

const fireEnemyBullet = (s: GameState, x: number, y: number, vx: number, vy: number) => {
  s.enemyBullets.push({ x, y, width: ENEMY_BULLET_SIZE.width, height: ENEMY_BULLET_SIZE.height, vx, vy });
};

// Fires toward where the player is right now, rotated by each offset (radians)
const fireAimed = (s: GameState, ox: number, oy: number, speed: number, offsets: number[] = [0]) => {
  const { plane } = s;
  if (!plane.alive) return;
  const base = Math.atan2(plane.y + plane.height / 2 - oy, plane.x + plane.width / 2 - ox);
  offsets.forEach(o => fireEnemyBullet(s, ox, oy, Math.cos(base + o) * speed, Math.sin(base + o) * speed));
};

// Bullets fanned across the screen to the left, evenly spaced between -half and +half radians
const fireFan = (s: GameState, ox: number, oy: number, speed: number, count: number, half: number, shift = 0) => {
  for (let i = 0; i < count; i++) {
    const a = (count === 1 ? 0 : -half + (i * 2 * half) / (count - 1)) + shift;
    fireEnemyBullet(s, ox, oy, -Math.cos(a) * speed, Math.sin(a) * speed);
  }
};

const updateEnemy = (s: GameState, e: Enemy, onSound: SoundFn) => {
  const { config, plane } = s;
  const maxY = GROUND_Y - e.height;
  const cy = e.y + e.height / 2;
  const prevY = e.y;
  e.age += 1;
  if (e.hitFlash > 0) e.hitFlash -= 1;

  // Wounded planes trail smoke
  if (e.maxHp >= 3 && e.hp <= e.maxHp * 0.4 && s.frameCount % 4 === 0) {
    emit(s, 'smoke', e.x + e.width * 0.6, cy, rand(-1.4, -0.6), rand(-0.5, 0.2), rand(24, 36), rand(5, 8));
  }

  switch (e.type) {
    case EnemyType.STANDARD:
      e.x -= config.enemySpeed;
      break;

    case EnemyType.ROAMER:
      if (e.x > e.targetX) {
        e.x -= ROAMER_SPEED_X + 0.4;
      } else {
        e.y += e.vy;
        if (e.y < 50 || e.y > maxY) e.vy *= -1;
        if (s.frameCount - e.lastFiredFrame >= config.roamerFireRate) {
          fireEnemyBullet(s, e.x, cy, -config.enemyBulletSpeed, 0);
          e.lastFiredFrame = s.frameCount;
          onSound('shoot');
        }
      }
      break;

    case EnemyType.WAVER:
      e.x -= config.enemySpeed * 1.15;
      e.y = clamp(e.baseY + Math.sin(e.age * 0.055) * 46, 50, maxY);
      e.vy = e.y - prevY;
      if (config.level >= 3 && e.x < SCREEN_WIDTH - 40 && s.frameCount - e.lastFiredFrame >= config.roamerFireRate * 1.6) {
        fireEnemyBullet(s, e.x, cy, -config.enemyBulletSpeed, 0);
        e.lastFiredFrame = s.frameCount;
        onSound('shoot');
      }
      break;

    case EnemyType.RUSHER: {
      const dy = plane.y + plane.height / 2 - cy;
      if (e.mode === 0) {
        // Close in while lining up with the player
        e.x -= 2.4;
        if (plane.alive) e.y += clamp(dy, -1.8, 1.8);
        if (e.x <= e.targetX) { e.mode = 1; e.timer = 36; }
      } else if (e.mode === 1) {
        // Locked on: barely adjusts, giving the player a moment to get out of the line
        if (plane.alive) e.y += clamp(dy, -0.5, 0.5);
        e.timer -= 1;
        if (e.timer <= 0) e.mode = 2;
      } else {
        e.x -= 7.5;
      }
      e.y = clamp(e.y, 40, maxY);
      e.vy = e.y - prevY;
      break;
    }

    case EnemyType.SNIPER: {
      const interval = Math.round(config.roamerFireRate * 1.3);
      if (e.age >= 720) {
        e.x -= 1.6; // gives up and leaves
      } else if (e.x > e.targetX) {
        e.x -= 1.3;
      } else {
        if (plane.alive) e.y += clamp((plane.y + plane.height / 2 - cy) * 0.02, -0.7, 0.7);
        e.y = clamp(e.y, 50, maxY);
        const since = s.frameCount - e.lastFiredFrame;
        e.charge = clamp((since - (interval - 26)) / 26, 0, 1);
        if (since >= interval && plane.alive) {
          fireAimed(s, e.x, cy, config.enemyBulletSpeed * 1.05);
          e.lastFiredFrame = s.frameCount;
          e.charge = 0;
          onSound('shoot');
        }
      }
      e.vy = e.y - prevY;
      break;
    }

    case EnemyType.BOMBER:
      e.x -= config.enemySpeed * 0.5;
      if (e.x < SCREEN_WIDTH - 90 && s.frameCount - e.lastFiredFrame >= config.roamerFireRate * 1.2) {
        fireFan(s, e.x, cy, config.enemyBulletSpeed * 0.85, 3, 0.32);
        e.lastFiredFrame = s.frameCount;
        onSound('shoot');
      }
      break;
  }
};

const updateBoss = (s: GameState, onSound: SoundFn) => {
  const boss = s.boss;
  if (!boss) return;
  if (boss.hitFlash > 0) boss.hitFlash -= 1;

  if (boss.dying > 0) {
    // Defeat sequence: it sinks while a chain of explosions rips it apart
    boss.dying += 1;
    boss.y += 0.5;
    if (boss.dying % 7 === 0) {
      spawnExplosion(s, boss.x + rand(0.1, 0.9) * boss.width, boss.y + rand(0.1, 0.9) * boss.height, 1.2);
      onSound('destroy');
      s.shake = Math.max(s.shake, 8);
    }
    if (boss.dying >= 100) {
      spawnExplosion(s, boss.x + boss.width / 2, boss.y + boss.height / 2, 3);
      s.shake = 22;
      s.boss = null;
      winLevel(s);
    }
    return;
  }

  boss.phase = boss.hp < boss.maxHp * 0.5 ? 2 : 1;

  if (!boss.entered) {
    boss.x -= 1.4;
    if (boss.x <= boss.targetX) boss.entered = true;
    return;
  }

  const p2 = boss.phase === 2;
  const def = BOSS_DEFS[boss.kind];
  const ox = boss.x + 6;
  const oy = boss.y + boss.height * def.muzzleY;
  const speed = s.config.enemyBulletSpeed * 0.9;
  const since = s.frameCount - boss.lastFiredFrame;
  const top = 50;
  const bottom = GROUND_Y - boss.height;

  const bounce = (mul: number) => {
    boss.y += boss.vy * mul;
    if (boss.y < top) { boss.y = top; boss.vy = Math.abs(boss.vy); }
    if (boss.y > bottom) { boss.y = bottom; boss.vy = -Math.abs(boss.vy); }
  };

  switch (boss.kind) {
    case 0: {
      // WARHAWK: steady patrol, spread volleys, aimed shots once wounded
      bounce(p2 ? 1.4 : 1);
      if (since >= (p2 ? 85 : 120)) {
        boss.lastFiredFrame = s.frameCount;
        boss.volley += 1;
        const spread = p2 ? [-0.3, -0.15, 0, 0.15, 0.3] : [-0.2, 0, 0.2];
        spread.forEach(a => fireEnemyBullet(s, ox, oy, -Math.cos(a) * speed, Math.sin(a) * speed));
        if (p2 && boss.volley % 2 === 0) fireAimed(s, ox, oy, speed);
        onSound('shoot');
      }
      break;
    }

    case 1: {
      // IRON WHALE: slow carrier that keeps launching escort fighters behind lobbed shots
      bounce(p2 ? 0.8 : 0.6);
      if (since >= (p2 ? 200 : 290) && s.enemies.length < 4) {
        boss.lastFiredFrame = s.frameCount;
        boss.volley += 1;
        const rusher = boss.volley % 2 === 1;
        const type = rusher ? EnemyType.RUSHER : EnemyType.WAVER;
        [0.3, 0.72].forEach(f => {
          const e = makeEnemy(s, type, boss.x, boss.y + boss.height * f - ENEMY_DEFS[type].size.height / 2);
          if (rusher) e.targetX = boss.x - 70;
          s.enemies.push(e);
        });
        emit(s, 'flash', boss.x + 10, boss.y + boss.height * 0.5, 0, 0, 8, 26);
        onSound('shoot');
      }
      if (s.frameCount % (p2 ? 100 : 140) === 0) {
        fireAimed(s, ox, oy, speed * 0.85, p2 ? [-0.22, 0, 0.22] : [-0.12, 0.12]);
        onSound('shoot');
      }
      break;
    }

    case 2: {
      // PHANTOM: chases the player's altitude and spits rapid aimed bursts
      const dy = s.plane.y + s.plane.height / 2 - (boss.y + boss.height / 2);
      if (s.plane.alive) boss.y += clamp(dy, p2 ? -3 : -2.1, p2 ? 3 : 2.1);
      boss.y = clamp(boss.y, top, bottom);
      if (boss.burst > 0) {
        if (s.frameCount % 7 === 0) {
          fireAimed(s, ox, oy, speed * 1.1);
          boss.burst -= 1;
          onSound('shoot');
        }
      } else if (since >= (p2 ? 100 : 140)) {
        boss.lastFiredFrame = s.frameCount;
        boss.burst = p2 ? 5 : 3;
      }
      break;
    }

    default: {
      // TITAN: slow fortress sweeping dense fans whose gaps shift every volley
      bounce(p2 ? 0.8 : 0.6);
      if (since >= (p2 ? 70 : 100)) {
        boss.lastFiredFrame = s.frameCount;
        boss.volley += 1;
        const count = p2 ? 9 : 7;
        const gap = (2 * 0.7) / (count - 1);
        fireFan(s, ox, oy, speed * 0.8, count, 0.7, boss.volley % 2 === 0 ? gap / 2 : 0);
        if (p2) fireAimed(s, ox, oy, speed * 0.9);
        onSound('shoot');
      }
      break;
    }
  }
};

const fireCannon = (s: GameState, onSound: SoundFn) => {
  const { plane, loadout } = s;
  const { fireRate, shots } = cannonStats(loadout.cannon);
  if (s.frameCount - s.lastFiredFrame < fireRate) return;

  const x = plane.x + plane.width;
  const cy = plane.y + plane.height / 2 - BULLET_SIZE.height / 2;
  const shoot = (dy: number, vy: number) =>
    s.bullets.push({ x, y: cy + dy, width: BULLET_SIZE.width, height: BULLET_SIZE.height, vx: BULLET_SPEED, vy, damage: 1 });

  if (shots === 1) {
    shoot(0, 0);
  } else if (shots === 2) {
    shoot(-5, 0);
    shoot(5, 0);
  } else {
    shoot(0, 0);
    shoot(-3, -1.3);
    shoot(3, 1.3);
  }
  s.lastFiredFrame = s.frameCount;
  plane.muzzle = 3;
  onSound('shoot');
};

const fireMissile = (s: GameState, onSound: SoundFn) => {
  const { plane, loadout } = s;
  const stats = missileStats(loadout.missile, loadout.missileLevel);
  if (!s.missileRequested) return;
  s.missileRequested = false;
  if (s.frameCount - s.lastMissileFrame < stats.cooldown) return;

  s.missiles.push({
    type: loadout.missile,
    x: plane.x + plane.width - 6,
    y: plane.y + plane.height / 2 - stats.size.height / 2,
    width: stats.size.width,
    height: stats.size.height,
    vx: stats.speed,
    vy: 0,
    damage: stats.damage,
    radius: stats.radius,
    speed: stats.speed,
    hits: [],
  });
  s.lastMissileFrame = s.frameCount;
  onSound('shoot');
};

const steerHoming = (s: GameState, m: Missile) => {
  let best: Target | null = null;
  let bestDist = Infinity;
  const mcx = m.x + m.width / 2;
  const mcy = m.y + m.height / 2;
  forEachTarget(s, t => {
    if (t.x + t.width <= m.x) return; // already behind us
    const d = Math.hypot(t.x + t.width / 2 - mcx, t.y + t.height / 2 - mcy);
    if (d < bestDist) { bestDist = d; best = t; }
  });

  let wantX = m.speed;
  let wantY = 0;
  const target = best as Target | null;
  if (target) {
    const dx = target.x + target.width / 2 - mcx;
    const dy = target.y + target.height / 2 - mcy;
    const d = Math.hypot(dx, dy) || 1;
    wantX = (dx / d) * m.speed;
    wantY = (dy / d) * m.speed;
  }
  // Limited turn rate keeps the arc readable instead of snapping
  m.vx += (wantX - m.vx) * 0.14;
  m.vy += (wantY - m.vy) * 0.14;
  const sp = Math.hypot(m.vx, m.vy) || 1;
  m.vx = (m.vx / sp) * m.speed;
  m.vy = (m.vy / sp) * m.speed;
};

const blastAt = (s: GameState, m: Missile, onSound: SoundFn) => {
  const cx = m.x + m.width;
  const cy = m.y + m.height / 2;
  spawnExplosion(s, cx, cy, 0.9 + m.radius / 90);
  s.shake = Math.max(s.shake, 6);
  onSound('destroy');
  forEachTarget(s, t => {
    const d = Math.hypot(t.x + t.width / 2 - cx, t.y + t.height / 2 - cy);
    if (d <= m.radius + Math.max(t.width, t.height) / 2) damageTarget(t, m.damage);
  });
};

const resolveShots = (s: GameState, onSound: SoundFn) => {
  for (let j = s.bullets.length - 1; j >= 0; j--) {
    const b = s.bullets[j];
    const t = firstHit(s, b);
    if (!t) continue;
    damageTarget(t, b.damage);
    spawnHitSparks(s, b.x + b.width, b.y);
    s.bullets.splice(j, 1);
    if (t.hp > 0) onSound('hit');
  }

  for (let k = s.missiles.length - 1; k >= 0; k--) {
    const m = s.missiles[k];
    if (m.type === 'lance') {
      forEachTarget(s, t => {
        if (m.hits.includes(t) || !isRectCollision(t, m)) return;
        m.hits.push(t);
        damageTarget(t, m.damage);
        spawnHitSparks(s, m.x + m.width, m.y);
        emit(s, 'flash', m.x + m.width, m.y + m.height / 2, 0, 0, 7, 22);
        s.shake = Math.max(s.shake, 3);
        if (t.hp > 0) onSound('hit');
      });
      continue;
    }

    const t = firstHit(s, m);
    if (!t) continue;
    if (m.type === 'blast') {
      blastAt(s, m, onSound);
    } else {
      damageTarget(t, m.damage);
      spawnExplosion(s, m.x + m.width, m.y + m.height / 2, 0.7);
      s.shake = Math.max(s.shake, 4);
      if (t.hp > 0) onSound('hit');
    }
    s.missiles.splice(k, 1);
  }
};

const reapEnemies = (s: GameState, onSound: SoundFn) => {
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    if (e.hp > 0) continue;
    const def = ENEMY_DEFS[e.type];
    spawnExplosion(s, e.x + e.width / 2, e.y + e.height / 2, def.boom);
    if (def.boom > 1.2) s.shake = Math.max(s.shake, 4 + def.boom * 2);
    onSound('destroy');
    s.score += def.score;
    s.kills += 1;
    s.enemies.splice(i, 1);
  }

  const boss = s.boss;
  if (boss && boss.dying === 0 && boss.hp <= 0) {
    boss.dying = 1;
    s.score += 500;
    s.enemyBullets = [];
    s.enemies.forEach(e => { e.hp = 0; });
    setBanner(s, 'BOSS DOWN', '', 100);
  }
};

const resolvePlayerHits = (s: GameState, onSound: SoundFn) => {
  const { plane } = s;
  if (!plane.alive || plane.invulnerable > 0) return;
  const hb = playerHitbox(plane);

  for (const b of s.enemyBullets) {
    if (isRectCollision(hb, b)) {
      killPlayer(s, onSound);
      return;
    }
  }

  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    if (e.hp > 0 && isRectCollision(hb, e)) {
      spawnExplosion(s, e.x + e.width / 2, e.y + e.height / 2, 1);
      s.enemies.splice(i, 1);
      killPlayer(s, onSound);
      return;
    }
  }

  if (s.boss && s.boss.dying === 0 && isRectCollision(hb, s.boss)) {
    killPlayer(s, onSound);
  }
};

export const updateGameState = (s: GameState, onSound: SoundFn) => {
  if (s.status !== 'playing') {
    // Let the explosions play out while the result screen waits
    s.endTimer += 1;
    updateEffects(s);
    return;
  }

  s.frameCount += 1;
  if (s.bannerTimer > 0) s.bannerTimer -= 1;

  const { plane, config } = s;

  // Respawn after losing a life
  if (!plane.alive && s.respawnTimer > 0) {
    s.respawnTimer -= 1;
    if (s.respawnTimer === 0) {
      plane.alive = true;
      plane.x = 20;
      plane.y = SCREEN_HEIGHT / 2 - plane.height / 2;
      plane.vx = 0;
      plane.vy = 0;
      plane.tilt = 0;
      plane.invulnerable = INVULNERABLE_FRAMES;
    }
  }
  if (plane.invulnerable > 0) plane.invulnerable -= 1;

  if (plane.alive) {
    plane.x += plane.vx;
    plane.y += plane.vy;

    if (plane.y < 0) plane.y = 0;
    if (plane.x < 0) plane.x = 0;
    if (plane.x > SCREEN_WIDTH / 3) plane.x = SCREEN_WIDTH / 3;
    if (plane.y > GROUND_Y - plane.height) plane.y = GROUND_Y - plane.height;

    // Bank the plane toward its vertical movement
    const targetTilt = Math.max(-1, Math.min(1, plane.vy / PLAYER_SPEED)) * PLANE_MAX_TILT;
    plane.tilt += (targetTilt - plane.tilt) * 0.2;
    if (plane.muzzle > 0) plane.muzzle -= 1;

    // Engine exhaust
    if (s.frameCount % 2 === 0) {
      emit(s, 'fire', plane.x + 2, plane.y + 13 + plane.tilt * 0.15,
        rand(-4.5, -3), rand(-0.4, 0.4), rand(7, 12), rand(2.5, 4));
    }

    fireCannon(s, onSound);
    fireMissile(s, onSound);
  } else {
    s.missileRequested = false;
  }

  // Move projectiles
  s.bullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
  s.bullets = s.bullets.filter(b => b.x < SCREEN_WIDTH && b.y > -10 && b.y < SCREEN_HEIGHT);

  s.missiles.forEach(m => {
    if (m.type === 'homing') steerHoming(s, m);
    m.x += m.vx;
    m.y += m.vy;

    // Per-type exhaust
    const len = Math.hypot(m.vx, m.vy) || 1;
    const tx = m.x + m.width / 2 - (m.vx / len) * (m.width / 2);
    const ty = m.y + m.height / 2 - (m.vy / len) * (m.width / 2);
    if (m.type === 'lance') return;
    const big = m.type === 'blast';
    emit(s, 'smoke', tx, ty, -1.2 + rand(-0.3, 0.3), rand(-0.3, 0.3), rand(22, 34), rand(3, 5) * (big ? 1.4 : 1));
    if (s.frameCount % 2 === 0) {
      emit(s, 'fire', tx, ty, -2, rand(-0.3, 0.3), rand(5, 8), rand(2.5, 3.5) * (big ? 1.3 : 1));
    }
  });
  s.missiles = s.missiles.filter(m =>
    m.x < SCREEN_WIDTH + 40 && m.x + m.width > 0 && m.y < SCREEN_HEIGHT && m.y + m.height > 0
  );

  s.enemyBullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
  s.enemyBullets = s.enemyBullets.filter(b =>
    b.x + b.width > -10 && b.x < SCREEN_WIDTH + 10 && b.y > -20 && b.y < GROUND_Y + 10
  );

  updateEffects(s);

  // Boss arrives once the warm-up quota is cleared
  if (config.isBoss && s.bossState === 0 && s.kills >= config.killTarget) {
    s.bossState = 1;
    s.bossTimer = 130;
    setBanner(s, 'WARNING', `${BOSS_DEFS[bossKindFor(config.bossIndex)].name} APPROACHING`, 130);
  }
  if (s.bossState === 1) {
    s.bossTimer -= 1;
    if (s.bossTimer <= 0) {
      spawnBoss(s);
      s.bossState = 2;
    }
  }

  // Spawn enemies (boss levels: only warm-up waves, then escorts once the boss is wounded)
  const escortsOnly = s.bossState === 2 && s.boss && s.boss.phase === 2 && s.boss.dying === 0
    && !BOSS_DEFS[s.boss.kind].ownEscorts;
  const spawnAllowed = !config.isBoss || s.bossState === 0 || !!escortsOnly;
  s.spawnTimer -= 1;
  if (s.spawnTimer <= 0 && spawnAllowed) {
    if (s.enemies.length < config.maxEnemies) {
      spawnEnemy(s);
      s.spawnTimer = config.spawnInterval * (s.bossState ? 1.7 : 1) * rand(0.85, 1.2);
    }
  }

  // Move enemies
  s.enemies.forEach(e => updateEnemy(s, e, onSound));
  s.enemies = s.enemies.filter(e => e.x + e.width > 0);

  updateBoss(s, onSound);

  resolveShots(s, onSound);
  reapEnemies(s, onSound);
  resolvePlayerHits(s, onSound);

  if (s.status === 'playing' && !config.isBoss && s.kills >= config.killTarget) {
    winLevel(s);
  }
};
