// The screen-clearing bomb: charged by kills (and slowly during boss fights), triggered by the player.

export const BOMB_MAX = 100;
export const BOMB_START = 30;             // a little charge at the start of a level
export const BOMB_PER_KILL = 5;
export const BOMB_PER_BIG_KILL = 12;      // gunships, bombers and other heavy targets
export const BOMB_BOSS_TRICKLE = 0.03;    // per frame while a boss is on screen
export const BOMB_LOCK_FRAMES = 40;       // bomb kills don't recharge the bomb
export const BOMB_INVULNERABLE_FRAMES = 45;
export const BOMB_BOSS_DAMAGE = 0.12;     // share of a boss's total hull
export const BOMB_BULLET_SCORE = 2;       // per enemy shot wiped out
