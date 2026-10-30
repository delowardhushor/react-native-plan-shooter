import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { COLOR_ACCENT, COLOR_TEXT } from '../engine/Constants';
import { BOSS_DEFS, bossKindFor } from '../engine/Enemies';
import { BOSS_EVERY, getLevelConfig, isBossLevel } from '../engine/Levels';
import { MAX_ARMOR_LEVEL, armorUpgradeCost } from '../engine/Armor';
import {
  MAX_CANNON_LEVEL, MAX_MISSILE_LEVEL, MISSILES, MISSILE_TYPES, cannonUpgradeCost, missileUpgradeCost,
} from '../engine/Weapons';
import { biomeAccentFor, biomeNameFor } from '../render/Backdrop';
import { REWARD_AD_POINTS, showRewardedAd } from '../services/Ads';
import { dailyStatus, dayKey, type Progress } from '../state/Progress';
import { DailyRewardCard } from './DailyRewardCard';
import { MenuBackdrop } from './MenuBackdrop';
import { GlassButton, Panel, PointsPill, SoundToggle } from './ui';

interface Props {
  progress: Progress;
  onPlay: () => void;
  onUpgrades: () => void;
  onAdPoints: (points: number) => void;
  onClaimDaily: () => void;
}

// Remembers a dismissed daily card for the rest of the day, so returning from a level doesn't re-show it
let dailyDismissedOn = '';

// True when the player can afford at least one upgrade or weapon unlock right now
const hasAffordableUpgrade = (p: Progress) =>
  (p.armor < MAX_ARMOR_LEVEL && p.points >= armorUpgradeCost(p.armor)) ||
  (p.cannon < MAX_CANNON_LEVEL && p.points >= cannonUpgradeCost(p.cannon)) ||
  MISSILE_TYPES.some(t => {
    const m = p.missiles[t];
    if (!m.owned) return p.points >= MISSILES[t].unlockCost;
    return m.level < MAX_MISSILE_LEVEL && p.points >= missileUpgradeCost(m.level);
  });

