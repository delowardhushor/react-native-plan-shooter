import { EnemyType } from './Enemies';

export const BOSS_EVERY = 3;

export interface SpawnEntry {
  type: EnemyType;
  weight: number;
  max: number; // on screen at once
}

export interface LevelConfig {
  level: number;
  isBoss: boolean;
  bossIndex: number;        // 1 for the first boss, 2 for the second...
  killTarget: number;       // enemies to destroy (before the boss appears on boss levels)
  spawnInterval: number;    // frames between spawn attempts
  maxEnemies: number;       // on screen at once
  roster: SpawnEntry[];     // which enemy planes can appear this level
  enemySpeed: number;
  roamerFireRate: number;   // base frames between enemy shots
  enemyBulletSpeed: number;
  bossHp: number;
}

export const isBossLevel = (level: number) => level % BOSS_EVERY === 0;

// New enemy planes are introduced one at a time so each can be learned before the next arrives
const buildRoster = (level: number): SpawnEntry[] => {
  const roster: SpawnEntry[] = [{ type: EnemyType.STANDARD, weight: 10, max: 99 }];
  if (level >= 2) {
    roster.push({ type: EnemyType.ROAMER, weight: Math.min(2 + level, 6), max: Math.min(1 + Math.floor(level / 3), 2) });
    roster.push({ type: EnemyType.WAVER, weight: Math.min(3 + level, 7), max: 2 });
  }
  if (level >= 4) roster.push({ type: EnemyType.RUSHER, weight: Math.min(level, 6), max: 2 });
  if (level >= 5) roster.push({ type: EnemyType.SNIPER, weight: 3, max: level >= 10 ? 2 : 1 });
  if (level >= 7) roster.push({ type: EnemyType.BOMBER, weight: 3, max: 1 });
  return roster;
};

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
    roster: buildRoster(level),
    enemySpeed: Math.min(1.1 + level * 0.06, 1.9),
    roamerFireRate: Math.max(100, 170 - level * 5),
    enemyBulletSpeed: Math.min(3.4 + level * 0.1, 4.6),
    bossHp: 45 + (bossIndex - 1) * 20,
  };
};
