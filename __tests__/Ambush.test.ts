import {
  createInitialState, updateGameState, AMBUSH_WARNING_FRAMES, type GameState, type Enemy,
} from '../src/engine/GameLoop';
import { EnemyType, ENEMY_DEFS } from '../src/engine/Enemies';
import { ambushGap, ambushSize, newEnemiesAt } from '../src/engine/Levels';
import { PLAYER_MAX_X, SCREEN_HEIGHT, SCREEN_WIDTH } from '../src/engine/Constants';

const step = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) updateGameState(s, () => {}); };
const loadout = { maxHp: 9, cannon: 1, missile: 'homing' as const, missileLevel: 1 };

const calm = (level: number) => {
  const s = createInitialState(level, loadout);
  s.spawnTimer = 99999;
  s.pickupTimer = 99999;
  s.enemies = [];
  s.plane.invulnerable = 1e9;
  return s;
};

// Fast-forward to the moment the warning is on screen
const warned = (s: GameState) => {
  s.ambushTimer = 1;
  step(s);
  return s.ambush!;
};

describe('ambush director', () => {
  it('stays quiet on level 1 and in bonus runs, escort levels and boss fights', () => {
    const l1 = calm(1);
    l1.ambushTimer = 1;
    step(l1, 5);
    expect(l1.ambush).toBeNull();

    const escort = calm(7);
    escort.ambushTimer = 1;
    step(escort, 5);
    expect(escort.ambush).toBeNull();

    const bonus = calm(8);
    bonus.ambushTimer = 1;
    step(bonus, 5);
    expect(bonus.ambush).toBeNull();

    const boss = calm(3);
    boss.bossState = 2;
    boss.ambushTimer = 1;
    step(boss, 5);
    expect(boss.ambush).toBeNull();
  });

  it('announces itself for a second before anything enters', () => {
    const s = calm(2);
    const a = warned(s);
    expect(a.spots.length).toBe(ambushSize(2));
    expect(a.timer).toBeLessThanOrEqual(AMBUSH_WARNING_FRAMES);
    step(s, AMBUSH_WARNING_FRAMES - 10);
    expect(s.enemies).toHaveLength(0);
    expect(s.ambush).not.toBeNull();
  });

  it('level 2-3 ambushes come only from the top: divers on a line to the player', () => {
    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0.1); // would pick "left" if it were allowed
    const s = calm(2);
    const a = warned(s);
    rnd.mockRestore();
    expect(a.side).toBe('top');
    step(s, AMBUSH_WARNING_FRAMES + 1);
    expect(s.ambush).toBeNull();
    const divers = s.enemies.filter(e => e.type === EnemyType.DIVER);
    expect(divers).toHaveLength(a.spots.length);
    divers.forEach(d => {
      expect(d.vy).toBeGreaterThan(0); // falling
      expect(d.vx!).toBeLessThan(0);   // toward the player on the left
    });
  });

  it('from level 4 ambushes can come from behind: interceptors enter at the left edge', () => {
    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const s = calm(4);
    const a = warned(s);
    rnd.mockRestore();
    expect(a.side).toBe('left');
    step(s, AMBUSH_WARNING_FRAMES + 1);
    const hawks = s.enemies.filter(e => e.type === EnemyType.INTERCEPTOR);
    expect(hawks).toHaveLength(a.spots.length);
    hawks.forEach(h => expect(h.vx!).toBeGreaterThan(0));
    // they are warned about along the player's lane
    const cy = s.plane.y + s.plane.height / 2;
    expect(Math.abs(a.spots.reduce((x, y) => x + y, 0) / a.spots.length - cy)).toBeLessThan(40);
  });

  it('schedules the next ambush after the gap, and gets busier with the level', () => {
    const s = calm(10);
    warned(s);
    step(s, AMBUSH_WARNING_FRAMES + 1);
    expect(s.ambushTimer).toBeGreaterThan(ambushGap(10) * 0.8);
    expect(ambushGap(40)).toBeGreaterThanOrEqual(420);
    expect(ambushSize(30)).toBeLessThanOrEqual(5);
    expect(ambushSize(12)).toBeGreaterThan(ambushSize(2));
  });

  it('introduces the divers on level 2 and the interceptors on level 4', () => {
    expect(newEnemiesAt(2)).toContain(EnemyType.DIVER);
    expect(newEnemiesAt(4)).toContain(EnemyType.INTERCEPTOR);
  });
});

describe('ambush enemies', () => {
  const mk = (type: EnemyType, x: number, y: number): Enemy => ({
    type, x, y, width: ENEMY_DEFS[type].size.width, height: ENEMY_DEFS[type].size.height,
    hp: ENEMY_DEFS[type].hp, maxHp: ENEMY_DEFS[type].hp, vy: 0, lastFiredFrame: 0, targetX: 0, hitFlash: 0, age: 0,
    baseY: y, mode: 0, timer: 0, charge: 0,
  });

  it('a diver keeps its heading and is cleaned up once it has fallen off the screen', () => {
    const s = calm(2);
    const d = mk(EnemyType.DIVER, 800, -18);
    d.vx = -2; d.vy = 4;
    s.enemies = [d];
    step(s, 30);
    expect(d.x).toBeCloseTo(800 - 60, 0);
    expect(d.y).toBeCloseTo(-18 + 120, 0);
    step(s, Math.ceil(SCREEN_HEIGHT / 4) + 20);
    expect(s.enemies).toHaveLength(0);
  });

  it('an interceptor survives entering from off-screen left, then is removed after exiting right', () => {
    const s = calm(4);
    const h = mk(EnemyType.INTERCEPTOR, -60, 200);
    h.vx = 5;
    s.enemies = [h];
    step(s, 3);
    expect(s.enemies).toHaveLength(1);
    step(s, Math.ceil((SCREEN_WIDTH + 300) / 5));
    expect(s.enemies).toHaveLength(0);
  });

  it('an interceptor fires twice as it sweeps past, aimed at the player', () => {
    const s = calm(4);
    const h = mk(EnemyType.INTERCEPTOR, -60, s.plane.y);
    h.vx = 4;
    h.lastFiredFrame = s.frameCount;
    s.enemies = [h];
    let volleys = 0;
    let before = 0;
    for (let i = 0; i < 160; i++) {
      step(s);
      if (h.mode > before) {
        volleys += 1;
        before = h.mode;
        const b = s.enemyBullets[s.enemyBullets.length - 1];
        expect(b.vx).toBeLessThan(0); // the player is behind it by then, so the shot flies back left
      }
    }
    expect(volleys).toBe(2);
    expect(h.mode).toBe(2);
  });
});

describe('player movement range', () => {
  it('the jet can now fly out to half the screen width', () => {
    expect(PLAYER_MAX_X).toBe(0.5);
    const s = calm(1);
    s.plane.vx = 4;
    s.plane.vy = 0;
    step(s, 600);
    expect(s.plane.x).toBeCloseTo(SCREEN_WIDTH * 0.5, 0);
  });
});
