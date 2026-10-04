export type MissileType = 'homing' | 'blast' | 'lance';

export const MISSILE_TYPES: MissileType[] = ['homing', 'blast', 'lance'];
export const MAX_CANNON_LEVEL = 5;
export const MAX_MISSILE_LEVEL = 4;

interface CannonTier {
  fireRate: number; // frames between volleys
  shots: 1 | 2 | 3;
  blurb: string;
}

// Index = level - 1
const CANNON_TIERS: CannonTier[] = [
  { fireRate: 18, shots: 1, blurb: 'Single cannon' },
  { fireRate: 14, shots: 1, blurb: 'Faster firing' },
  { fireRate: 14, shots: 2, blurb: 'Twin cannons' },
  { fireRate: 11, shots: 2, blurb: 'Twin, rapid fire' },
  { fireRate: 11, shots: 3, blurb: 'Triple spread shot' },
];

export const cannonStats = (level: number) => CANNON_TIERS[Math.min(level, MAX_CANNON_LEVEL) - 1];

// Cost to buy the NEXT level, indexed by current level
export const cannonUpgradeCost = (level: number) => [0, 100, 200, 350, 550][level] ?? 0;
export const missileUpgradeCost = (level: number) => [0, 120, 240, 400][level] ?? 0;

interface MissileInfo {
  name: string;
  blurb: string;
  unlockCost: number;
  size: { width: number; height: number };
  speed: number;
  baseDamage: number;
  baseCooldown: number; // frames
  baseRadius: number;   // blast radius, 0 = none
  color: string;
}

export const MISSILES: Record<MissileType, MissileInfo> = {
  homing: {
    name: 'HOMING', blurb: 'Locks on to the nearest enemy',
    unlockCost: 0, size: { width: 28, height: 8 }, speed: 11,
    baseDamage: 4, baseCooldown: 110, baseRadius: 0, color: '#ff6a55',
  },
  blast: {
    name: 'BLAST', blurb: 'Explodes on impact and hits everything nearby',
    unlockCost: 200, size: { width: 30, height: 11 }, speed: 8,
    baseDamage: 5, baseCooldown: 140, baseRadius: 70, color: '#ffa23a',
  },
  lance: {
    name: 'LANCE', blurb: 'Pierces through every enemy in a line',
    unlockCost: 400, size: { width: 40, height: 6 }, speed: 20,
    baseDamage: 3, baseCooldown: 100, baseRadius: 0, color: '#5fe3ff',
  },
};

export const missileStats = (type: MissileType, level: number) => {
  const m = MISSILES[type];
  const up = Math.min(level, MAX_MISSILE_LEVEL) - 1;
  return {
    damage: m.baseDamage + up,
    cooldown: m.baseCooldown - up * 14,
    radius: m.baseRadius ? m.baseRadius + up * 10 : 0,
    speed: m.speed,
    size: m.size,
  };
};
