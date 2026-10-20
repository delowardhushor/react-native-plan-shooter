import { ENEMY_BULLET_SIZE } from './Constants';

// Every boss fires its own kind of shot; regular enemies use plain bullets
export type ProjectileKind = 'bullet' | 'rocket' | 'seeker' | 'bolt' | 'orb';

export interface ProjectileDef {
  size: { width: number; height: number }; // hit box
  damage: number;
}

export const PROJECTILES: Record<ProjectileKind, ProjectileDef> = {
  bullet: { size: ENEMY_BULLET_SIZE, damage: 1 },
  rocket: { size: { width: 14, height: 8 }, damage: 1 },  // starts slow, accelerates
  seeker: { size: { width: 14, height: 12 }, damage: 1 }, // homes in on the player, can be shot down
  bolt: { size: { width: 14, height: 5 }, damage: 1 },    // fast and thin
  orb: { size: { width: 18, height: 18 }, damage: 2 },    // big, slow, hits hard
};
