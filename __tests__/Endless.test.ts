jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()) },
}));

import {
  createInitialState, updateGameState, revivePlayer, TRANSPORT_SIZE, type GameState, type Enemy,
} from '../src/engine/GameLoop';
import { EnemyType, ENEMY_DEFS } from '../src/engine/Enemies';
import { ESCORT_FRAMES, applyMode, getEndlessConfig, getLevelConfig, isSpecialMode, levelMode } from '../src/engine/Levels';
import { PROJECTILES } from '../src/engine/Projectiles';
import { SCREEN_WIDTH } from '../src/engine/Constants';
import { computeEndlessReward, defaultProgress } from '../src/state/Progress';
import { applyRunSummary, completedMissions, summarizeRun } from '../src/state/Missions';

const step = (s: GameState, n = 1) => { for (let i = 0; i < n; i++) updateGameState(s, () => {}); };
const loadout = { maxHp: 5, cannon: 1, missile: 'homing' as const, missileLevel: 1 };

const enemy = (type: EnemyType, x: number, y: number, hp = ENEMY_DEFS[type].hp): Enemy => ({
  type, x, y, width: ENEMY_DEFS[type].size.width, height: ENEMY_DEFS[type].size.height, hp, maxHp: hp, vy: 0,
  lastFiredFrame: 0, targetX: 500, hitFlash: 0, age: 0, baseY: y, mode: 0, timer: 0, charge: 0,
});

const calm = (s: GameState) => {
  s.spawnTimer = 99999;
  s.pickupTimer = 99999;
  s.enemies = [];
  return s;
};

describe('endless mode', () => {
  it('plays every level as a plain wave, but bosses stay bosses', () => {
    expect(getEndlessConfig(5).mode).toBe('normal'); // would be survival in the campaign
    expect(getEndlessConfig(8).mode).toBe('normal'); // bonus
    expect(getEndlessConfig(7).mode).toBe('normal'); // escort
    expect(getEndlessConfig(5).surviveFrames).toBe(0);
    expect(getEndlessConfig(9).mode).toBe('boss');
  });

  it('starts at wave 1 on the given level', () => {
    const s = createInitialState(5, loadout, true);
    expect(s.endless).toBe(true);
    expect(s.wave).toBe(1);
    expect(s.banner?.title).toBe('WAVE 1');
    expect(s.transport).toBeNull();
  });

  it('clearing the wave rolls into a harder one instead of ending the run', () => {
    const s = calm(createInitialState(4, loadout, true));
    s.plane.invulnerable = 1e9;
    s.hp = 3;
    s.bomb = 0;
    s.kills = s.config.killTarget;
    step(s);
    expect(s.status).toBe('playing');
    expect(s.wave).toBe(2);
    expect(s.level).toBe(5);
    expect(s.kills).toBe(0);
    expect(s.hp).toBe(4);
    expect(s.bomb).toBeGreaterThan(0);
    expect(s.banner?.title).toBe('WAVE 2');
    expect(s.config.level).toBe(5);
  });

  it('keeps counting total kills across waves', () => {
    const s = calm(createInitialState(1, loadout, true));
    s.enemies = [enemy(EnemyType.STANDARD, 600, 100, 0)];
    step(s);
    s.kills = s.config.killTarget;
    step(s);
    s.enemies = [enemy(EnemyType.STANDARD, 600, 100, 0)];
    step(s);
    expect(s.wave).toBe(2);
    expect(s.totalKills).toBe(2);
    expect(summarizeRun(s, false, 0)).toMatchObject({ kills: 2, endlessWave: 2 });
  });

  it('chains through a boss wave and restores normal speed afterwards', () => {
    const s = calm(createInitialState(3, loadout, true));
    s.plane.invulnerable = 1e9;
    s.kills = s.config.killTarget;
    step(s, 150);
    expect(s.boss).not.toBeNull();
    s.boss!.hp = 0;
    step(s, 130);
    expect(s.status).toBe('playing');
    expect(s.wave).toBe(2);
    expect(s.boss).toBeNull();
    expect(s.timeScale).toBe(1);
  });

  it('only ends when the hull is gone', () => {
    const s = calm(createInitialState(1, loadout, true));
    s.plane.invulnerable = 0;
    s.hp = 1;
    const def = PROJECTILES.bullet;
    s.enemyBullets.push({ kind: 'bullet', x: s.plane.x + 20, y: s.plane.y + 10, width: def.size.width, height: def.size.height, vx: 0, vy: 0, damage: 1, age: 0, maxSpeed: 0 });
    step(s);
    expect(s.status).toBe('lost');
  });

  it('pays a trickle and records the best wave', () => {
    expect(computeEndlessReward(2500)).toBe(100);
    let p = defaultProgress();
    expect(p.endlessBest).toEqual({ wave: 0, score: 0 });
    p = applyRunSummary(p, { endlessWave: 7 });
    p = applyRunSummary(p, { endlessWave: 4 });
    expect(p.lifetime.endlessWave).toBe(7);
  });
});

