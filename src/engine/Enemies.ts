import type { ProjectileKind } from './Projectiles';
import { ENEMY_SIZE, ROAMER_SIZE, ENEMY_STANDARD_HP, ENEMY_ROAMER_HP } from './Constants';

export enum EnemyType {
  STANDARD = 0, // plain jet, flies straight
  ROAMER = 1,   // gunship that parks on the right and strafes up and down
  WAVER = 2,    // fast fighter weaving on a sine path
  RUSHER = 3,   // tracks the player, locks on, then dashes
  SNIPER = 4,   // hangs back and fires aimed shots
  BOMBER = 5,   // slow, heavy, fires spread volleys
  AEGIS = 6,    // armoured fighter behind an energy shield; the shield drops at half health
  SWARM = 7,    // small, fast drones that arrive in a weaving V and ram
  MINELAYER = 8, // slow carrier that seeds the screen with drifting plasma mines
  SPLITTER = 9,  // tough hull that breaks into two swarm drones when destroyed
  TELEPORTER = 10, // blinks into the player's lane (after a warning) and fires a volley
  TURRET = 11,   // anti-air gun: ground emplacement that scrolls past with the terrain and fires up at the player
  TANK = 12,     // ground vehicle that lobs rockets at the player
  SAM = 13,      // ground launcher that fires slow homing missiles (which can be shot down)
  TOWER = 14,    // tall flak tower: tough, and a wall to fly over
  DIVER = 15,    // ambush: drops in from the top of the screen on a line to where the player was
  INTERCEPTOR = 16, // ambush: sweeps in from behind (the left edge), firing as it passes the player
}

export const ENEMY_NAMES: Record<EnemyType, string> = {
  [EnemyType.STANDARD]: 'FIGHTER',
  [EnemyType.ROAMER]: 'GUNSHIP',
  [EnemyType.WAVER]: 'WAVER',
  [EnemyType.RUSHER]: 'RUSHER',
  [EnemyType.SNIPER]: 'SNIPER',
  [EnemyType.BOMBER]: 'BOMBER',
  [EnemyType.AEGIS]: 'AEGIS',
  [EnemyType.SWARM]: 'SWARM',
  [EnemyType.MINELAYER]: 'MINELAYER',
  [EnemyType.SPLITTER]: 'SPLITTER',
  [EnemyType.TELEPORTER]: 'TELEPORTER',
  [EnemyType.TURRET]: 'AA GUN',
  [EnemyType.TANK]: 'TANK',
  [EnemyType.SAM]: 'SAM SITE',
  [EnemyType.TOWER]: 'FLAK TOWER',
  [EnemyType.DIVER]: 'DIVER',
  [EnemyType.INTERCEPTOR]: 'INTERCEPTOR',
};

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
  [EnemyType.AEGIS]: { size: { width: 64, height: 30 }, hp: 8, score: 90, boom: 1.6 },
  [EnemyType.SWARM]: { size: { width: 30, height: 13 }, hp: 1, score: 12, boom: 0.7 },
  [EnemyType.MINELAYER]: { size: { width: 76, height: 34 }, hp: 9, score: 100, boom: 1.8 },
  [EnemyType.SPLITTER]: { size: { width: 54, height: 26 }, hp: 5, score: 60, boom: 1.3 },
  [EnemyType.TELEPORTER]: { size: { width: 46, height: 22 }, hp: 4, score: 70, boom: 1.2 },
  [EnemyType.TURRET]: { size: { width: 42, height: 26 }, hp: 4, score: 50, boom: 1.1 },
  [EnemyType.TANK]: { size: { width: 56, height: 28 }, hp: 4, score: 70, boom: 1.4 },
  [EnemyType.SAM]: { size: { width: 40, height: 34 }, hp: 4, score: 80, boom: 1.3 },
  [EnemyType.TOWER]: { size: { width: 34, height: 90 }, hp: 8, score: 100, boom: 1.8 },
  [EnemyType.DIVER]: { size: { width: 40, height: 18 }, hp: 2, score: 25, boom: 0.9 },
  [EnemyType.INTERCEPTOR]: { size: { width: 46, height: 20 }, hp: 3, score: 40, boom: 1.1 },
};

// Ground targets are bolted to the terrain: the jet's bombs hit them, and they scroll past with the ground
export const isGroundType = (type: EnemyType) =>
  type === EnemyType.TURRET || type === EnemyType.TANK || type === EnemyType.SAM || type === EnemyType.TOWER;

export interface BossDef {
  name: string;
  size: { width: number; height: number };
  hpMul: number;
  muzzleY: number;      // where bullets leave the hull, as a fraction of its height
  ownEscorts: boolean;  // launches its own escorts instead of getting random reinforcements
  weapon: ProjectileKind;
  weaponName: string;
}

// Each boss has its own hull, movement and attack pattern; after the last one the cycle repeats tougher
export const BOSS_DEFS: BossDef[] = [
  { name: 'WARHAWK', size: { width: 150, height: 78 }, hpMul: 1, muzzleY: 0.56, ownEscorts: false, weapon: 'rocket', weaponName: 'ROCKET BARRAGE' },
  { name: 'IRON WHALE', size: { width: 188, height: 84 }, hpMul: 1.15, muzzleY: 0.54, ownEscorts: true, weapon: 'seeker', weaponName: 'SEEKER DRONES' },
  { name: 'PHANTOM', size: { width: 144, height: 60 }, hpMul: 0.9, muzzleY: 0.5, ownEscorts: false, weapon: 'bolt', weaponName: 'PULSE LASER' },
  { name: 'TITAN', size: { width: 164, height: 90 }, hpMul: 1.3, muzzleY: 0.5, ownEscorts: false, weapon: 'orb', weaponName: 'PLASMA ORBS' },
];

export const bossKindFor = (bossIndex: number) => (Math.max(1, bossIndex) - 1) % BOSS_DEFS.length;

// After the four bosses have each appeared the cycle starts again as a tougher "Mk II", then Mk III...
export const bossTier = (bossIndex: number) => Math.floor((Math.max(1, bossIndex) - 1) / BOSS_DEFS.length);

const MK_SUFFIX = ['', ' MK II', ' MK III', ' MK IV'];

export const bossTitle = (bossIndex: number) =>
  BOSS_DEFS[bossKindFor(bossIndex)].name + MK_SUFFIX[Math.min(bossTier(bossIndex), MK_SUFFIX.length - 1)];
