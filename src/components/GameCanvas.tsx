import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Canvas, Picture } from '@shopify/react-native-skia';
import {
  PLAYER_SPEED, PLAYER_LIVES, COLOR_TEXT, COLOR_PANEL, COLOR_PANEL_BORDER, COLOR_ACCENT
} from '../engine/Constants';
import { createInitialState, updateGameState, missileCharge, type GameState, type Loadout } from '../engine/GameLoop';
import { MISSILES } from '../engine/Weapons';
import { renderFrame } from '../render/Renderer';
import { computeReward } from '../state/Progress';
import { showRewardedAd } from '../services/Ads';
import { ControlsOverlay } from './ControlsOverlay';
import { GlassButton, Panel } from './ui';
import { initSounds, playSound } from '../engine/SoundManager';

interface Props {
  level: number;
  loadout: Loadout;
  onFinish: (won: boolean, reward: number) => void;
  onBonusPoints: (points: number) => void;
  onNext: () => void;
  onRetry: () => void;
  onMenu: () => void;
}

interface Result {
  won: boolean;
  reward: number;
  doubled: boolean;
}

// The simulation always advances in fixed 1/60s steps so speed is identical on 60, 90 and 120 Hz screens
const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 4;
const RESULT_DELAY_FRAMES = 70;

