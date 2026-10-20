import { ENEMY_SIZE, ROAMER_SIZE, ENEMY_STANDARD_HP, ENEMY_ROAMER_HP } from './Constants';

export enum EnemyType {
  STANDARD = 0, // plain jet, flies straight
  ROAMER = 1,   // gunship that parks on the right and strafes up and down
  WAVER = 2,    // fast fighter weaving on a sine path
  RUSHER = 3,   // tracks the player, locks on, then dashes
  SNIPER = 4,   // hangs back and fires aimed shots
  BOMBER = 5,   // slow, heavy, fires spread volleys
}

export interface EnemyDef {
  size: { width: number; height: number };
  hp: number;
  score: number;
  boom: number; // explosion scale when destroyed
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  [EnemyType.STANDARD]: { size: ENEMY_SIZE, hp: ENEMY_STANDARD_HP, score: 10, boom: 1 },
  [EnemyType.ROAMER]: { size: ROAMER_SIZE, hp: ENEMY_ROAMER_HP, score: 50, boom: 1.5 },
  [EnemyType.WAVER]: { size: { width: 44, height: 22 }, hp: 2, score: 20, boom: 1.1 },
  [EnemyType.RUSHER]: { size: { width: 44, height: 18 }, hp: 2, score: 30, boom: 1.1 },
  [EnemyType.SNIPER]: { size: { width: 58, height: 22 }, hp: 3, score: 40, boom: 1.3 },
  [EnemyType.BOMBER]: { size: { width: 84, height: 38 }, hp: 10, score: 80, boom: 2 },
};

export interface BossDef {
  name: string;
  size: { width: number; height: number };
  hpMul: number;
  muzzleY: number;      // where bullets leave the hull, as a fraction of its height
  ownEscorts: boolean;  // launches its own escorts instead of getting random reinforcements
}

// Each boss has its own hull, movement and attack pattern; after the last one the cycle repeats tougher
export const BOSS_DEFS: BossDef[] = [
  { name: 'WARHAWK', size: { width: 150, height: 78 }, hpMul: 1, muzzleY: 0.56, ownEscorts: false },
  { name: 'IRON WHALE', size: { width: 188, height: 84 }, hpMul: 1.15, muzzleY: 0.54, ownEscorts: true },
  { name: 'PHANTOM', size: { width: 144, height: 60 }, hpMul: 0.9, muzzleY: 0.5, ownEscorts: false },
  { name: 'TITAN', size: { width: 164, height: 90 }, hpMul: 1.3, muzzleY: 0.5, ownEscorts: false },
];

export const bossKindFor = (bossIndex: number) => (Math.max(1, bossIndex) - 1) % BOSS_DEFS.length;
