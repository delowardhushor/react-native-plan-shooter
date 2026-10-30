import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Canvas, Picture } from '@shopify/react-native-skia';
import {
  PLAYER_SPEED, MAX_CONTINUES, COLOR_TEXT, COLOR_PANEL, COLOR_PANEL_BORDER, COLOR_ACCENT
} from '../engine/Constants';
import {
  COMBO_WINDOW, comboMultiplier, createInitialState, updateGameState, revivePlayer, missileCharge,
  type GameState, type Loadout,
} from '../engine/GameLoop';
import { MISSILES } from '../engine/Weapons';
import { renderFrame } from '../render/Renderer';
import { computeReward } from '../state/Progress';
import { showRewardedAd } from '../services/Ads';
import { ControlsOverlay } from './ControlsOverlay';
import { GlassButton, Panel, SoundToggle } from './ui';
import { buzz, initSounds, playMusic, playSound, type SoundType } from '../engine/SoundManager';

interface Props {
  level: number;
  loadout: Loadout;
  bestScore: number;
  showRatePrompt: boolean;
  onRatePromptShown: () => void;
  onFinish: (won: boolean, reward: number, score: number) => void;
  onBonusPoints: (points: number) => void;
  onNext: () => void;
  onRetry: () => void;
  onMenu: () => void;
}

interface Result {
  won: boolean;
  reward: number;
  doubled: boolean;
  newBest: boolean;
  askRating: boolean;
}

const STORE_URL = 'market://details?id=com.planeshooter.planeshooter';
const STORE_WEB_URL = 'https://play.google.com/store/apps/details?id=com.planeshooter.planeshooter';

// The simulation always advances in fixed 1/60s steps so speed is identical on 60, 90 and 120 Hz screens
const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 4;
const RESULT_DELAY_FRAMES = 70;

