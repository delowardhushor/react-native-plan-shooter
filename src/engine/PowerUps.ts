// Temporary boosts that enemies drop mid-run. Picking one up again refreshes its timer.

export type PowerUpKind = 'rapid' | 'shield' | 'pierce' | 'wingman';

export const POWERUP_KINDS: PowerUpKind[] = ['rapid', 'shield', 'pierce', 'wingman'];

export interface PowerUpDef {
  name: string;
  short: string;    // HUD chip label
  duration: number; // frames
  color: string;
}

export const POWERUPS: Record<PowerUpKind, PowerUpDef> = {
  rapid: { name: 'RAPID FIRE', short: 'RAPID', duration: 600, color: '#ffd23e' },
  shield: { name: 'SHIELD', short: 'SHIELD', duration: 900, color: '#5fd8ff' },
  pierce: { name: 'OVERDRIVE', short: 'DRIVE', duration: 420, color: '#ff5fd0' },
  wingman: { name: 'WINGMEN', short: 'WINGS', duration: 900, color: '#6dffa0' },
};

export type ActivePowerUps = Record<PowerUpKind, number>; // frames remaining, 0 = off

export const noPowerUps = (): ActivePowerUps => ({ rapid: 0, shield: 0, pierce: 0, wingman: 0 });

// Cannon fires twice as often while Rapid Fire is on
export const RAPID_FIRE_FACTOR = 0.5;
// Overdrive rounds punch through everything and hit twice as hard
export const PIERCE_DAMAGE = 2;
// Frames of invulnerability after a shield pops
export const SHIELD_BREAK_INVULNERABLE_FRAMES = 60;
// Wingman drones hover this far above and below the jet
export const WINGMAN_OFFSET = 26;

// Drop odds per kill: big targets are far more likely to drop one, and a long dry spell forces one
export const DROP_CHANCE_SMALL = 0.07;
export const DROP_CHANCE_BIG = 0.3;
export const DROP_PITY_KILLS = 14;
