import { EnemyType } from './Enemies';

export const BOSS_EVERY = 3;

// From this level on the difficulty keeps climbing instead of levelling off
export const HARD_FROM = 13;

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
  enemyHpMul: number;       // multiplies every enemy's hit points
  bossHp: number;
}

export const isBossLevel = (level: number) => level % BOSS_EVERY === 0;

// The level each enemy plane first shows up on
export const ENEMY_UNLOCK_LEVEL: Partial<Record<EnemyType, number>> = {
  [EnemyType.ROAMER]: 2,
  [EnemyType.WAVER]: 2,
  [EnemyType.RUSHER]: 4,
  [EnemyType.SNIPER]: 5,
  [EnemyType.BOMBER]: 7,
  [EnemyType.AEGIS]: 13,
  [EnemyType.SWARM]: 16,
  [EnemyType.MINELAYER]: 19,
};

// Enemy planes that make their first appearance on exactly this level
export const newEnemiesAt = (level: number): EnemyType[] =>
  (Object.entries(ENEMY_UNLOCK_LEVEL) as [string, number][])
    .filter(([, unlock]) => unlock === level)
    .map(([type]) => Number(type) as EnemyType);

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
  if (level >= 13) roster.push({ type: EnemyType.AEGIS, weight: 3, max: level >= 19 ? 3 : 2 });
  if (level >= 16) roster.push({ type: EnemyType.SWARM, weight: 3, max: 8 });
  if (level >= 19) roster.push({ type: EnemyType.MINELAYER, weight: 2, max: 1 });
  return roster;
};

// Gentle at first so each level is about learning and positioning; from HARD_FROM everything keeps
// scaling (more, faster, tougher enemies) up to generous caps
export const getLevelConfig = (level: number): LevelConfig => {
  const isBoss = isBossLevel(level);
  const bossIndex = Math.floor(level / BOSS_EVERY);
  const hard = Math.max(0, level - (HARD_FROM - 1));
  return {
    level,
    isBoss,
    bossIndex,
    killTarget: isBoss ? 6 : Math.min(8 + level * 2, 26) + Math.min(10, hard),
    spawnInterval: Math.max(80, 130 - level * 4) - Math.min(30, hard * 2),
    maxEnemies: Math.min(3 + Math.floor(level / 2), 5) + Math.min(3, Math.floor(hard / 4)),
    roster: buildRoster(level),
    enemySpeed: Math.min(1.1 + level * 0.06, 1.9) + Math.min(0.8, hard * 0.03),
    roamerFireRate: Math.max(100, 170 - level * 5) - Math.min(40, hard * 2),
    enemyBulletSpeed: Math.min(3.4 + level * 0.1, 4.6) + Math.min(1, hard * 0.04),
    enemyHpMul: 1 + Math.min(4, hard * 0.08),
    bossHp: Math.round((45 + (bossIndex - 1) * 20) * (1 + Math.min(2, hard * 0.03))),
  };
};
