// The jet's lobbed bombs: while ground targets are on screen it drops one every so often. They arc forward
// and down, so hitting a target means flying at the right height and distance (the landing marker helps).

export const LOB_GRAVITY = 0.12;
export const LOB_VX = 3.2;      // forward speed on release
export const LOB_VY = 1;        // initial downward speed
export const LOB_DAMAGE = 3;
export const LOB_RADIUS = 46;   // splash radius on impact
export const LOB_SIZE = 8;

// Frames between drops: faster with a better cannon
export const lobInterval = (cannonLevel: number) => Math.max(34, 56 - cannonLevel * 4);

// Where on the ground a bomb released from the jet right now would land (screen x)
export const lobLandingX = (releaseX: number, releaseY: number, groundY: number) => {
  const drop = Math.max(0, groundY - releaseY);
  const t = (-LOB_VY + Math.sqrt(LOB_VY * LOB_VY + 2 * LOB_GRAVITY * drop)) / LOB_GRAVITY;
  return releaseX + LOB_VX * t;
};
