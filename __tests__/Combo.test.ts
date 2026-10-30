import { COMBO_WINDOW, comboMultiplier, createInitialState, updateGameState, type GameState } from '../src/engine/GameLoop';
import { EnemyType, ENEMY_DEFS } from '../src/engine/Enemies';
import { armorMaxHp } from '../src/engine/Armor';

const noSound = () => {};
const loadout = { maxHp: armorMaxHp(1), cannon: 1, missile: 'homing' as const, missileLevel: 1 };

const step = (s: GameState, frames = 1) => {
  for (let i = 0; i < frames; i++) updateGameState(s, noSound);
};

// A plain jet that is already destroyed, so the next update scores it
const killStandard = (s: GameState) => {
  const def = ENEMY_DEFS[EnemyType.STANDARD];
  s.enemies.push({
    type: EnemyType.STANDARD, x: 600, y: 100, width: def.size.width, height: def.size.height,
    hp: 0, maxHp: def.hp, vy: 0, lastFiredFrame: 0, targetX: 0, hitFlash: 0, age: 0, baseY: 100, mode: 0, timer: 0, charge: 0,
  });
  step(s);
};

const quietLevel = () => {
  const s = createInitialState(1, loadout);
  s.config.maxEnemies = 0;
  s.plane.invulnerable = 1e9;
  return s;
};

describe('combo', () => {
  it('multiplier steps up every five kills and caps at x4', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(2);
    expect(comboMultiplier(10)).toBe(3);
    expect(comboMultiplier(15)).toBe(4);
    expect(comboMultiplier(99)).toBe(4);
  });

  it('multiplies the score once the streak reaches five', () => {
    const s = quietLevel();
    for (let i = 0; i < 4; i++) killStandard(s);
    expect(s.score).toBe(40);
    killStandard(s); // 5th kill is worth x2
    expect(s.score).toBe(40 + 20);
    expect(s.bestCombo).toBe(5);
  });

  it('drops the streak when the window runs out', () => {
    const s = quietLevel();
    killStandard(s);
    killStandard(s);
    expect(s.combo).toBe(2);
    step(s, COMBO_WINDOW + 1);
    expect(s.combo).toBe(0);
    expect(s.bestCombo).toBe(2);
  });

  it('shows a popup for each kill and clears it after it floats away', () => {
    const s = quietLevel();
    killStandard(s);
    expect(s.popups).toHaveLength(1);
    expect(s.popups[0].text).toBe('+10');
    step(s, 60);
    expect(s.popups).toHaveLength(0);
  });
});
