import {
  SCREEN_WIDTH, SCREEN_HEIGHT, PLANE_SIZE, BASE_SPEED, BULLET_SIZE, BULLET_SPEED, FIRE_RATE, GROUND_HEIGHT, SPAWN_RATE,
  ENEMY_SIZE, ENEMY_BULLET_SIZE, ROAMER_SIZE, ROAMER_SPEED_X, ROAMER_SPEED_Y, ROAMER_FIRE_RATE,
  ENEMY_STANDARD_HP, ENEMY_ROAMER_HP, ENEMY_BULLET_SPEED, PARTICLE_LIFETIME, PARTICLE_SPEED,
  MISSILE_SIZE, MISSILE_SPEED, MISSILE_COOLDOWN
} from './Constants';

export enum EnemyType {
  STANDARD = 0,
  ROAMER = 1
}

export interface Position {
  x: number;
  y: number;
}

export interface Box extends Position {
  width: number;
  height: number;
}

export interface Plane extends Box {
  vx: number;
  vy: number;
}

export interface Enemy extends Box {
  type: EnemyType;
  hp: number;
  vy: number;
  lastFiredFrame: number;
  targetX?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

export interface Missile extends Box {
  vx: number;
  vy: number;
}

export interface GameState {
  plane: Plane;
  bullets: Box[];
  missiles: Missile[];
  enemyBullets: Box[];
  enemies: Enemy[];
  particles: Particle[];
  frameCount: number;
  lastFiredFrame: number;
  lastMissileFrame: number;
  missileRequested: boolean;
  score: number;
  level: number;
  gameOver: boolean;
}

export const createInitialState = (): GameState => ({
  plane: {
    x: 20,
    y: SCREEN_HEIGHT / 2,
    width: PLANE_SIZE.width,
    height: PLANE_SIZE.height,
    vx: 0,
    vy: 0
  },
  bullets: [],
  missiles: [],
  enemyBullets: [],
  enemies: [],
  particles: [],
  frameCount: 0,
  lastFiredFrame: 0,
  lastMissileFrame: 0,
  missileRequested: false,
  score: 0,
  level: 1,
  gameOver: false,
});

export const spawnExplosion = (gameState: GameState, x: number, y: number) => {
  for (let i = 0; i < 18; i++) {
    gameState.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * PARTICLE_SPEED * 2,
      vy: (Math.random() - 0.5) * PARTICLE_SPEED * 2,
      life: PARTICLE_LIFETIME + Math.random() * 10,
      size: Math.random() * 5 + 1
    });
  }
};

