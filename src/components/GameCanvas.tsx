import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { Canvas, Picture } from '@shopify/react-native-skia';
import {
  PLAYER_SPEED, COLOR_TEXT, COLOR_PANEL, COLOR_PANEL_BORDER, COLOR_ACCENT
} from '../engine/Constants';
import { createInitialState, updateGameState, GameState } from '../engine/GameLoop';
import { renderFrame } from '../render/Renderer';
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

  const frame = renderFrame(gameState.current);
  const { level } = gameState.current;

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Picture picture={frame} />
      </Canvas>

      <View style={styles.topRow}>
        <View style={styles.panel}>
          <Text style={styles.label}>SCORE</Text>
          <Text style={styles.value}>{score}</Text>
        </View>
        <View style={styles.rightCluster}>
          <View style={styles.panel}>
            <Text style={styles.label}>LEVEL</Text>
            <Text style={styles.value}>{level}</Text>
          </View>
          <TouchableOpacity onPress={togglePause} style={[styles.panel, styles.pauseBtn]} activeOpacity={0.7}>
            {isPaused.current ? (
              <View style={styles.playIcon} />
            ) : (
              <View style={styles.pauseIcon}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {!gameOver && <ControlsOverlay onDirectionChange={handleDirectionChange} onMissileFire={handleMissileFire} />}

      {gameOver && (
        <View style={[styles.overlayLayer, styles.dim]}>
          <TouchableWithoutFeedback onPress={resetGame}>
            <View style={styles.card}>
              <Text style={styles.title}>GAME OVER</Text>
              <Text style={styles.finalScore}>SCORE {score}  ·  LEVEL {level}</Text>
              <Text style={styles.hint}>TAP TO FLY AGAIN</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}

      {isPaused.current && !gameOver && (
        <View style={[styles.overlayLayer, styles.dim]}>
          <View style={styles.card}>
            <Text style={styles.title}>PAUSED</Text>
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
    top: 14,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    pointerEvents: 'box-none',
    zIndex: 20,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panel: {
    minWidth: 78,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLOR_PANEL,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR_PANEL_BORDER,
  },
  label: {
    color: COLOR_ACCENT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  value: {
    color: COLOR_TEXT,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pauseBtn: {
    minWidth: 0,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 5,
  },
  pauseBar: {
    width: 6,
    height: 20,
    borderRadius: 2,
    backgroundColor: COLOR_TEXT,
  },
  playIcon: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 18,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: COLOR_TEXT,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  dim: {
    backgroundColor: 'rgba(4, 12, 24, 0.55)',
  },
  card: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 44,
    backgroundColor: 'rgba(8, 20, 34, 0.78)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR_PANEL_BORDER,
  },
  title: {
    color: COLOR_TEXT,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 4,
  },
  finalScore: {
    color: COLOR_ACCENT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 8,
  },
  hint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 16,
  },
});