// The current stretch of levels leading up to the next boss: e.g. 4, 5, 6 (boss)
const LevelPath = ({ level, accent }: { level: number; accent: string }) => {
  const first = Math.floor((level - 1) / BOSS_EVERY) * BOSS_EVERY + 1;
  const nodes = Array.from({ length: BOSS_EVERY }, (_, i) => first + i);
  return (
    <View style={styles.path}>
      {nodes.map((n, i) => {
        const boss = isBossLevel(n);
        const done = n < level;
        const current = n === level;
        return (
          <React.Fragment key={n}>
            {i > 0 && <View style={[styles.link, n <= level && { backgroundColor: accent }]} />}
            <View
              style={[
                styles.node,
                boss && styles.nodeBoss,
                done && { backgroundColor: `${accent}55`, borderColor: accent },
                current && (boss ? styles.nodeCurrentBoss : { backgroundColor: accent, borderColor: '#ffffff' }),
              ]}
            >
              <Text style={[styles.nodeText, current && !boss && styles.nodeTextOn, boss && styles.nodeTextBoss]}>
                {done ? '✓' : n}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
};

const Chip = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.chip}>
    <Text style={styles.chipLabel}>{label}</Text>
    <Text style={styles.chipValue}>{value}</Text>
  </View>
);

export const MenuScreen = ({ progress, onPlay, onUpgrades, onAdPoints, onClaimDaily }: Props) => {
  const [, setTick] = useState(0);
  const daily = dailyStatus(progress);
  const showDaily = daily.claimable && dailyDismissedOn !== dayKey(new Date());

  const cfg = getLevelConfig(progress.level);
  const boss = BOSS_DEFS[bossKindFor(cfg.bossIndex)];
  const missile = MISSILES[progress.equipped];
  const canUpgrade = hasAffordableUpgrade(progress);
  const accent = biomeAccentFor(progress.level);

  // Gentle breathing pulse on PLAY so the main action draws the eye
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const playScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  const watchAd = async () => {
    if (await showRewardedAd()) onAdPoints(REWARD_AD_POINTS);
  };

  return (
    <View style={styles.container}>
      <MenuBackdrop level={progress.level} cannon={progress.cannon} />

      <View style={styles.header}>
        <View>
          <Text style={styles.titleTop}>PLANE</Text>
          <Text style={styles.titleBottom}>SHOOTER</Text>
          <View style={styles.taglineRow}>
            <View style={styles.taglineBar} />
            <Text style={styles.tagline}>DEFEND THE SKIES</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <SoundToggle />
          <PointsPill points={progress.points} />
        </View>
      </View>

      <View style={styles.statusRow}>
        <Chip label="ARMOR" value={`LV ${progress.armor}`} />
        <Chip label="CANNON" value={`LV ${progress.cannon}`} />
        <Chip label={missile.name} value={`LV ${progress.missiles[progress.equipped].level}`} />
        {progress.bestScore > 0 && <Chip label="BEST" value={String(progress.bestScore)} />}
      </View>

      <View style={styles.cardWrap} pointerEvents="box-none">
        <Panel style={styles.card} accent={accent}>
          <Text style={[styles.world, { color: accent }]}>{biomeNameFor(progress.level)}</Text>
          <View style={[styles.ring, { borderColor: accent, backgroundColor: `${accent}22` }]}>
            <Text style={styles.cardLabel}>LEVEL</Text>
            <Text style={styles.levelNumber}>{progress.level}</Text>
          </View>
          <LevelPath level={progress.level} accent={accent} />
          {cfg.isBoss ? (
            <View style={styles.bossTag}>
              <Text style={styles.bossTagText}>BOSS · {boss.name}</Text>
            </View>
          ) : (
            <Text style={styles.objective}>DESTROY {cfg.killTarget} ENEMY PLANES</Text>
          )}

          <Animated.View style={[styles.playWrap, { transform: [{ scale: playScale }] }]}>
            <GlassButton label="PLAY" variant="primary" onPress={onPlay} style={styles.playBtn} />
          </Animated.View>

          <View style={styles.row}>
            <GlassButton
              label="UPGRADES"
              sublabel={canUpgrade ? 'NEW!' : undefined}
              small
              variant={canUpgrade ? 'primary' : 'secondary'}
              onPress={onUpgrades}
              style={styles.flex}
            />
            <GlassButton label="WATCH AD" sublabel={`+${REWARD_AD_POINTS} PTS`} small variant="ad" onPress={watchAd} style={styles.flex} />
          </View>
        </Panel>
      </View>

      {showDaily && (
        <DailyRewardCard
          status={daily}
          onClaim={onClaimDaily}
          onClose={() => {
            dailyDismissedOn = dayKey(new Date());
            setTick(t => t + 1);
          }}
        />
      )}
    </View>
  );
};

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 3 },
  textShadowRadius: 8,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 14,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleTop: { color: COLOR_TEXT, fontSize: 22, fontWeight: '900', letterSpacing: 11, marginBottom: -4, ...shadow },
  titleBottom: { color: COLOR_ACCENT, fontSize: 44, fontWeight: '900', letterSpacing: 5, lineHeight: 48, ...shadow },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  taglineBar: { width: 28, height: 3, borderRadius: 2, backgroundColor: COLOR_TEXT },
  tagline: { color: COLOR_TEXT, fontSize: 11, fontWeight: '900', letterSpacing: 5, ...shadow },
  statusRow: { position: 'absolute', left: 24, bottom: 20, flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(8, 20, 34, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
  },
  chipLabel: { color: COLOR_ACCENT, fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  chipValue: { color: COLOR_TEXT, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  cardWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 36,
    paddingTop: 64,
  },
  card: {
    width: 310,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  world: { color: COLOR_ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 4, marginBottom: 6 },
  ring: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: COLOR_ACCENT,
    backgroundColor: 'rgba(255,178,62,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 9, fontWeight: '900', letterSpacing: 4, marginBottom: -4 },
  levelNumber: { color: COLOR_TEXT, fontSize: 46, fontWeight: '900', lineHeight: 50, ...shadow },
  path: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 8 },
  link: { width: 22, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  linkDone: { backgroundColor: COLOR_ACCENT },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: 'rgba(255,178,62,0.35)', borderColor: COLOR_ACCENT },
  nodeCurrent: { backgroundColor: COLOR_ACCENT, borderColor: '#ffe0a3' },
  nodeBoss: { borderRadius: 8, borderColor: '#ff4a3d', backgroundColor: 'rgba(255,74,61,0.2)', width: 32, height: 32 },
  nodeCurrentBoss: { backgroundColor: '#ff4a3d', borderColor: '#ffb0a8' },
  nodeText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '900' },
  nodeTextOn: { color: '#10202e' },
  nodeTextBoss: { color: '#ffffff' },
  objective: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  bossTag: {
    backgroundColor: 'rgba(255,74,61,0.2)',
    borderColor: '#ff4a3d',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 10,
  },
  bossTagText: { color: '#ff6a5e', fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  playWrap: { alignSelf: 'stretch' },
  playBtn: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
});