export const updateGameState = (
  gameState: GameState, 
  setScore: (s: number) => void, 
  setGameOver: () => void,
  onSound: (type: 'shoot' | 'hit' | 'destroy') => void
) => {
  if (gameState.gameOver) return;

  gameState.frameCount += 1;

  // Level Progression: Level up every 100 points
  const newLevel = Math.floor(gameState.score / 100) + 1;
  if (newLevel > gameState.level) {
    gameState.level = newLevel;
  }

  // Player continuous velocity motion
  gameState.plane.x += gameState.plane.vx;
  gameState.plane.y += gameState.plane.vy;

  // Bounds
  if (gameState.plane.y < 0) gameState.plane.y = 0;
  if (gameState.plane.x < 0) gameState.plane.x = 0;
  if (gameState.plane.x > SCREEN_WIDTH / 3) gameState.plane.x = SCREEN_WIDTH / 3;
  if (gameState.plane.y > SCREEN_HEIGHT - GROUND_HEIGHT - gameState.plane.height) {
    gameState.plane.y = SCREEN_HEIGHT - GROUND_HEIGHT - gameState.plane.height;
  }

  // Handle continuous firing standard bullets
  if (gameState.frameCount - gameState.lastFiredFrame >= FIRE_RATE) {
    gameState.bullets.push({
      x: gameState.plane.x + gameState.plane.width,
      y: gameState.plane.y + gameState.plane.height / 2,
      width: BULLET_SIZE.width,
      height: BULLET_SIZE.height
    });
    gameState.lastFiredFrame = gameState.frameCount;
    onSound('shoot');
  }

  // Handle Missiles Spawning
  if (gameState.missileRequested && (gameState.frameCount - gameState.lastMissileFrame >= MISSILE_COOLDOWN)) {
    gameState.missiles.push({
      x: gameState.plane.x + gameState.plane.width,
      y: gameState.plane.y + gameState.plane.height / 2 - MISSILE_SIZE.height / 2,
      width: MISSILE_SIZE.width,
      height: MISSILE_SIZE.height,
      vx: MISSILE_SPEED,
      vy: 0
    });
    gameState.lastMissileFrame = gameState.frameCount;
    onSound('shoot');
  }
  gameState.missileRequested = false;

  // Move projectiles
  gameState.bullets.forEach(b => { b.x += BULLET_SPEED; });
  gameState.bullets = gameState.bullets.filter(b => b.x < SCREEN_WIDTH);

  // Homing Missiles mechanics
  gameState.missiles.forEach(m => { 
    let target: Enemy | null = null;
    let minDist = Infinity;
    gameState.enemies.forEach(e => {
      // Prioritize large roamers that are generally forward of the missile
      if (e.type === EnemyType.ROAMER && e.x > m.x) {
        const dx = (e.x + e.width/2) - (m.x + m.width/2);
        const dy = (e.y + e.height/2) - (m.y + m.height/2);
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < minDist) {
          minDist = dist;
          target = e;
        }
      }
    });

    const targetEnemy = target as Enemy | null;
    if (targetEnemy && minDist > 0) {
      const dx = (targetEnemy.x + targetEnemy.width/2) - (m.x + m.width/2);
      const dy = (targetEnemy.y + targetEnemy.height/2) - (m.y + m.height/2);
      m.vx = (dx / minDist) * MISSILE_SPEED;
      m.vy = (dy / minDist) * MISSILE_SPEED;
    } else {
      m.vx = MISSILE_SPEED;
      m.vy = 0;
    }

    m.x += m.vx; 
    m.y += m.vy;
  });
  
  gameState.missiles = gameState.missiles.filter(m => 
    m.x < SCREEN_WIDTH && m.x + m.width > 0 && 
    m.y < SCREEN_HEIGHT && m.y + m.height > 0
  );

  gameState.enemyBullets.forEach(b => { b.x -= ENEMY_BULLET_SPEED; });
  gameState.enemyBullets = gameState.enemyBullets.filter(b => b.x + b.width > 0);

  // Particles mechanics
  gameState.particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
  });
  gameState.particles = gameState.particles.filter(p => p.life > 0);

  // Spawn Enemies
  const modifiedSpawnRate = Math.max(20, SPAWN_RATE - (gameState.level * 4)); 
  if (gameState.frameCount % modifiedSpawnRate === 0) {
    const roamersCount = gameState.enemies.filter(e => e.type === EnemyType.ROAMER).length;
    let isRoamer = gameState.level >= 2 && Math.random() < 0.3; 
    
    // Constraint: Under 6 Roamers only
    if (isRoamer && roamersCount >= 6) {
      isRoamer = false;
    }

    if (isRoamer) {
      const targetX = SCREEN_WIDTH * 0.4 + Math.random() * (SCREEN_WIDTH * 0.4);
      gameState.enemies.push({
        type: EnemyType.ROAMER,
        hp: ENEMY_ROAMER_HP,
        vy: ROAMER_SPEED_Y * (Math.random() > 0.5 ? 1 : -1),
        lastFiredFrame: gameState.frameCount,
        targetX,
        x: SCREEN_WIDTH,
        y: Math.random() * (SCREEN_HEIGHT - GROUND_HEIGHT - ROAMER_SIZE.height),
        width: ROAMER_SIZE.width,
        height: ROAMER_SIZE.height
      });
    } else {
      gameState.enemies.push({
        type: EnemyType.STANDARD,
        hp: ENEMY_STANDARD_HP,
        vy: 0,
        lastFiredFrame: 0,
        x: SCREEN_WIDTH,
        y: Math.random() * (SCREEN_HEIGHT - GROUND_HEIGHT - ENEMY_SIZE.height),
        width: ENEMY_SIZE.width,
        height: ENEMY_SIZE.height
      });
    }
  }

  // Move Enemies
  gameState.enemies.forEach(e => {
    if (e.type === EnemyType.STANDARD) {
      e.x -= (BASE_SPEED + (gameState.level * 0.2));
    }
    else if (e.type === EnemyType.ROAMER) {
      const boundaryX = e.targetX || (SCREEN_WIDTH * 0.6);
      if (e.x > boundaryX) {
        e.x -= ROAMER_SPEED_X;
      } else {
        e.y += e.vy;
        if (e.y < 0 || e.y > SCREEN_HEIGHT - GROUND_HEIGHT - e.height) {
          e.vy *= -1;
        }

        if (gameState.frameCount - e.lastFiredFrame >= ROAMER_FIRE_RATE) {
          gameState.enemyBullets.push({
            x: e.x,
            y: e.y + e.height / 2,
            width: ENEMY_BULLET_SIZE.width,
            height: ENEMY_BULLET_SIZE.height
          });
          e.lastFiredFrame = gameState.frameCount;
          onSound('shoot'); // Roamer shooting
        }
      }
    }
  });

  gameState.enemies = gameState.enemies.filter(e => e.x + e.width > 0);

  // Collision detection AABB
  checkCollisions(gameState, setScore, setGameOver, onSound);
};

