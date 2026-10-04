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

export const ENEMY_SIZE = { width: 44, height: 22 };
export const ROAMER_SIZE = { width: 64, height: 34 };
export const BOSS_SIZE = { width: 150, height: 78 };

export const ROAMER_SPEED_X = 0.8; // moves left slowly
export const ROAMER_SPEED_Y = 1.1; // gentle bobbing

export const PLAYER_SPEED = 4; // Top speed for standard D-Pad bounds
export const BULLET_SPEED = 10;

export const ENEMY_STANDARD_HP = 1;
export const ENEMY_ROAMER_HP = 5;

export const PLAYER_LIVES = 3;
export const RESPAWN_FRAMES = 60;
export const INVULNERABLE_FRAMES = 150;

// Particle definitions
export const PARTICLE_LIFETIME = 30; // Frames before disappearance
export const PARTICLE_SPEED = 6;     // Max speed multiplier for explosions
export const MAX_PARTICLES = 320;

export const GROUND_HEIGHT = 56;

// Tilt (degrees) applied to a plane at full vertical speed
export const PLANE_MAX_TILT = 14;
