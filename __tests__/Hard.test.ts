import { createInitialState, updateGameState, type Enemy, type GameState } from '../src/engine/GameLoop';
import { ENEMY_DEFS, EnemyType, bossTier, bossTitle } from '../src/engine/Enemies';
import { armorMaxHp } from '../src/engine/Armor';
import { HARD_FROM, getLevelConfig, newEnemiesAt } from '../src/engine/Levels';

const noSound = () => {};
const loadout = { maxHp: armorMaxHp(5), cannon: 1, missile: 'homing' as const, missileLevel: 1 };

const step = (s: GameState, frames = 1) => {
  for (let i = 0; i < frames; i++) updateGameState(s, noSound);
};

const makeEnemy = (type: EnemyType, over: Partial<Enemy> = {}): Enemy => {
  const def = ENEMY_DEFS[type];
  return {
    type, x: 600, y: 120, width: def.size.width, height: def.size.height,
    hp: def.hp, maxHp: def.hp, vy: 0, lastFiredFrame: 0, targetX: 500, hitFlash: 0, age: 0, baseY: 120,
    mode: 0, timer: 0, charge: 0, ...over,
  };
};

// A quiet arena: the player cannot be hurt and nothing spawns on its own
const arena = (level: number) => {
  const s = createInitialState(level, loadout);
  s.plane.invulnerable = 1e9;
  s.config.maxEnemies = 0;
  return s;
};

describe('difficulty beyond level 12', () => {
  it('keeps the old curve up to HARD_FROM - 1', () => {
    const c = getLevelConfig(HARD_FROM - 1);
    expect(c.enemyHpMul).toBe(1);
    expect(c.maxEnemies).toBe(5);
    expect(c.spawnInterval).toBe(82);
  });

  it('keeps getting harder after level 12', () => {
    const a = getLevelConfig(14);
    const b = getLevelConfig(29); // a regular level, as 30 would be a boss level
    expect(b.killTarget).toBeGreaterThan(a.killTarget);
    expect(b.spawnInterval).toBeLessThan(a.spawnInterval);
    expect(b.maxEnemies).toBeGreaterThan(a.maxEnemies);
    expect(b.enemySpeed).toBeGreaterThan(a.enemySpeed);
    expect(b.roamerFireRate).toBeLessThan(a.roamerFireRate);
    expect(b.enemyBulletSpeed).toBeGreaterThan(a.enemyBulletSpeed);
    expect(b.enemyHpMul).toBeGreaterThan(a.enemyHpMul);
    expect(getLevelConfig(30).bossHp).toBeGreaterThan(getLevelConfig(15).bossHp);
  });

  it('stays within sane caps however far you go', () => {
    const c = getLevelConfig(500);
    expect(c.killTarget).toBeLessThanOrEqual(36);
    expect(c.maxEnemies).toBeLessThanOrEqual(8);
    expect(c.spawnInterval).toBeGreaterThanOrEqual(50);
    expect(c.roamerFireRate).toBeGreaterThanOrEqual(60);
    expect(c.enemyBulletSpeed).toBeLessThanOrEqual(5.6);
    expect(c.enemyHpMul).toBeLessThanOrEqual(5);
  });

  it('introduces a new enemy plane at 13, 16 and 19', () => {
    const has = (level: number, type: EnemyType) => getLevelConfig(level).roster.some(r => r.type === type);
    expect(has(12, EnemyType.AEGIS)).toBe(false);
    expect(has(13, EnemyType.AEGIS)).toBe(true);
    expect(has(15, EnemyType.SWARM)).toBe(false);
    expect(has(16, EnemyType.SWARM)).toBe(true);
    expect(has(18, EnemyType.MINELAYER)).toBe(false);
    expect(has(19, EnemyType.MINELAYER)).toBe(true);
    expect(newEnemiesAt(13)).toEqual([EnemyType.AEGIS]);
    expect(newEnemiesAt(14)).toEqual([]);
  });

  it('announces a new enemy on its first level', () => {
    expect(createInitialState(13, loadout).banner?.sub).toBe('NEW ENEMY: AEGIS');
    expect(createInitialState(12, loadout).banner?.sub).toBe('BOSS BATTLE AHEAD');
    expect(createInitialState(14, loadout).banner?.sub).toMatch(/^DESTROY \d+ ENEMY PLANES$/);
  });
});

describe('new enemy planes', () => {
  it('the aegis shield drops at half health', () => {
    const s = arena(13);
    const e = makeEnemy(EnemyType.AEGIS);
    s.enemies.push(e);
    step(s);
    expect(e.mode).toBe(0);
    e.hp = e.maxHp * 0.5;
    step(s);
    expect(e.mode).toBe(1);
  });

  it('a swarm spawns as a group of four weaving drones', () => {
    const s = createInitialState(16, loadout);
    s.plane.invulnerable = 1e9;
    s.config.roster = [{ type: EnemyType.SWARM, weight: 1, max: 8 }];
    s.spawnTimer = 1;
    step(s);
    const drones = s.enemies.filter(e => e.type === EnemyType.SWARM);
    expect(drones).toHaveLength(4);
    expect(new Set(drones.map(d => Math.round(d.baseY))).size).toBe(4);
  });

  it('a minelayer drops slow mines that drift and burn out', () => {
    const s = arena(19);
    s.enemies.push(makeEnemy(EnemyType.MINELAYER, { x: 560, targetX: 600, lastFiredFrame: -1000 }));
    step(s);
    const mines = s.enemyBullets.filter(b => b.kind === 'orb');
    expect(mines).toHaveLength(1);
    expect(mines[0].maxSpeed).toBeLessThan(1.2);
    mines[0].age = 10_000;
    step(s);
    expect(s.enemyBullets.filter(b => b.kind === 'orb' && b.age > 5000)).toHaveLength(0);
  });

  it('enemy hit points scale with the level', () => {
    const s = createInitialState(40, loadout);
    s.plane.invulnerable = 1e9;
    s.config.roster = [{ type: EnemyType.ROAMER, weight: 1, max: 9 }];
    s.spawnTimer = 1;
    step(s);
    const e = s.enemies[0];
    expect(e.maxHp).toBeGreaterThan(ENEMY_DEFS[EnemyType.ROAMER].hp);
  });
});

describe('boss Mk II', () => {
  it('bosses repeat as a tougher Mk after the first four', () => {
    expect(bossTier(4)).toBe(0);
    expect(bossTier(5)).toBe(1);
    expect(bossTier(9)).toBe(2);
    expect(bossTitle(1)).toBe('WARHAWK');
    expect(bossTitle(5)).toBe('WARHAWK MK II');
    expect(bossTitle(8)).toBe('TITAN MK II');
    expect(bossTitle(9)).toBe('WARHAWK MK III');
  });

  it('the warning banner and the spawned boss carry the Mk', () => {
    const s = createInitialState(15, loadout);
    s.plane.invulnerable = 1e9;
    s.config.maxEnemies = 0;
    s.kills = s.config.killTarget;
    step(s);
    expect(s.banner?.sub).toBe('WARHAWK MK II APPROACHING');
    step(s, 140);
    expect(s.boss?.tier).toBe(1);
  });
});
