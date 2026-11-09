import { createInitialState, updateGameState, revivePlayer, bombCharge, ON_FIRE_COMBO, SALVO_EVERY, type GameState } from '../src/engine/GameLoop';
import { BOSS_DEFS, EnemyType } from '../src/engine/Enemies';
import { POWERUPS } from '../src/engine/PowerUps';
import { BOMB_MAX, BOMB_PER_KILL } from '../src/engine/Bomb';
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
    const roll = jest.spyOn(Math, 'random').mockReturnValue(0.1); // the drop roll succeeds
    const s = createInitialState(1, loadout(1));
    s.hp = 1;
    s.pickupTimer = 1;
    step(s);
    roll.mockRestore();
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
    s.pickups.push({ kind: 'medic', vx: 1.1, x: s.plane.x, y: s.plane.y, width: 28, height: 28, baseY: s.plane.y, age: 0 });
    step(s);
    expect(s.hp).toBe(s.maxHp);
  });

  it('is a random drop: a failed roll spawns nothing and waits a long time before rolling again', () => {
    const roll = jest.spyOn(Math, 'random').mockReturnValue(0.99); // the drop roll fails
    const s = createInitialState(1, loadout(1));
    s.hp = 1;
    s.pickupTimer = 1;
    step(s);
    expect(s.pickups).toHaveLength(0);
    expect(s.pickupTimer).toBeGreaterThanOrEqual(590);
    step(s, 300); // being hurt must not make one show up straight away
    roll.mockRestore();
    expect(s.pickups).toHaveLength(0);
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

describe('power-ups', () => {
  const crate = (s: GameState, kind: 'rapid' | 'shield' | 'pierce' | 'wingman') =>
    s.pickups.push({ kind, vx: -1.3, x: s.plane.x, y: s.plane.y, width: 28, height: 28, baseY: s.plane.y, age: 0 });

  const killEnemy = (s: GameState, big = false) => {
    s.enemies.push({
      type: big ? EnemyType.BOMBER : EnemyType.STANDARD, kind: 'bullet', x: 600, y: 120,
      width: 44, height: 22, vx: 0, vy: 0, hp: 0, maxHp: 1, damage: 1, age: 0, maxSpeed: 0, mode: 0,
      timer: 0, baseY: 120, hitFlash: 0, lastFiredFrame: 0,
    } as any);
    step(s);
  };

  it('picking one up starts its timer and removes the crate', () => {
    const s = createInitialState(1, loadout());
    crate(s, 'rapid');
    step(s);
    expect(s.pickups).toHaveLength(0);
    expect(s.powerUps.rapid).toBeGreaterThan(POWERUPS.rapid.duration - 3);
  });

  it('expires after its duration', () => {
    const s = createInitialState(1, loadout());
    s.powerUps.pierce = 5;
    step(s, 5);
    expect(s.powerUps.pierce).toBe(0);
  });

  it('rapid fire shoots faster', () => {
    const volleys = (rapid: boolean) => {
      const s = createInitialState(1, loadout());
      if (rapid) s.powerUps.rapid = 9999;
      s.enemies = [];
      s.spawnTimer = 99999;
      let n = 0;
      let last = s.lastFiredFrame;
      for (let i = 0; i < 120; i++) { step(s); if (s.lastFiredFrame !== last) { n++; last = s.lastFiredFrame; } }
      return n;
    };
    expect(volleys(true)).toBeGreaterThan(volleys(false));
  });

  it('a shield absorbs one hit, pops, and keeps the combo', () => {
    const s = createInitialState(1, loadout());
    s.plane.invulnerable = 0;
    s.combo = 7;
    s.powerUps.shield = 500;
    shootPlayer(s);
    step(s);
    expect(s.hp).toBe(s.maxHp);
    expect(s.powerUps.shield).toBe(0);
    expect(s.combo).toBeGreaterThanOrEqual(7);
    expect(s.plane.invulnerable).toBeGreaterThan(0);
  });

  it('overdrive rounds pierce through several enemies', () => {
    const s = createInitialState(1, loadout());
    s.powerUps.pierce = 9999;
    s.spawnTimer = 99999;
    const mk = (x: number) => ({
      type: EnemyType.ROAMER, kind: 'bullet', x, y: s.plane.y, width: 64, height: 34, vx: 0, vy: 0, hp: 50, maxHp: 50,
      damage: 1, age: 0, maxSpeed: 0, mode: 0, timer: 0, baseY: s.plane.y, hitFlash: 0, lastFiredFrame: 0,
    } as any);
    s.enemies = [mk(140), mk(205)];
    step(s, 40);
    expect(s.enemies[0].hp).toBeLessThan(50);
    expect(s.enemies[1].hp).toBeLessThan(50);
    expect(s.bullets.some(b => b.hits)).toBe(true);
  });

  it('wingmen add extra shots per volley', () => {
    const volley = (wing: boolean) => {
      const s = createInitialState(1, loadout());
      if (wing) s.powerUps.wingman = 9999;
      s.spawnTimer = 99999;
      s.lastFiredFrame = -999;
      step(s);
      return s.bullets.length;
    };
    expect(volley(true)).toBe(volley(false) + 2);
  });

  it('a long dry spell guarantees a drop, and only one floats at a time', () => {
    const s = createInitialState(1, loadout());
    s.spawnTimer = 99999;
    s.dropPity = 1000;
    killEnemy(s);
    expect(s.pickups.filter(p => p.kind !== 'medic')).toHaveLength(1);
    s.dropPity = 1000;
    killEnemy(s);
    expect(s.pickups.filter(p => p.kind !== 'medic')).toHaveLength(1);
  });

  it('dropped crates drift left and eventually leave the screen', () => {
    const s = createInitialState(1, loadout());
    s.spawnTimer = 99999;
    s.dropPity = 1000;
    killEnemy(s);
    const p = s.pickups[0];
    const x0 = p.x;
    s.plane.y = 400; // out of the way
    step(s, 20);
    expect(p.x).toBeLessThan(x0);
    step(s, 600);
    expect(s.pickups).toHaveLength(0);
  });
});

const plainEnemy = (x: number, y: number, hp = 1, type = EnemyType.STANDARD) => ({
  type, kind: 'bullet', x, y, width: 44, height: 22, vx: 0, vy: 0, hp, maxHp: hp, damage: 1, age: 0, maxSpeed: 0,
  mode: 0, timer: 0, baseY: y, hitFlash: 0, lastFiredFrame: 0,
} as any);

describe('bomb', () => {
  const quiet = (s: GameState) => { s.spawnTimer = 99999; s.pickupTimer = 99999; s.enemies = []; };

  it('starts partly charged and fills from kills', () => {
    const s = createInitialState(1, loadout());
    quiet(s);
    const start = s.bomb;
    expect(start).toBeGreaterThan(0);
    expect(bombCharge(s)).toBeLessThan(1);
    s.enemies.push(plainEnemy(600, 100, 0));
    step(s);
    expect(s.bomb).toBe(start + BOMB_PER_KILL);
  });

  it('does nothing until fully charged', () => {
    const s = createInitialState(1, loadout());
    quiet(s);
    s.bomb = BOMB_MAX - 1;
    s.enemies.push(plainEnemy(600, 100, 5));
    s.bombRequested = true;
    step(s);
    expect(s.enemies).toHaveLength(1);
    expect(s.bomb).toBe(BOMB_MAX - 1);
    expect(s.bombRequested).toBe(false);
  });

  it('wipes enemy shots, destroys enemies, and resets the charge without recharging from its own kills', () => {
    const s = createInitialState(1, loadout());
    quiet(s);
    s.bomb = BOMB_MAX;
    s.enemies.push(plainEnemy(500, 80, 8), plainEnemy(620, 200, 8));
    shootPlayer(s);
    s.enemyBullets[0].x = 700;
    s.bombRequested = true;
    step(s);
    expect(s.enemyBullets).toHaveLength(0);
    expect(s.enemies).toHaveLength(0);
    expect(s.kills).toBe(2);
    expect(s.bomb).toBe(0);
    expect(s.plane.invulnerable).toBeGreaterThan(30);
    expect(s.flash).toBeGreaterThan(0);
  });

  it('takes a chunk out of a boss without killing it', () => {
    const s = createInitialState(3, loadout());
    s.spawnTimer = 99999;
    s.bossState = 1;
    s.bossTimer = 1;
    step(s, 3);
    expect(s.boss).not.toBeNull();
    const full = s.boss!.hp;
    s.boss!.entered = true;
    s.bomb = BOMB_MAX;
    s.bombRequested = true;
    step(s);
    expect(s.boss!.hp).toBeLessThan(full);
    expect(s.boss!.hp).toBeGreaterThan(0);
  });

  it('trickles a charge while a boss is on screen', () => {
    const s = createInitialState(3, loadout());
    s.spawnTimer = 99999;
    s.bossState = 1;
    s.bossTimer = 1;
    step(s, 3);
    const before = s.bomb;
    step(s, 60);
    expect(s.bomb).toBeGreaterThan(before);
  });
});

describe('combo perks', () => {
  const quiet = (s: GameState) => { s.spawnTimer = 99999; s.pickupTimer = 99999; s.enemies = []; };

  it('a hot streak fires faster', () => {
    const fired = (combo: number) => {
      const s = createInitialState(1, loadout());
      quiet(s);
      s.combo = combo;
      s.comboTimer = 99999;
      let n = 0;
      let last = s.lastFiredFrame;
      for (let i = 0; i < 200; i++) { step(s); if (s.lastFiredFrame !== last) { n++; last = s.lastFiredFrame; } }
      return n;
    };
    expect(fired(ON_FIRE_COMBO)).toBeGreaterThan(fired(0));
  });

  it('reaching the on-fire streak celebrates', () => {
    const s = createInitialState(1, loadout());
    quiet(s);
    s.combo = ON_FIRE_COMBO - 1;
    s.comboTimer = 100;
    s.enemies.push(plainEnemy(600, 100, 0));
    step(s);
    expect(s.popups.some(p => p.text === 'ON FIRE!')).toBe(true);
  });

  it('every salvo milestone launches free homing missiles', () => {
    const s = createInitialState(1, loadout());
    quiet(s);
    s.combo = SALVO_EVERY - 1;
    s.comboTimer = 100;
    s.enemies.push(plainEnemy(600, 100, 0));
    step(s);
    expect(s.missiles.length).toBe(4);
    expect(s.missiles.every(m => m.type === 'homing')).toBe(true);
  });

  it('losing a big streak to the timer says so; a small one does not', () => {
    const lose = (combo: number) => {
      const s = createInitialState(1, loadout());
      quiet(s);
      s.combo = combo;
      s.comboTimer = 1;
      step(s);
      return { s, lost: s.popups.some(p => p.text === 'COMBO LOST') };
    };
    const big = lose(ON_FIRE_COMBO);
    expect(big.lost).toBe(true);
    expect(big.s.combo).toBe(0);
    expect(lose(3).lost).toBe(false);
  });
});

describe('boss rage phases and hit-stop', () => {
  const bossFight = () => {
    const s = createInitialState(3, loadout(3));
    s.spawnTimer = 99999;
    s.pickupTimer = 99999;
    s.bossState = 1;
    s.bossTimer = 1;
    step(s, 3);
    s.boss!.entered = true;
    s.boss!.x = s.boss!.targetX;
    s.plane.invulnerable = 99999;
    return s;
  };

  it('goes into a rage cutscene at half hull: bullets cleared, invulnerable, banner', () => {
    const s = bossFight();
    shootPlayer(s);
    s.boss!.hp = s.boss!.maxHp * 0.45;
    step(s);
    expect(s.boss!.stage).toBe(1);
    expect(s.boss!.transition).toBeGreaterThan(0);
    expect(s.banner?.title).toBe('ENRAGED!');
    expect(s.enemyBullets).toHaveLength(0);
  });

  it('cannot be damaged, and does not fire, during the cutscene', () => {
    const s = bossFight();
    s.boss!.hp = s.boss!.maxHp * 0.45;
    step(s);
    const hp = s.boss!.hp;
    s.bomb = 100;
    s.bombRequested = true;
    s.missiles.push({ type: 'homing', x: s.boss!.x + 10, y: s.boss!.y + 10, width: 28, height: 8, vx: 0, vy: 0, damage: 4, radius: 0, speed: 11, hits: [] });
    step(s, 20);
    expect(s.boss!.hp).toBe(hp);
    expect(s.enemyBullets).toHaveLength(0);
    step(s, 80);
    expect(s.boss!.transition).toBe(0);
    s.boss!.hp = hp;
    s.missiles.push({ type: 'homing', x: s.boss!.x + 10, y: s.boss!.y + 10, width: 28, height: 8, vx: 0, vy: 0, damage: 4, radius: 0, speed: 11, hits: [] });
    step(s);
    expect(s.boss!.hp).toBeLessThan(hp);
  });

  it('has a second rage at the last fifth, and each rage only happens once', () => {
    const s = bossFight();
    s.boss!.hp = s.boss!.maxHp * 0.45;
    step(s, 90);
    expect(s.boss!.stage).toBe(1);
    step(s, 60);
    expect(s.boss!.stage).toBe(1);
    s.boss!.hp = s.boss!.maxHp * 0.15;
    step(s);
    expect(s.boss!.stage).toBe(2);
    expect(s.banner?.title).toBe('FINAL STAND');
    step(s, 90);
    step(s, 60);
    expect(s.boss!.stage).toBe(2);
  });

  it('big kills freeze the game briefly for impact', () => {
    const s = createInitialState(7, loadout());
    s.spawnTimer = 99999;
    s.pickupTimer = 99999;
    s.enemies = [plainEnemy(600, 100, 0, EnemyType.BOMBER)];
    step(s);
    expect(s.hitStop).toBeGreaterThan(0);
    const frame = s.frameCount;
    step(s, 2);
    expect(s.frameCount).toBe(frame);
    step(s, 5);
    expect(s.frameCount).toBeGreaterThan(frame);
  });

  it('taking a hit freezes the game for a moment too', () => {
    const s = createInitialState(1, loadout());
    s.spawnTimer = 99999;
    s.plane.invulnerable = 0;
    shootPlayer(s);
    step(s);
    expect(s.hitStop).toBeGreaterThan(0);
  });
});