describe('escort levels', () => {
  const convoy = () => {
    const s = calm(createInitialState(7, loadout));
    s.plane.invulnerable = 1e9;
    return s;
  };
  // The convoy enters from off-screen; for hit tests put it mid-screen first
  const midScreen = (s: GameState) => { s.transport!.x = 300; return s; };

  it('spawn a friendly transport that has to cross the screen', () => {
    const s = convoy();
    expect(s.config.mode).toBe('escort');
    expect(s.transport?.hp).toBe(s.config.escortHp);
    expect(s.transport!.width).toBe(TRANSPORT_SIZE.width);
    expect(s.banner?.sub).toContain('CONVOY');
    const x0 = s.transport!.x;
    step(s, 60);
    expect(s.transport!.x).toBeGreaterThan(x0);
  });

  it('are won when the convoy reaches the far side, not by kills', () => {
    const s = convoy();
    s.kills = 9999;
    step(s, 100);
    expect(s.status).toBe('playing');
    s.transport!.x = SCREEN_WIDTH - 41;
    step(s, 120);
    expect(s.status).toBe('won');
  });

  it('crossing takes about 50 seconds', () => {
    const s = convoy();
    step(s, ESCORT_FRAMES - 200);
    expect(s.status).toBe('playing');
    step(s, 400);
    expect(s.status).toBe('won');
  });

  it('enemy shots hurt the convoy, and the escorted ship, not the player, takes them', () => {
    const s = midScreen(convoy());
    const t = s.transport!;
    const def = PROJECTILES.bullet;
    s.enemyBullets.push({ kind: 'bullet', x: t.x + 20, y: t.y + 10, width: def.size.width, height: def.size.height, vx: 0, vy: 0, damage: 1, age: 0, maxSpeed: 0 });
    step(s);
    expect(t.hp).toBe(s.config.escortHp - 1);
    expect(s.enemyBullets).toHaveLength(0);
    expect(s.hp).toBe(s.maxHp);
  });

  it('a rammer is destroyed and hurts the convoy', () => {
    const s = midScreen(convoy());
    const t = s.transport!;
    s.enemies.push(enemy(EnemyType.STANDARD, t.x + 10, t.y + 5));
    step(s);
    expect(s.enemies).toHaveLength(0);
    expect(t.hp).toBeLessThan(s.config.escortHp);
  });

  it('losing the convoy ends the mission with its own reason, and a continue repairs it', () => {
    const s = midScreen(convoy());
    s.transport!.hp = 1;
    const def = PROJECTILES.bullet;
    s.enemyBullets.push({ kind: 'bullet', x: s.transport!.x + 20, y: s.transport!.y + 10, width: def.size.width, height: def.size.height, vx: 0, vy: 0, damage: 1, age: 0, maxSpeed: 0 });
    step(s);
    expect(s.status).toBe('lost');
    expect(s.failReason).toBe('convoy');
    revivePlayer(s);
    expect(s.status).toBe('playing');
    expect(s.transport!.hp).toBe(s.transport!.maxHp);
    expect(s.failReason).toBe('hull');
  });

  it('are a tougher spawn pace and carry a map tag', () => {
    const base = getLevelConfig(13);
    const esc = applyMode(base);
    expect(esc.maxEnemies).toBe(base.maxEnemies + 1);
    expect(isSpecialMode('escort')).toBe(true);
    expect(isSpecialMode('boss')).toBe(false);
    expect(levelMode(13)).toBe('escort');
  });
});

describe('ground turret', () => {
  it('appears from level 11 and is bolted to the ground', () => {
    expect(getLevelConfig(10).roster.some(r => r.type === EnemyType.TURRET)).toBe(false);
    expect(getLevelConfig(11).roster.some(r => r.type === EnemyType.TURRET)).toBe(true);
    const s = createInitialState(11, loadout);
    s.plane.invulnerable = 1e9;
    s.config.roster = [{ type: EnemyType.TURRET, weight: 1, max: 1 }];
    s.spawnTimer = 1;
    step(s);
    const t = s.enemies.find(e => e.type === EnemyType.TURRET)!;
    expect(t).toBeDefined();
    expect(t.y + t.height).toBeGreaterThan(s.plane.y + 200 - 1); // sits low on the screen
  });

  it('scrolls with the ground and shoots up at the player', () => {
    const s = calm(createInitialState(11, loadout));
    s.plane.invulnerable = 1e9;
    const t = enemy(EnemyType.TURRET, SCREEN_WIDTH - 60, 650);
    s.enemies = [t];
    const x0 = t.x;
    step(s, 5);
    expect(t.x).toBeLessThan(x0 - 10);
    s.enemyBullets = [];
    t.lastFiredFrame = -999;
    t.x = SCREEN_WIDTH - 100;
    step(s);
    expect(s.enemyBullets.length).toBe(1);
    expect(s.enemyBullets[0].vy).toBeLessThan(0); // aimed upward
  });
});

describe('mission complete preview', () => {
  it('lists missions a run would finish, only once', () => {
    let p = defaultProgress();
    const day = new Date(2026, 9, 10, 12);
    p = applyRunSummary(p, {}, day);
    const first = p.missions!.items[0];
    const done = completedMissions(p, { [first.stat]: 9999 }, day);
    expect(done).toContain(first.label);
    const after = applyRunSummary(p, { [first.stat]: 9999 }, day);
    expect(completedMissions(after, { [first.stat]: 9999 }, day)).not.toContain(first.label);
  });
});
