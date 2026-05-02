import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { Canvas, Rect, Group } from '@shopify/react-native-skia';
import { 
  SCREEN_WIDTH, SCREEN_HEIGHT, COLOR_BG, COLOR_FG, GROUND_HEIGHT, PLAYER_SPEED
} from '../engine/Constants';
import { createInitialState, updateGameState, GameState, EnemyType } from '../engine/GameLoop';
import { ControlsOverlay } from './ControlsOverlay';
import { initSounds, playSound } from '../engine/SoundManager';

export const GameCanvas = () => {
  const gameState = useRef<GameState>(createInitialState());
  const requestRef = useRef<number>(0);
  const isPaused = useRef<boolean>(false);
  
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [, setTick] = useState(0);

  const animate = () => {
    if (!isPaused.current) {
      updateGameState(
        gameState.current,
        (newScore) => setScore(newScore),
        () => setGameOver(true),
        (sndType) => playSound(sndType)
      );
    }
    setTick(t => t + 1);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    initSounds();
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const handleDirectionChange = (dx: number, dy: number) => {
    if (gameOver || isPaused.current) return;
    gameState.current.plane.vx = dx * PLAYER_SPEED;
    gameState.current.plane.vy = dy * PLAYER_SPEED;
  };

  const handleMissileFire = () => {
    if (gameOver || isPaused.current) return;
    gameState.current.missileRequested = true;
  };

  const togglePause = () => {
    if (gameOver) return;
    isPaused.current = !isPaused.current;
    
    // Immediately zero-out physical vectors so plane doesn't warp off if controls were held mid-pause
    if (isPaused.current) {
       gameState.current.plane.vx = 0;
       gameState.current.plane.vy = 0;
    }
    setTick(t => t+1);
  };

  const resetGame = () => {
    gameState.current = createInitialState();
    isPaused.current = false;
    setScore(0);
    setGameOver(false);
  };

  const { plane, bullets, enemyBullets, missiles, enemies, particles, level } = gameState.current;

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Rect x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} color={COLOR_BG} />
        
        <Group color={COLOR_FG}>
          {/* Ground */}
          <Rect x={0} y={SCREEN_HEIGHT - GROUND_HEIGHT} width={SCREEN_WIDTH} height={GROUND_HEIGHT} />
          
          {/* Player Plane Redesign (Classic pixel-art structure) */}
          <Group>
            {/* Main fuselage */}
            <Rect x={plane.x + 8} y={plane.y + 8} width={20} height={8} />
            {/* Front nose */}
            <Rect x={plane.x + 28} y={plane.y + 10} width={4} height={4} />
            {/* Wings top and bottom */}
            <Rect x={plane.x + 12} y={plane.y + 2} width={8} height={20} />
            {/* Rear rudder/tail */}
            <Rect x={plane.x} y={plane.y + 4} width={8} height={16} />
          </Group>

          {/* Player Bullets */}
          {bullets.map((b, i) => (
            <Rect key={`pb-${i}`} x={b.x} y={b.y} width={b.width} height={b.height} />
          ))}

          {/* Heavy Missiles */}
          {missiles.map((m, i) => (
            <Group key={`ms-${i}`}>
              <Rect x={m.x} y={m.y + 2} width={12} height={4} />
              <Rect x={m.x + 12} y={m.y + 3} width={4} height={2} />
              <Rect x={m.x} y={m.y} width={4} height={8} />
            </Group>
          ))}

          {/* Enemy Bullets */}
          {enemyBullets.map((b, i) => (
            <Rect key={`eb-${i}`} x={b.x} y={b.y} width={b.width} height={b.height} />
          ))}

          {/* Enemies */}
          {enemies.map((e, i) => {
             if (e.type === EnemyType.ROAMER) {
               return (
                 <Group key={`er-${i}`}>
                   <Rect x={e.x + 6} y={e.y + 10} width={26} height={12} />
                   <Rect x={e.x} y={e.y + 14} width={6} height={4} />
                   <Rect x={e.x + 14} y={e.y} width={10} height={32} />
                   <Rect x={e.x + 28} y={e.y + 6} width={8} height={20} />
                 </Group>
               );
             }

             return (
               <Group key={`es-${i}`}>
                 <Rect x={e.x + 4} y={e.y + 8} width={20} height={8} />
                 <Rect x={e.x} y={e.y + 10} width={4} height={4} />
                 <Rect x={e.x + 12} y={e.y + 2} width={8} height={20} />
                 <Rect x={e.x + 24} y={e.y + 4} width={8} height={16} />
               </Group>
             );
          })}

          {/* Explosion Particles */}
          {particles.map((p, i) => (
             <Rect key={`pt-${i}`} x={p.x} y={p.y} width={p.size} height={p.size} />
          ))}
        </Group>
      </Canvas>

      {/* Top UI row updated with Pause capability nested accurately beside Level */}
      <View style={styles.topRow}>
        <Text style={styles.uiText}>SCORE: {score}</Text>
        <View style={styles.rightCluster}>
          <TouchableOpacity onPress={togglePause} style={styles.pauseBtn}>
            <Text style={styles.uiText}>{isPaused.current ? "RESUME" : "PAUSE"}</Text>
          </TouchableOpacity>
          <Text style={styles.uiText}>LEVEL {level}</Text>
        </View>
      </View>
      
      {!gameOver && <ControlsOverlay onDirectionChange={handleDirectionChange} onMissileFire={handleMissileFire} />}
      
      {gameOver && (
        <View style={styles.gameOverLayer}>
          <TouchableWithoutFeedback onPress={resetGame}>
            <View style={styles.gameOverBox}>
              <Text style={styles.gameOverText}>GAME OVER</Text>
              <Text style={styles.restartText}>TAP TO RESTART</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}

      {isPaused.current && !gameOver && (
        <View style={styles.gameOverLayer}>
          <View style={[styles.gameOverBox, { backgroundColor: 'rgba(27, 49, 30, 0.4)' }]}>
            <Text style={styles.gameOverText}>PAUSED</Text>
          </View>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  canvas: {
    flex: 1,
  },
  topRow: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
    zIndex: 20,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 30,
  },
  pauseBtn: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    backgroundColor: 'rgba(27, 49, 30, 0.5)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLOR_FG,
  },
  uiText: {
    color: COLOR_FG,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  gameOverLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    pointerEvents: 'box-none',
  },
  gameOverBox: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'rgba(141, 191, 128, 0.8)',
    borderRadius: 8,
  },
  gameOverText: {
    color: COLOR_FG,
    fontSize: 40,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  restartText: {
    color: COLOR_FG,
    fontSize: 20,
    marginTop: 10,
    fontFamily: 'monospace',
  }
});
