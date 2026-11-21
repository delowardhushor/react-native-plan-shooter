export const MAX_ARMOR_LEVEL = 5;

// Hit points per armor level (index = level - 1)
const HULL_POINTS = [3, 4, 5, 6, 8];

export const armorMaxHp = (level: number) => HULL_POINTS[Math.min(level, MAX_ARMOR_LEVEL) - 1];

// Cost to buy the NEXT level, indexed by current level
export const armorUpgradeCost = (level: number) => [0, 100, 350, 700, 1200][level] ?? 0;

// A medic kit restores 40% of the hull, so it stays worth grabbing as armor grows
export const medicHeal = (maxHp: number) => Math.ceil(maxHp * 0.4);
