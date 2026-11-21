import { createInitialState, updateGameState, hasGroundTargets, type GameState, type Enemy } from '../src/engine/GameLoop';
import { EnemyType, ENEMY_DEFS, isGroundType } from '../src/engine/Enemies';
import { getLevelConfig, newEnemiesAt } from '../src/engine/Levels';
import { LOB_RADIUS, lobInterval, lobLandingX } from '../src/engine/Lob';
import { SCREEN_HEIGHT, SCREEN_WIDTH, GROUND_HEIGHT } from '../src/engine/Constants';

const GROUND_Y = SCREEN_HEIGHT - GROUND_HEIGHT;
const step = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) updateGameState(s, () => {}); };
const loadout = { maxHp: 9, cannon: 1, missile: 'homing' as const, missileLevel: 1 };

const enemy = (type: EnemyType, x: number, y: number, hp = ENEMY_DEFS[type].hp): Enemy => ({
  type, x, y, width: ENEMY_DEFS[type].size.width, height: ENEMY_DEFS[type].size.height, hp, maxHp: hp, vy: 0,
  lastFiredFrame: 0, targetX: 500, hitFlash: 0, age: 0, baseY: y, mode: 0, timer: 0, charge: 0,
});
const onGround = (type: EnemyType, x: number, hp?: number) => enemy(type, x, GROUND_Y - ENEMY_DEFS[type].size.height + 8, hp);

const calm = (level = 1) => {
  const s = createInitialState(level, loadout);
  s.spawnTimer = 99999;
  s.pickupTimer = 99999;
  s.enemies = [];
  s.plane.invulnerable = 1e9;
  return s;
};

describe('ground enemies in the roster', () => {
  it('start on level 1 with the tank, then the AA gun, SAM site and flak tower', () => {
    expect(newEnemiesAt(1)).toEqual([EnemyType.TANK]);
    expect(newEnemiesAt(4)).toContain(EnemyType.TURRET);
    expect(newEnemiesAt(7)).toContain(EnemyType.SAM);
    expect(newEnemiesAt(10)).toContain(EnemyType.TOWER);
    expect(getLevelConfig(1).roster.map(r => r.type)).toContain(EnemyType.TANK);
    expect([EnemyType.TANK, EnemyType.TURRET, EnemyType.SAM, EnemyType.TOWER].every(isGroundType)).toBe(true);
    expect(isGroundType(EnemyType.STANDARD)).toBe(false);
  });

  it('are spawned on the ground, sunk in a little', () => {
    [EnemyType.TANK, EnemyType.SAM, EnemyType.TOWER].forEach(type => {
      const s = calm(11);
      s.config.roster = [{ type, weight: 1, max: 1 }];
      s.spawnTimer = 1;
      step(s);
      const e = s.enemies.find(x => x.type === type)!;
      expect(e).toBeDefined();
      expect(e.y + e.height).toBeCloseTo(GROUND_Y + 8, 0);
    });
  });

  it('scroll past with the terrain', () => {
    const s = calm(11);
    const t = onGround(EnemyType.TOWER, SCREEN_WIDTH - 50);
    s.enemies = [t];
    step(s, 10);
    expect(t.x).toBeCloseTo(SCREEN_WIDTH - 50 - 30, 0);
  });
});

