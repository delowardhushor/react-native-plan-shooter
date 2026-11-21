import { createInitialState, updateGameState, spawnFormation, type GameState } from '../src/engine/GameLoop';
import { EnemyType, ENEMY_DEFS } from '../src/engine/Enemies';
import { formationChance, getLevelConfig } from '../src/engine/Levels';
import { DROP_PITY_EARLY } from '../src/engine/PowerUps';
import { SCREEN_HEIGHT, SCREEN_WIDTH, GROUND_HEIGHT } from '../src/engine/Constants';

const GROUND_Y = SCREEN_HEIGHT - GROUND_HEIGHT;
const step = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) updateGameState(s, () => {}); };
const loadout = { maxHp: 9, cannon: 1, missile: 'homing' as const, missileLevel: 1 };

const calm = (level: number) => {
  const s = createInitialState(level, loadout);
  s.spawnTimer = 99999;
  s.pickupTimer = 99999;
  s.ambushTimer = 1e9;
  s.enemies = [];
  s.plane.invulnerable = 1e9;
  return s;
};

describe('formations', () => {
  it('a gate is a wall of fighters with a two-lane gap to fly through', () => {
    const s = calm(3);
    spawnFormation(s, 'gate');
    expect(s.enemies).toHaveLength(4);
    expect(s.enemies.every(e => e.type === EnemyType.STANDARD && e.x === SCREEN_WIDTH)).toBe(true);
    const ys = s.enemies.map(e => e.y).sort((a, b) => a - b);
    const gaps = ys.slice(1).map((y, i) => y - ys[i]);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(90);   // a gap wide enough for the jet (26px) and then some
    expect(Math.min(...gaps)).toBeLessThanOrEqual(50);
  });

  it('the gate stays within the playfield and roughly around the player', () => {
    const s = calm(3);
    spawnFormation(s, 'gate');
    s.enemies.forEach(e => {
      expect(e.y).toBeGreaterThanOrEqual(60);
      expect(e.y + e.height).toBeLessThanOrEqual(GROUND_Y + 1);
    });
  });

  it('a vee has a leader in front and two pairs trailing behind it', () => {
    const s = calm(1);
    spawnFormation(s, 'vee');
    expect(s.enemies).toHaveLength(5);
    const leader = s.enemies[0];
    expect(s.enemies.slice(1).every(e => e.x > leader.x)).toBe(true);
    const above = s.enemies.slice(1).filter(e => e.y < leader.y).length;
    expect(above).toBe(2);
  });

  it('a snake is four wavers on one weaving path, each trailing the one ahead', () => {
    const s = calm(3);
    spawnFormation(s, 'snake');
    expect(s.enemies).toHaveLength(4);
    expect(s.enemies.every(e => e.type === EnemyType.WAVER)).toBe(true);
    for (let i = 1; i < 4; i++) {
      expect(s.enemies[i].x).toBeGreaterThan(s.enemies[i - 1].x);
      expect(s.enemies[i].age).toBeLessThan(s.enemies[i - 1].age);
    }
    // After a while they have all passed through (roughly) the same height as the leader did earlier
    step(s, 60);
    const ys = s.enemies.map(e => e.y);
    expect(new Set(ys.map(y => Math.round(y))).size).toBeGreaterThan(1);
  });

  it('level 1 only gets the gate and the vee; snakes need the wavers, from level 2', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) kinds.add(spawnFormation(calm(1)));
    expect(kinds.has('snake')).toBe(false);
    const later = new Set<string>();
    for (let i = 0; i < 60; i++) later.add(spawnFormation(calm(3)));
    expect(later.has('snake')).toBe(true);
  });

  it('turn up in normal spawns, but not in bonus runs or boss fights', () => {
    const count = (level: number, setup?: (s: GameState) => void) => {
      let formations = 0;
      for (let i = 0; i < 80; i++) {
        const s = calm(level);
        setup?.(s);
        s.spawnTimer = 1;
        s.config.maxEnemies = 99;
        step(s);
        if (s.enemies.length >= 4) formations++;
      }
      return formations;
    };
    expect(count(3)).toBeGreaterThan(5);
    expect(count(8)).toBe(0); // bonus run
    expect(count(3, s => { s.bossState = 2; s.config.isBoss = true; s.boss = null; })).toBe(0);
    expect(formationChance(500)).toBeLessThanOrEqual(0.4);
  });
});

describe('the opening levels', () => {
  it('are snappier than the plain curve: faster, busier, more on screen', () => {
    const l1 = getLevelConfig(1);
    expect(l1.spawnInterval).toBeLessThan(120);
    expect(l1.maxEnemies).toBeGreaterThanOrEqual(4);
    expect(l1.enemySpeed).toBeGreaterThan(1.25);
    // the boost has faded by level 5, back on the normal curve
    expect(getLevelConfig(5).spawnInterval).toBe(110);
    expect(getLevelConfig(12).spawnInterval).toBe(82);
  });

  it('guarantee a power-up crate within the first few kills on level 1 and 2', () => {
    const s = calm(1);
    expect(s.dropPity).toBe(0);
    for (let i = 0; i < DROP_PITY_EARLY; i++) {
      s.pickups = [];
      s.enemies = [{
        type: EnemyType.STANDARD, x: 600, y: 100, width: ENEMY_DEFS[EnemyType.STANDARD].size.width, height: 22, hp: 0, maxHp: 1,
        vy: 0, lastFiredFrame: 0, targetX: 0, hitFlash: 0, age: 0, baseY: 100, mode: 0, timer: 0, charge: 0,
      }];
      s.hitStop = 0;
      const rnd = jest.spyOn(Math, 'random').mockReturnValue(0.99);
      step(s);
      rnd.mockRestore();
    }
    expect(s.pickups.some(p => p.kind !== 'medic')).toBe(true);
  });
});
