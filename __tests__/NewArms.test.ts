import { createInitialState, updateGameState, beamBox, TELEPORT_WARNING_FRAMES, type GameState, type Enemy } from '../src/engine/GameLoop';
import { EnemyType, ENEMY_DEFS, ENEMY_NAMES } from '../src/engine/Enemies';
import { newEnemiesAt, getLevelConfig } from '../src/engine/Levels';
import { BEAM_FRAMES, MISSILES, MISSILE_TYPES, missileStats } from '../src/engine/Weapons';
import { PROJECTILES } from '../src/engine/Projectiles';

const step = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) updateGameState(s, () => {}); };
const loadout = (missile: 'homing' | 'laser' = 'homing', missileLevel = 1) => ({ maxHp: 9, cannon: 1, missile, missileLevel });

const enemy = (type: EnemyType, x: number, y: number, hp = ENEMY_DEFS[type].hp): Enemy => ({
  type, x, y, width: ENEMY_DEFS[type].size.width, height: ENEMY_DEFS[type].size.height, hp, maxHp: hp, vy: 0,
  lastFiredFrame: 0, targetX: 500, hitFlash: 0, age: 0, baseY: y, mode: 0, timer: 0, charge: 0,
});

const quiet = (s: GameState) => {
  s.spawnTimer = 99999;
  s.pickupTimer = 99999;
  s.enemies = [];
  s.plane.invulnerable = 1e9;
  return s;
};

describe('laser', () => {
  it('is the fourth weapon: expensive, with half-step upgrades', () => {
    expect(MISSILE_TYPES).toContain('laser');
    expect(MISSILES.laser.unlockCost).toBeGreaterThan(MISSILES.lance.unlockCost);
    expect(missileStats('laser', 1).damage).toBe(1);
    expect(missileStats('laser', 3).damage).toBe(2);
    expect(missileStats('laser', 4).cooldown).toBeLessThan(missileStats('laser', 1).cooldown);
  });

  it('firing starts a beam instead of launching a missile, and reloads', () => {
    const s = quiet(createInitialState(1, loadout('laser')));
    s.missileRequested = true;
    step(s);
    expect(s.beam).not.toBeNull();
    expect(s.missiles).toHaveLength(0);
    step(s, BEAM_FRAMES + 2);
    expect(s.beam).toBeNull();
    s.missileRequested = true;
    step(s);
    expect(s.beam).toBeNull(); // still reloading
  });

  it('burns every enemy in line, but not ones outside it', () => {
    const s = quiet(createInitialState(1, loadout('laser', 1)));
    const lane = s.plane.y;
    const a = enemy(EnemyType.ROAMER, 300, lane - 4, 100);
    const b = enemy(EnemyType.ROAMER, 560, lane - 4, 100);
    const off = enemy(EnemyType.ROAMER, 400, lane + 120, 100);
    s.enemies = [a, b, off];
    s.missileRequested = true;
    s.plane.vx = 0;
    s.plane.vy = 0;
    step(s, BEAM_FRAMES + 2);
    expect(a.hp).toBeLessThan(100);
    expect(b.hp).toBeLessThan(100);
    expect(off.hp).toBe(100);
  });

  it('burns away enemy shots that touch it', () => {
    const s = quiet(createInitialState(1, loadout('laser')));
    const box = beamBox(s.plane);
    const def = PROJECTILES.bullet;
    s.enemyBullets.push({ kind: 'bullet', x: box.x + 200, y: box.y + 2, width: def.size.width, height: def.size.height, vx: 0, vy: 0, damage: 1, age: 0, maxSpeed: 0 });
    s.missileRequested = true;
    step(s, 3);
    expect(s.enemyBullets).toHaveLength(0);
  });

  it('does not damage a boss during its rage cutscene', () => {
    const s = createInitialState(3, loadout('laser'));
    s.spawnTimer = 99999;
    s.plane.invulnerable = 1e9;
    s.bossState = 1;
    s.bossTimer = 1;
    step(s, 3);
    const boss = s.boss!;
    boss.entered = true;
    boss.transition = 30;
    boss.x = s.plane.x + 100;
    boss.y = s.plane.y - 20;
    const hp = boss.hp;
    s.missileRequested = true;
    step(s, 20);
    expect(boss.hp).toBe(hp);
  });
});