const checkCollisions = (
  gameState: GameState, 
  setScore: (s: number) => void, 
  setGameOver: () => void,
  onSound: (type: 'shoot' | 'hit' | 'destroy') => void
) => {
  const { plane, bullets, enemyBullets, enemies, missiles } = gameState;

  for (let b of enemyBullets) {
    if (isRectCollision(plane, b)) {
      spawnExplosion(gameState, plane.x + plane.width/2, plane.y + plane.height/2);
      onSound('destroy');
      plane.y = -1000;
      gameState.gameOver = true;
      setGameOver();
      return;
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    let enemy = enemies[i];
    let enemyDestroyed = false;

    // Heavy Missiles Collisions
    for (let m = missiles.length - 1; m >= 0; m--) {
      let missile = missiles[m];
      if (isRectCollision(enemy, missile)) {
        enemies[i].hp -= 5;
        spawnExplosion(gameState, missile.x + missile.width/2, missile.y + missile.height/2);
        missiles.splice(m, 1);
        if(enemies[i].hp > 0) onSound('hit');
        break; 
      }
    }

    if(enemies[i] && enemies[i].hp > 0) {
      for (let j = bullets.length - 1; j >= 0; j--) {
        let bullet = bullets[j];
        if (isRectCollision(enemy, bullet)) {
          enemies[i].hp -= 1;
          bullets.splice(j, 1);
          if(enemies[i].hp > 0) onSound('hit');
          break; 
        }
      }
    }

    if (enemies[i].hp <= 0) {
      spawnExplosion(gameState, enemy.x + enemy.width/2, enemy.y + enemy.height/2);
      onSound('destroy');
      const scoreBump = enemy.type === EnemyType.ROAMER ? 50 : 10;
      gameState.score += scoreBump;
      setScore(gameState.score);
      enemies.splice(i, 1);
      enemyDestroyed = true;
    }

    if (enemyDestroyed) continue;

    if (isRectCollision(plane, enemy)) {
      spawnExplosion(gameState, plane.x + plane.width/2, plane.y + plane.height/2);
      onSound('destroy');
      plane.y = -1000;
      gameState.gameOver = true;
      setGameOver();
    }
  }
};

const isRectCollision = (rect1: Box, rect2: Box) => {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.height + rect1.y > rect2.y
  );
};