describe('lobbed bombs', () => {
  it('only drop while there is something on the ground to hit', () => {
    const s = calm();
    s.enemies = [enemy(EnemyType.STANDARD, 700, 150)];
    step(s, 120);
    expect(s.lobs).toHaveLength(0);
    expect(hasGroundTargets(s)).toBe(false);
    s.enemies.push(onGround(EnemyType.TANK, SCREEN_WIDTH - 100, 99));
    expect(hasGroundTargets(s)).toBe(true);
    s.lastLobFrame = -999;
    step(s);
    expect(s.lobs).toHaveLength(1);
  });

  it('drop faster with a better cannon, but never more often than every ~half second', () => {
    expect(lobInterval(5)).toBeLessThan(lobInterval(1));
    expect(lobInterval(99)).toBeGreaterThanOrEqual(30);
  });

  it('arc forward and down, and explode on the ground', () => {
    const s = calm();
    s.enemies = [onGround(EnemyType.TANK, SCREEN_WIDTH - 20, 99)];
    s.lastLobFrame = -999;
    step(s);
    const lob = s.lobs[0];
    const x0 = lob.x;
    const y0 = lob.y;
    step(s, 10);
    expect(lob.x).toBeGreaterThan(x0);
    expect(lob.y - y0).toBeGreaterThan(10);
    step(s, 200);
    expect(s.lobs.every(l => l.y < GROUND_Y + 10)).toBe(true);
  });

  it('the landing marker prediction matches where a real bomb lands', () => {
    const s = calm();
    s.enemies = [onGround(EnemyType.TANK, SCREEN_WIDTH - 20, 99)];
    s.lastLobFrame = -999;
    s.plane.vx = 0;
    s.plane.vy = 0;
    const predicted = lobLandingX(s.plane.x + s.plane.width * 0.55, s.plane.y + s.plane.height, GROUND_Y);
    step(s);
    const lob = s.lobs[0];
    let landedAt = 0;
    for (let i = 0; i < 400 && s.lobs.includes(lob); i++) {
      landedAt = lob.x;
      step(s);
    }
    expect(Math.abs(landedAt - predicted)).toBeLessThan(10);
  });

  it('a bomb landing near a ground target damages it, and ignores aircraft', () => {
    const s = calm();
    const tank = onGround(EnemyType.TANK, 400, 20);
    const flyer = enemy(EnemyType.STANDARD, 400, GROUND_Y - 120, 20);
    s.enemies = [tank, flyer];
    s.lobs.push({ x: 420, y: GROUND_Y - 12, width: 8, height: 8, vx: 0, vy: 3, damage: 3 });
    s.lastLobFrame = 1e9; // no new drops
    step(s, 3);
    expect(tank.hp).toBeLessThan(20);
    expect(flyer.hp).toBe(20);
    expect(s.lobs).toHaveLength(0);
  });

  it('splash reaches neighbours within the blast radius only', () => {
    const s = calm();
    const near = onGround(EnemyType.TANK, 500, 20);
    const far = onGround(EnemyType.TANK, 500 + LOB_RADIUS + 120, 20);
    s.enemies = [near, far];
    s.lobs.push({ x: 510, y: GROUND_Y - 12, width: 8, height: 8, vx: 0, vy: 3, damage: 3 });
    s.lastLobFrame = 1e9;
    step(s, 3);
    expect(near.hp).toBeLessThan(20);
    expect(far.hp).toBe(20);
  });

  it('count toward the kill quota like any other kill', () => {
    const s = calm();
    s.enemies = [onGround(EnemyType.TANK, 400, 1)];
    s.lobs.push({ x: 410, y: GROUND_Y - 12, width: 8, height: 8, vx: 0, vy: 3, damage: 3 });
    s.lastLobFrame = 1e9;
    step(s, 3);
    expect(s.kills).toBe(1);
    expect(s.stats.killsByType[EnemyType.TANK]).toBe(1);
  });
});

describe('ground enemy weapons', () => {
  it('the tank lobs a rocket at the player', () => {
    const s = calm();
    const t = onGround(EnemyType.TANK, SCREEN_WIDTH - 100);
    t.lastFiredFrame = -999;
    s.enemies = [t];
    step(s);
    expect(s.enemyBullets.some(b => b.kind === 'rocket')).toBe(true);
  });

  it('the SAM site launches a homing seeker upward, which the cannon can shoot down', () => {
    const s = calm(7);
    const t = onGround(EnemyType.SAM, SCREEN_WIDTH - 100);
    t.lastFiredFrame = -999;
    s.enemies = [t];
    step(s);
    const seeker = s.enemyBullets.find(b => b.kind === 'seeker')!;
    expect(seeker).toBeDefined();
    expect(seeker.vy).toBeLessThan(0);
  });

  it('the flak tower fires a three-shot fan', () => {
    const s = calm(10);
    const t = onGround(EnemyType.TOWER, SCREEN_WIDTH - 100);
    t.lastFiredFrame = -999;
    s.enemies = [t];
    step(s);
    expect(s.enemyBullets).toHaveLength(3);
  });

  it('do not shoot once they have scrolled past the player', () => {
    const s = calm();
    const t = onGround(EnemyType.TANK, s.plane.x + 20);
    t.lastFiredFrame = -999;
    s.enemies = [t];
    step(s);
    expect(s.enemyBullets).toHaveLength(0);
  });
});
