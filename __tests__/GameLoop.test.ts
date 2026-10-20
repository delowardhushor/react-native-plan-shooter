import { createInitialState, updateGameState, revivePlayer, type GameState } from '../src/engine/GameLoop';
import { BOSS_DEFS } from '../src/engine/Enemies';
import { armorMaxHp, medicHeal } from '../src/engine/Armor';
import { HIT_INVULNERABLE_FRAMES } from '../src/engine/Constants';
import { PROJECTILES } from '../src/engine/Projectiles';

const noSound = () => {};
const loadout = (armor = 1) => ({ maxHp: armorMaxHp(armor), cannon: 1, missile: 'homing' as const, missileLevel: 1 });

const step = (s: GameState, frames = 1) => {
  for (let i = 0; i < frames; i++) updateGameState(s, noSound);
};

// A plain enemy bullet sitting right on the player's fuselage
const shootPlayer = (s: GameState, kind: 'bullet' | 'orb' = 'bullet') => {
  const def = PROJECTILES[kind];
  s.enemyBullets.push({
    kind, x: s.plane.x + 20, y: s.plane.y + 10, width: def.size.width, height: def.size.height,
    vx: 0, vy: 0, damage: def.damage, age: 0, maxSpeed: 0,
  });
};

describe('hit points', () => {
  it('starts with the armor-based hull', () => {
    expect(createInitialState(1, loadout(1)).hp).toBe(5);
    expect(createInitialState(1, loadout(3)).maxHp).toBe(9);
  });

  it('a hit costs the shot damage, then grants brief invulnerability', () => {
    const s = createInitialState(1, loadout());
    s.plane.invulnerable = 0;
    shootPlayer(s);
    step(s);
    expect(s.hp).toBe(4);
    expect(s.status).toBe('playing');
    expect(s.plane.alive).toBe(true);
    expect(s.plane.invulnerable).toBeGreaterThan(HIT_INVULNERABLE_FRAMES - 3);

    shootPlayer(s);
    step(s);
    expect(s.hp).toBe(4); // protected while invulnerable
  });

  it('heavy shots hurt more', () => {
    const s = createInitialState(1, loadout());
    s.plane.invulnerable = 0;
    shootPlayer(s, 'orb');
    step(s);
    expect(s.hp).toBe(3);
  });

  it('losing the last hit point ends the run and continue restores everything', () => {
    const s = createInitialState(1, loadout());
    s.plane.invulnerable = 0;
    s.hp = 1;
    shootPlayer(s);
    step(s);
    expect(s.hp).toBe(0);
    expect(s.status).toBe('lost');
    expect(s.plane.alive).toBe(false);

    s.score = 120;
    revivePlayer(s);
    expect(s.status).toBe('playing');
    expect(s.hp).toBe(s.maxHp);
    expect(s.plane.alive).toBe(true);
    expect(s.plane.invulnerable).toBeGreaterThan(100);
    expect(s.score).toBe(120);
    step(s, 30);
    expect(s.hp).toBe(s.maxHp);
  });
});

describe('medic pickups', () => {
  it('drifts left to right and heals on contact', () => {
    const s = createInitialState(1, loadout(1));
    s.hp = 1;
    s.pickupTimer = 1;
    step(s);
    expect(s.pickups).toHaveLength(1);
    const x0 = s.pickups[0].x;
    step(s, 10);
    expect(s.pickups[0].x).toBeGreaterThan(x0);

    const p = s.pickups[0];
    s.plane.x = p.x;
    s.plane.y = p.y;
    s.plane.vx = 0;
    s.plane.vy = 0;
    step(s);
    expect(s.pickups).toHaveLength(0);
    expect(s.hp).toBe(1 + medicHeal(5));
  });

  it('never heals past the maximum', () => {
    const s = createInitialState(1, loadout(1));
    s.hp = s.maxHp - 1;
    s.pickups.push({ x: s.plane.x, y: s.plane.y, width: 28, height: 28, baseY: s.plane.y, age: 0 });
    step(s);
    expect(s.hp).toBe(s.maxHp);
  });

  it('does not spawn while the hull is full', () => {
    const s = createInitialState(1, loadout());
    s.pickupTimer = 1;
    step(s);
    expect(s.pickups).toHaveLength(0);
  });
});

describe('boss weapons', () => {
  BOSS_DEFS.forEach((def, i) => {
    it(`${def.name} fires ${def.weapon}`, () => {
      const s = createInitialState((i + 1) * 3, loadout(5));
      s.config.maxEnemies = 0;
      s.kills = s.config.killTarget;
      s.plane.invulnerable = 1e9; // observe the pattern, don't die
      const kinds = new Set<string>();
      for (let f = 0; f < 1500; f++) {
        step(s);
        s.enemyBullets.forEach(b => kinds.add(b.kind));
      }
      expect(s.boss?.kind).toBe(i);
      expect(kinds.has(def.weapon)).toBe(true);
    });
  });
});

describe('seeker drones', () => {
  it('home in on the player and can be shot down', () => {
    const s = createInitialState(1, loadout());
    s.plane.invulnerable = 1e9;
    const def = PROJECTILES.seeker;
    s.enemyBullets.push({
      kind: 'seeker', x: 400, y: 20, width: def.size.width, height: def.size.height,
      vx: -2, vy: 0, damage: 1, age: 0, maxSpeed: 2.5,
    });
    const y0 = s.enemyBullets[0].y;
    step(s, 40);
    expect(s.enemyBullets[0].y).toBeGreaterThan(y0); // bent toward the player below it

    const seeker = s.enemyBullets[0];
    s.bullets.push({ x: seeker.x, y: seeker.y, width: 14, height: 4, vx: 0, vy: 0, damage: 1 });
    step(s);
    expect(s.enemyBullets.filter(b => b.kind === 'seeker')).toHaveLength(0);
  });
});