describe('splitter', () => {
  it('breaks into two swarm drones when destroyed', () => {
    const s = quiet(createInitialState(10, loadout()));
    s.enemies = [enemy(EnemyType.SPLITTER, 500, 150, 0)];
    step(s);
    expect(s.enemies.filter(e => e.type === EnemyType.SWARM)).toHaveLength(2);
    expect(s.popups.some(p => p.text === 'SPLIT!')).toBe(true);
  });

  it('does not split when a bomb wipes it out', () => {
    const s = quiet(createInitialState(10, loadout()));
    s.enemies = [enemy(EnemyType.SPLITTER, 500, 150)];
    s.bomb = 100;
    s.bombRequested = true;
    step(s);
    expect(s.enemies).toHaveLength(0);
  });
});

describe('teleporter', () => {
  const tele = () => {
    const s = quiet(createInitialState(22, loadout()));
    const e = enemy(EnemyType.TELEPORTER, 700, 200);
    e.targetX = 640;
    s.enemies = [e];
    return { s, e };
  };

  it('glides in, hovers, then marks a blink destination and warns', () => {
    const { s, e } = tele();
    step(s, 120);
    expect(e.mode).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 300 && e.mode !== 2; i++) step(s);
    expect(e.mode).toBe(2);
    expect(e.timer).toBeLessThanOrEqual(TELEPORT_WARNING_FRAMES);
    expect(e.targetX).toBeGreaterThan(0);
  });

  it('blinks to the marked spot and fires a three-shot volley', () => {
    const { s, e } = tele();
    for (let i = 0; i < 300 && e.mode !== 2; i++) step(s);
    const dest = { x: e.targetX, y: e.baseY };
    step(s, TELEPORT_WARNING_FRAMES + 1);
    expect(e.x).toBeCloseTo(dest.x, 0);
    expect(e.y).toBeCloseTo(dest.y, 0);
    expect(e.mode).toBe(3);
    s.enemyBullets = [];
    step(s, 20);
    expect(s.enemyBullets.length).toBe(3);
  });

  it('can be hurt while it flickers', () => {
    const { s, e } = tele();
    for (let i = 0; i < 300 && e.mode !== 2; i++) step(s);
    e.hp = 1;
    s.bullets.push({ x: e.x, y: e.y, width: 14, height: 4, vx: 10, vy: 0, damage: 1 });
    step(s);
    expect(s.enemies.includes(e)).toBe(false);
  });
});

describe('roster', () => {
  it('introduces the splitter at 10 and the teleporter at 22, one new enemy per level', () => {
    expect(newEnemiesAt(10)).toEqual([EnemyType.SPLITTER]);
    expect(newEnemiesAt(22)).toEqual([EnemyType.TELEPORTER]);
    expect(getLevelConfig(9).roster.some(r => r.type === EnemyType.SPLITTER)).toBe(false);
    expect(getLevelConfig(10).roster.some(r => r.type === EnemyType.SPLITTER)).toBe(true);
    expect(getLevelConfig(21).roster.some(r => r.type === EnemyType.TELEPORTER)).toBe(false);
    expect(getLevelConfig(22).roster.some(r => r.type === EnemyType.TELEPORTER)).toBe(true);
    expect(ENEMY_NAMES[EnemyType.SPLITTER]).toBe('SPLITTER');
  });

  it('banner announces them', () => {
    expect(createInitialState(10, loadout()).banner?.sub).toBe('NEW ENEMY: SPLITTER');
    expect(createInitialState(22, loadout()).banner?.sub).toBe('NEW ENEMY: TELEPORTER');
  });
});
