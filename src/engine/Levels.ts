export const BOSS_EVERY = 3;

export interface LevelConfig {
  level: number;
  isBoss: boolean;
  bossIndex: number;        // 1 for the first boss, 2 for the second...
  killTarget: number;       // enemies to destroy (before the boss appears on boss levels)
  spawnInterval: number;    // frames between spawn attempts
  maxEnemies: number;       // on screen at once
  roamerChance: number;
  maxRoamers: number;
  enemySpeed: number;
  roamerFireRate: number;   // frames between roamer shots
  enemyBulletSpeed: number;
  bossHp: number;
}

export const isBossLevel = (level: number) => level % BOSS_EVERY === 0;

// Deliberately gentle: few, slow enemies so each level is about learning and positioning
export const getLevelConfig = (level: number): LevelConfig => {
  const isBoss = isBossLevel(level);
  const bossIndex = Math.floor(level / BOSS_EVERY);
  return {
    level,
    isBoss,
    bossIndex,
    killTarget: isBoss ? 6 : Math.min(8 + level * 2, 26),
    spawnInterval: Math.max(80, 130 - level * 4),
    maxEnemies: Math.min(3 + Math.floor(level / 2), 5),
    roamerChance: level >= 2 ? Math.min(0.15 + level * 0.03, 0.4) : 0,
    maxRoamers: Math.min(1 + Math.floor(level / 3), 2),
    enemySpeed: Math.min(1.1 + level * 0.06, 1.9),
    roamerFireRate: Math.max(100, 170 - level * 5),
    enemyBulletSpeed: Math.min(3.4 + level * 0.1, 4.6),
    bossHp: 45 + (bossIndex - 1) * 20,
  };
};
