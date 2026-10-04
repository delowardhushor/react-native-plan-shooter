import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Bulletproof layout swap for forced landscape
export const SCREEN_WIDTH = Math.max(width, height);
export const SCREEN_HEIGHT = Math.min(width, height);

// HUD palette
export const COLOR_TEXT = '#ffffff';
export const COLOR_PANEL = 'rgba(8, 20, 34, 0.55)';
export const COLOR_PANEL_BORDER = 'rgba(255, 255, 255, 0.28)';
export const COLOR_ACCENT = '#ffb23e';

// Entities sizes and speeds (hit boxes; sprites are drawn to fit these)
export const PLANE_SIZE = { width: 56, height: 26 };
export const BULLET_SIZE = { width: 14, height: 4 };
export const ENEMY_BULLET_SIZE = { width: 8, height: 8 };

export const MISSILE_SIZE = { width: 28, height: 8 };
export const MISSILE_SPEED = 15;
export const MISSILE_COOLDOWN = 120; // Frames (2 seconds)

export const ENEMY_SIZE = { width: 44, height: 22 };
export const ROAMER_SIZE = { width: 64, height: 34 };

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
export const MAX_PARTICLES = 320;

export const GROUND_HEIGHT = 56;

// Tilt (degrees) applied to a plane at full vertical speed
export const PLANE_MAX_TILT = 14;
