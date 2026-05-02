import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Nokia-style resolution feel. We scale everything up visually or define them in large pixel units.
export const PIXEL_SIZE = 4; // Simulated pixel size

// Bulletproof layout swap for forced landscape
export const SCREEN_WIDTH = Math.max(width, height);
export const SCREEN_HEIGHT = Math.min(width, height);

// Nokia 1110 color palette
export const COLOR_BG = '#8DBF80'; // Classic Nokia greenish background
export const COLOR_FG = '#1B311E'; // Dark grey/greenish for pixels

// Entities sizes and speeds
export const PLANE_SIZE = { width: 32, height: 24 };
export const BULLET_SIZE = { width: 8, height: 4 };
export const ENEMY_BULLET_SIZE = { width: 6, height: 6 };

export const MISSILE_SIZE = { width: 16, height: 8 };
export const MISSILE_SPEED = 15;
export const MISSILE_COOLDOWN = 120; // Frames (2 seconds)

export const ENEMY_SIZE = { width: 24, height: 24 };
export const ROAMER_SIZE = { width: 32, height: 32 };

export const BASE_SPEED = 2; // base speed of enemies
export const ROAMER_SPEED_X = 1; // moves left slower
export const ROAMER_SPEED_Y = 2; // bobs up and down faster

export const PLAYER_SPEED = 4; // Top speed for standard D-Pad bounds

export const BULLET_SPEED = 10;
export const ENEMY_BULLET_SPEED = 6;

export const SPAWN_RATE = 60; // frames between spawns (assuming 60fps, so 1 enemy per sec)
export const FIRE_RATE = 15; // frames between firing bullets
export const ROAMER_FIRE_RATE = 80;

export const ENEMY_STANDARD_HP = 1;
export const ENEMY_ROAMER_HP = 5;

// Particle definitions
export const PARTICLE_LIFETIME = 30; // Frames before disappearance
export const PARTICLE_SPEED = 6;     // Max speed multiplier for explosions

export const GROUND_HEIGHT = 40;
