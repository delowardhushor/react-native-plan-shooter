import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLOR_ACCENT, COLOR_TEXT } from '../engine/Constants';
import { getLevelConfig } from '../engine/Levels';
import { MISSILES } from '../engine/Weapons';
import { REWARD_AD_POINTS, showRewardedAd } from '../services/Ads';
import type { Progress } from '../state/Progress';
import { MenuBackdrop } from './MenuBackdrop';
import { GlassButton, Panel, PointsPill } from './ui';

interface Props {
  progress: Progress;
  onPlay: () => void;
  onUpgrades: () => void;
  onAdPoints: (points: number) => void;
}

export const MenuScreen = ({ progress, onPlay, onUpgrades, onAdPoints }: Props) => {
  const cfg = getLevelConfig(progress.level);
  const missile = MISSILES[progress.equipped];

  const watchAd = async () => {
    if (await showRewardedAd()) onAdPoints(REWARD_AD_POINTS);
  };

  return (
    <View style={styles.container}>
      <MenuBackdrop />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>PLANE SHOOTER</Text>
          <Text style={styles.tagline}>DEFEND THE SKIES</Text>
        </View>
        <PointsPill points={progress.points} />
      </View>

      <View style={styles.cardWrap} pointerEvents="box-none">
        <Panel style={styles.card}>
          <Text style={styles.cardLabel}>CURRENT LEVEL</Text>
          <Text style={styles.levelNumber}>{progress.level}</Text>
          {cfg.isBoss ? (
            <View style={styles.bossTag}>
              <Text style={styles.bossTagText}>BOSS BATTLE</Text>
            </View>
          ) : (
            <Text style={styles.objective}>DESTROY {cfg.killTarget} ENEMY PLANES</Text>
          )}

          <GlassButton label="PLAY" variant="primary" onPress={onPlay} style={styles.playBtn} />

          <View style={styles.row}>
            <GlassButton label="UPGRADES" small onPress={onUpgrades} style={styles.flex} />
            <GlassButton label="WATCH AD" sublabel={`+${REWARD_AD_POINTS} PTS`} small variant="ad" onPress={watchAd} style={styles.flex} />
          </View>

          <Text style={styles.loadout}>
            CANNON LV {progress.cannon}  ·  {missile.name} LV {progress.missiles[progress.equipped].level}
          </Text>
        </Panel>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 16,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: COLOR_TEXT,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    color: COLOR_ACCENT,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 40,
    paddingTop: 56,
  },
  card: {
    width: 320,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(8, 20, 34, 0.72)',
  },
  cardLabel: { color: COLOR_ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 4 },
  levelNumber: {
    color: COLOR_TEXT,
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  objective: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  bossTag: {
    backgroundColor: 'rgba(255,74,61,0.2)',
    borderColor: '#ff4a3d',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
  },
  bossTagText: { color: '#ff6a5e', fontSize: 13, fontWeight: '900', letterSpacing: 4 },
  playBtn: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
  loadout: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 12 },
});
