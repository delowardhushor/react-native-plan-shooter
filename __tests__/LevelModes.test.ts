import { createInitialState, updateGameState, type GameState } from '../src/engine/GameLoop';
import { EnemyType } from '../src/engine/Enemies';
import { applyMode, getLevelConfig, levelMode, surviveFramesFor } from '../src/engine/Levels';

const loadout = { maxHp: 5, cannon: 1, missile: 'homing' as const, missileLevel: 1 };
const step = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) updateGameState(s, () => {}); };

describe('level modes', () => {
  it('lays out the campaign: survival on 5, 11, 17..., bonus on 8, 14, 20..., bosses every third', () => {
    expect([1, 2, 3, 4].map(levelMode)).toEqual(['normal', 'normal', 'boss', 'normal']);
    expect([5, 11, 17, 23].map(levelMode)).toEqual(['survival', 'survival', 'survival', 'survival']);
    expect([8, 14, 20, 26].map(levelMode)).toEqual(['bonus', 'bonus', 'bonus', 'bonus']);
    expect(levelMode(6)).toBe('boss');
    expect(levelMode(2)).toBe('normal'); // bonus waits until level 8
  });

  it('never replaces a boss level, and every other level is still reachable as normal', () => {
    for (let l = 1; l <= 120; l++) {
      if (l % 3 === 0) expect(levelMode(l)).toBe('boss');
    }
    expect(levelMode(7)).toBe('normal');
    expect(levelMode(10)).toBe('normal');
  });

  it('survival lasts about a minute and gets longer, bonus has no clock', () => {
    expect(getLevelConfig(5).surviveFrames).toBe(surviveFramesFor(5));
    expect(surviveFramesFor(5)).toBeGreaterThan(3000);
    expect(surviveFramesFor(500)).toBeLessThanOrEqual(4800);
    expect(getLevelConfig(8).surviveFrames).toBe(0);
  });

  it('survival is a harder spawn pace, bonus is only weak fighters', () => {
    const base = getLevelConfig(11);
    const surv = applyMode(base);
    expect(surv.spawnInterval).toBeLessThan(base.spawnInterval);
    expect(surv.maxEnemies).toBe(base.maxEnemies + 2);
    const bonus = applyMode(getLevelConfig(14));
    expect(bonus.roster.map(r => r.type)).toEqual([EnemyType.STANDARD]);
    expect(bonus.killTarget).toBe(50);
  });
});

describe('survival levels', () => {
  const run = () => {
    const s = createInitialState(5, loadout);
    s.plane.invulnerable = 1e9;
    return s;
  };

  it('are not won by kills, only by lasting until the clock runs out', () => {
    const s = run();
    s.kills = 9999;
    step(s, 120);
    expect(s.status).toBe('playing');
    s.frameCount = s.config.surviveFrames - 2;
    step(s, 3);
    expect(s.status).toBe('won');
  });

  it('announce the clock, and the new enemy of that level', () => {
    const s = run();
    expect(s.banner?.sub).toContain('SURVIVE');
    expect(s.banner?.sub).toContain('SNIPER'); // level 5 introduces the sniper
  });

  it('spawn faster the longer you last', () => {
    const gap = (frame: number) => {
      const s = run();
      s.frameCount = frame;
      s.enemies = [];
      s.spawnTimer = 1;
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      step(s);
      jest.restoreAllMocks();
      return s.spawnTimer;
    };
    expect(gap(10)).toBeGreaterThan(gap(getLevelConfig(5).surviveFrames - 60));
  });
});

describe('bonus runs', () => {
  const bonus = () => {
    const s = createInitialState(8, loadout);
    s.plane.invulnerable = 1e9;
    return s;
  };

  it('double the score of a kill', () => {
    const kill = (level: number) => {
      const s = createInitialState(level, loadout);
      s.spawnTimer = 99999;
      s.enemies.push({
        type: EnemyType.STANDARD, x: 600, y: 100, width: 44, height: 22, hp: 0, maxHp: 1, vy: 0, lastFiredFrame: 0,
        targetX: 0, hitFlash: 0, age: 0, baseY: 100, mode: 0, timer: 0, charge: 0,
      });
      step(s);
      return s.score;
    };
    expect(kill(8)).toBe(kill(7) * 2);
  });

  it('only send weak fighters', () => {
    const s = bonus();
    step(s, 400);
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.enemies.every(e => e.type === EnemyType.STANDARD)).toBe(true);
    expect(s.banner?.sub).toContain('BONUS');
  });

  it('shower the player with power-ups', () => {
    const drops = (level: number) => {
      let total = 0;
      for (let trial = 0; trial < 30; trial++) {
        const s = createInitialState(level, loadout);
        s.spawnTimer = 99999;
        for (let i = 0; i < 10; i++) {
          s.pickups = [];
          s.enemies.push({
            type: EnemyType.STANDARD, x: 600, y: 100, width: 44, height: 22, hp: 0, maxHp: 1, vy: 0, lastFiredFrame: 0,
            targetX: 0, hitFlash: 0, age: 0, baseY: 100, mode: 0, timer: 0, charge: 0,
          });
          s.hitStop = 0;
          step(s);
          if (s.pickups.some(p => p.kind !== 'medic')) total++;
        }
      }
      return total;
    };
    expect(drops(8)).toBeGreaterThan(drops(7) * 2);
  });

  it('are won by the kill quota like a normal level', () => {
    const s = bonus();
    s.config.maxEnemies = 0;
    s.kills = s.config.killTarget;
    step(s);
    expect(s.status).toBe('won');
  });
});
