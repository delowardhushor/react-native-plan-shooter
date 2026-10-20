export const MAX_ARMOR_LEVEL = 5;

// Hit points per armor level (index = level - 1)
const HULL_POINTS = [5, 7, 9, 11, 14];

export const armorMaxHp = (level: number) => HULL_POINTS[Math.min(level, MAX_ARMOR_LEVEL) - 1];

// Cost to buy the NEXT level, indexed by current level
export const armorUpgradeCost = (level: number) => [0, 80, 160, 280, 440][level] ?? 0;

// A medic kit restores 40% of the hull, so it stays worth grabbing as armor grows
export const medicHeal = (maxHp: number) => Math.ceil(maxHp * 0.4);