export const GameCanvas = (props: Props) => {
  const { level, loadout } = props;
  const propsRef = useRef(props);
  propsRef.current = props;

  const gameState = useRef<GameState>(createInitialState(level, loadout));
  const requestRef = useRef<number>(0);
  const isPaused = useRef<boolean>(false);
  const lastTime = useRef<number>(0);
  const accumulator = useRef<number>(0);
  const finished = useRef<boolean>(false);

  const [result, setResult] = useState<Result | null>(null);
  const [, setTick] = useState(0);

  const animate = () => {
    const now = Date.now();
    const dt = lastTime.current ? Math.min(now - lastTime.current, 100) : STEP_MS;
    lastTime.current = now;

    if (!isPaused.current) {
      accumulator.current += dt;
      let steps = 0;
      while (accumulator.current >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        updateGameState(gameState.current, playSound);
        accumulator.current -= STEP_MS;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator.current = 0;

      const s = gameState.current;
      if (s.status !== 'playing' && s.endTimer > RESULT_DELAY_FRAMES && !finished.current) {
        finished.current = true;
        const won = s.status === 'won';
        const reward = computeReward(won, s.score, s.level);
        setResult({ won, reward, doubled: false });
        propsRef.current.onFinish(won, reward);
      }
      // Skip redundant renders on high-refresh screens when nothing advanced
      if (steps > 0) setTick(t => t + 1);
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    initSounds();
    requestRef.current = requestAnimationFrame(animate);
    // Pause automatically when the app leaves the foreground
    const sub = AppState.addEventListener('change', next => {
      if (next !== 'active' && gameState.current.status === 'playing' && !isPaused.current) {
        isPaused.current = true;
        gameState.current.plane.vx = 0;
        gameState.current.plane.vy = 0;
        setTick(t => t + 1);
      }
    });
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      sub.remove();
    };
  }, []);

  const handleDirectionChange = (dx: number, dy: number) => {
    if (gameState.current.status !== 'playing' || isPaused.current) return;
    gameState.current.plane.vx = dx * PLAYER_SPEED;
    gameState.current.plane.vy = dy * PLAYER_SPEED;
  };

  const handleMissileFire = () => {
    if (gameState.current.status !== 'playing' || isPaused.current) return;
    gameState.current.missileRequested = true;
  };

  const togglePause = () => {
    if (gameState.current.status !== 'playing') return;
    isPaused.current = !isPaused.current;
    // Zero the movement vector so the plane doesn't drift off if controls were held mid-pause
    if (isPaused.current) {
      gameState.current.plane.vx = 0;
      gameState.current.plane.vy = 0;
    }
    setTick(t => t + 1);
  };

  const doubleReward = async () => {
    if (!result || result.doubled) return;
    const rewarded = await showRewardedAd();
    if (rewarded) {
      propsRef.current.onBonusPoints(result.reward);
      setResult(r => (r ? { ...r, reward: r.reward * 2, doubled: true } : r));
    }
  };

  const s = gameState.current;
  const frame = renderFrame(s);
  const cfg = s.config;
  const paused = isPaused.current && s.status === 'playing';
  const missileInfo = MISSILES[s.loadout.missile];

  const bossFight = !!s.boss && s.boss.dying === 0;
  const progressLabel = cfg.isBoss && s.kills >= cfg.killTarget ? 'BOSS' : cfg.isBoss ? 'WARM-UP' : 'ENEMIES';
  const progressValue = bossFight && s.boss
    ? Math.max(0, s.boss.hp) / s.boss.maxHp
    : cfg.isBoss && s.bossState > 0 ? 1 : Math.min(1, s.kills / cfg.killTarget);
  const progressText = bossFight ? '' : `${Math.min(s.kills, cfg.killTarget)}/${cfg.killTarget}`;

  const bannerOpacity = s.bannerTimer > 0 && s.status === 'playing' ? Math.min(1, s.bannerTimer / 30) : 0;

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Picture picture={frame} />
      </Canvas>

      <View style={styles.topRow}>
        <View style={styles.cluster}>
          <View style={styles.panel}>
            <Text style={styles.label}>SCORE</Text>
            <Text style={styles.value}>{s.score}</Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.label}>LIVES</Text>
            <View style={styles.hearts}>
              {Array.from({ length: PLAYER_LIVES }).map((_, i) => (
                <Text key={i} style={[styles.heart, i >= s.lives && styles.heartLost]}>♥</Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.center}>
          <View style={[styles.progressWrap, bossFight ? styles.bossWrap : null]}>
            <View style={styles.progressHead}>
              <Text style={[styles.label, bossFight && styles.bossLabel]}>{progressLabel}</Text>
              {!!progressText && <Text style={styles.progressText}>{progressText}</Text>}
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${progressValue * 100}%` },
                  bossFight && styles.bossFill,
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.cluster}>
          <View style={styles.panel}>
            <Text style={styles.label}>LEVEL</Text>
            <Text style={styles.value}>{s.level}</Text>
          </View>
          <TouchableOpacity onPress={togglePause} style={[styles.panel, styles.pauseBtn]} activeOpacity={0.7}>
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {bannerOpacity > 0 && s.banner && (
        <View style={styles.bannerLayer} pointerEvents="none">
          <Text style={[styles.bannerTitle, { opacity: bannerOpacity }, s.banner.title === 'WARNING' && styles.warning]}>
            {s.banner.title}
          </Text>
          {!!s.banner.sub && <Text style={[styles.bannerSub, { opacity: bannerOpacity }]}>{s.banner.sub}</Text>}
        </View>
      )}

      {s.status === 'playing' && (
        <ControlsOverlay
          onDirectionChange={handleDirectionChange}
          onMissileFire={handleMissileFire}
          missileCharge={missileCharge(s)}
          missileLabel={missileInfo.name}
          missileColor={missileInfo.color}
        />
      )}

      {paused && (
        <View style={[styles.overlayLayer, styles.dim]}>
          <Panel style={styles.card}>
            <Text style={styles.title}>PAUSED</Text>
            <View style={styles.buttons}>
              <GlassButton label="RESUME" variant="primary" onPress={togglePause} />
              <GlassButton label="QUIT TO MENU" onPress={props.onMenu} />
            </View>
          </Panel>
        </View>
      )}

      {result && (
        <View style={[styles.overlayLayer, styles.dim]}>
          <Panel style={styles.card}>
            <Text style={[styles.title, result.won ? styles.winTitle : styles.loseTitle]}>
              {result.won ? (cfg.isBoss ? 'BOSS DEFEATED!' : 'LEVEL COMPLETE') : 'MISSION FAILED'}
            </Text>
            <Text style={styles.stats}>LEVEL {s.level}  ·  SCORE {s.score}  ·  KILLS {s.kills}</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardStar}>★</Text>
              <Text style={styles.rewardValue}>+{result.reward}</Text>
              <Text style={styles.rewardUnit}>POINTS</Text>
            </View>
            <View style={styles.buttons}>
              {!result.doubled && result.reward > 0 && (
                <GlassButton label="WATCH AD" sublabel={`DOUBLE POINTS  +${result.reward}`} variant="ad" onPress={doubleReward} />
              )}
              {result.won ? (
                <GlassButton label="NEXT LEVEL" variant="primary" onPress={props.onNext} />
              ) : (
                <GlassButton label="TRY AGAIN" variant="primary" onPress={props.onRetry} />
              )}
              <GlassButton label="MENU" onPress={props.onMenu} />
            </View>
          </Panel>
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
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
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
  hearts: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  heart: {
    color: '#ff4d5a',
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heartLost: {
    color: 'rgba(255,255,255,0.2)',
  },
  progressWrap: {
    width: 220,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: COLOR_PANEL,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR_PANEL_BORDER,
  },
  bossWrap: {
    width: 300,
    borderColor: 'rgba(255,90,80,0.6)',
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    color: COLOR_TEXT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bossLabel: {
    color: '#ff6a5e',
  },
  barTrack: {
    height: 8,
    marginTop: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: COLOR_ACCENT,
  },
  bossFill: {
    backgroundColor: '#ff4a3d',
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
  bannerLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  bannerTitle: {
    color: COLOR_TEXT,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  warning: {
    color: '#ff5a4d',
  },
  bannerSub: {
    color: COLOR_ACCENT,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  dim: {
    backgroundColor: 'rgba(4, 12, 24, 0.6)',
  },
  card: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 40,
    backgroundColor: 'rgba(8, 20, 34, 0.88)',
  },
  title: {
    color: COLOR_TEXT,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 4,
  },
  winTitle: {
    color: '#7dffb0',
  },
  loseTitle: {
    color: '#ff6a5e',
  },
  stats: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 8,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 14,
  },
  rewardStar: {
    color: COLOR_ACCENT,
    fontSize: 24,
    fontWeight: '900',
  },
  rewardValue: {
    color: COLOR_ACCENT,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rewardUnit: {
    color: COLOR_ACCENT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    alignItems: 'center',
  },
});