// Sound plus the haptic that goes with it (only the moments that matter get a buzz)
const playEffect = (type: SoundType) => {
  playSound(type);
  if (type === 'hurt') buzz(45);
  else if (type === 'warning') buzz([0, 120, 80, 120]);
};

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
  const continuesUsed = useRef<number>(0);
  const offered = useRef<boolean>(false);
  const loseJinglePlayed = useRef<boolean>(false);
  const adBusy = useRef<boolean>(false);
  const [adMessage, setAdMessage] = useState('');
  const [adLoading, setAdLoading] = useState(false);

  const [result, setResult] = useState<Result | null>(null);
  const [offerContinue, setOfferContinue] = useState(false);
  const [, setTick] = useState(0);

  const finishRun = () => {
    if (finished.current) return;
    finished.current = true;
    const s = gameState.current;
    const won = s.status === 'won';
    const reward = computeReward(won, s.score, s.level);
    setOfferContinue(false);
    // The rating nudge appears once, right after the first boss falls, when the player is happiest
    const askRating = won && s.config.isBoss && propsRef.current.showRatePrompt;
    if (askRating) propsRef.current.onRatePromptShown();
    setResult({ won, reward, doubled: false, newBest: s.score > propsRef.current.bestScore, askRating });
    propsRef.current.onFinish(won, reward, s.score);
    playMusic(null);
    if (won) {
      playSound('win');
      buzz([0, 80, 60, 160]);
    } else if (!loseJinglePlayed.current) {
      playSound('lose');
    }
  };

  const animate = () => {
    const now = Date.now();
    const dt = lastTime.current ? Math.min(now - lastTime.current, 100) : STEP_MS;
    lastTime.current = now;

    if (!isPaused.current) {
      accumulator.current += dt * gameState.current.timeScale;
      let steps = 0;
      while (accumulator.current >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        updateGameState(gameState.current, playEffect);
        accumulator.current -= STEP_MS;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator.current = 0;

      const s = gameState.current;
      if (s.status === 'playing') playMusic(s.bossState > 0 ? 'boss' : 'battle');
      if (s.status !== 'playing' && s.endTimer > RESULT_DELAY_FRAMES && !finished.current && !offered.current) {
        if (s.status === 'lost' && continuesUsed.current < MAX_CONTINUES) {
          offered.current = true;
          setOfferContinue(true);
          playMusic(null);
          playSound('lose');
          loseJinglePlayed.current = true;
        } else {
          finishRun();
        }
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

  const continueWithAd = async () => {
    if (adBusy.current) return;
    adBusy.current = true;
    setAdLoading(true);
    setAdMessage('');
    const rewarded = await showRewardedAd('continue');
    adBusy.current = false;
    setAdLoading(false);
    if (!rewarded) {
      setAdMessage('Ad unavailable or closed early. Watch the full ad to continue.');
      return;
    }
    continuesUsed.current += 1;
    offered.current = false;
    loseJinglePlayed.current = false;
    setOfferContinue(false);
    revivePlayer(gameState.current);
  };

  const rateGame = () => {
    Linking.openURL(STORE_URL).catch(() => Linking.openURL(STORE_WEB_URL).catch(() => {}));
    setResult(r => (r ? { ...r, askRating: false } : r));
  };

  const doubleReward = async () => {
    if (!result || result.doubled) return;
    const rewarded = await showRewardedAd('doubleReward');
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

  const hullRatio = s.hp / s.maxHp;
  const hullColor = hullRatio > 0.5 ? '#4cd97b' : hullRatio > 0.25 ? '#ffb23e' : '#ff4d5a';
  const hullBorder = s.heal > 0 ? '#7dffb0' : s.hurt > 0 ? '#ff6a5e' : COLOR_PANEL_BORDER;

  const comboMult = comboMultiplier(s.combo);
  const showCombo = s.status === 'playing' && s.combo >= 3;

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
          <View style={[styles.panel, styles.hullPanel, { borderColor: hullBorder }]}>
            <View style={styles.progressHead}>
              <Text style={styles.label}>HULL</Text>
              <Text style={styles.progressText}>{s.hp}/{s.maxHp}</Text>
            </View>
            <View style={styles.segments}>
              {Array.from({ length: s.maxHp }).map((_, i) => (
                <View key={i} style={[styles.segment, i < s.hp && { backgroundColor: hullColor }]} />
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

      <View style={styles.popupLayer} pointerEvents="none">
        {s.popups.map((p, i) => (
          <View key={i} style={[styles.popup, { left: p.x - 60, top: p.y }]}>
            <Text
              style={[
                styles.popupText,
                p.big && styles.popupBig,
                { color: p.color, opacity: Math.min(1, p.life / (p.maxLife * 0.4)) },
              ]}
            >
              {p.text}
            </Text>
          </View>
        ))}
      </View>

      {showCombo && (
        <View style={styles.comboWrap} pointerEvents="none">
          <Text style={[styles.comboText, comboMult > 1 && styles.comboHot]}>
            {s.combo} COMBO{comboMult > 1 ? `  x${comboMult}` : ''}
          </Text>
          <View style={styles.comboTrack}>
            <View style={[styles.comboFill, { width: `${(s.comboTimer / COMBO_WINDOW) * 100}%` }]} />
          </View>
        </View>
      )}

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
            <SoundToggle style={styles.pauseSound} />
            <View style={styles.buttons}>
              <GlassButton label="RESUME" variant="primary" onPress={togglePause} />
              <GlassButton label="QUIT TO MENU" onPress={props.onMenu} />
            </View>
          </Panel>
        </View>
      )}

      {offerContinue && (
        <View style={[styles.overlayLayer, styles.dim]}>
          <Panel style={styles.card}>
            <Text style={[styles.title, styles.loseTitle]}>SHOT DOWN</Text>
            <Text style={styles.stats}>LEVEL {s.level}  ·  SCORE {s.score}  ·  KILLS {s.kills}</Text>
            <Text style={styles.hint}>Watch a short ad to rejoin the fight with a fully repaired hull.</Text>
            {!!adMessage && <Text style={styles.adMessage}>{adMessage}</Text>}
            <View style={styles.buttons}>
              <GlassButton
                label={adLoading ? 'LOADING AD…' : 'CONTINUE'}
                sublabel="WATCH AD  ·  FULL HULL"
                variant="ad"
                disabled={adLoading}
                onPress={continueWithAd}
              />
              <GlassButton label="NO THANKS" onPress={finishRun} />
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
            {result.newBest && s.score > 0 && <Text style={styles.newBest}>★ NEW BEST SCORE ★</Text>}
            {s.bestCombo >= 5 && <Text style={styles.comboStat}>BEST COMBO  {s.bestCombo}</Text>}
            <View style={styles.rewardRow}>
              <Text style={styles.rewardStar}>★</Text>
              <Text style={styles.rewardValue}>+{result.reward}</Text>
              <Text style={styles.rewardUnit}>POINTS</Text>
            </View>
            {result.askRating && (
              <TouchableOpacity onPress={rateGame} activeOpacity={0.8} style={styles.rateBtn}>
                <Text style={styles.rateText}>ENJOYING THE GAME?  RATE US ★★★★★</Text>
              </TouchableOpacity>
            )}
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
  popupLayer: { ...StyleSheet.absoluteFill, zIndex: 15 },
  popup: { position: 'absolute', width: 120, alignItems: 'center' },
  popupText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  popupBig: { fontSize: 28 },
  comboWrap: { position: 'absolute', top: 84, alignSelf: 'center', alignItems: 'center', zIndex: 15 },
  comboText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  comboHot: { color: COLOR_ACCENT, fontSize: 22 },
  comboTrack: { width: 110, height: 4, borderRadius: 2, marginTop: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  comboFill: { height: '100%', backgroundColor: COLOR_ACCENT },
  comboStat: { color: COLOR_ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 3, textAlign: 'center', marginTop: 2 },
  rateBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: COLOR_ACCENT },
  rateText: { color: COLOR_ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  pauseSound: { alignSelf: 'center', marginBottom: 12 },
  newBest: { color: COLOR_ACCENT, fontSize: 13, fontWeight: '900', letterSpacing: 3, textAlign: 'center', marginBottom: 6 },
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
  hullPanel: {
    width: 150,
    justifyContent: 'center',
  },
  segments: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 6,
  },
  segment: {
    flex: 1,
    height: 10,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
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
  hint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 12,
  },
  adMessage: {
    color: '#ff9a8f',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
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
