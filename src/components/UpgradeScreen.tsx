import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Group, Picture, type SkPicture } from '@shopify/react-native-skia';
import { COLOR_ACCENT, COLOR_TEXT } from '../engine/Constants';
import {
  MAX_CANNON_LEVEL, MAX_MISSILE_LEVEL, MISSILES, MISSILE_TYPES,
  cannonStats, cannonUpgradeCost, missileStats, missileUpgradeCost, type MissileType,
} from '../engine/Weapons';
import { REWARD_AD_POINTS, showRewardedAd } from '../services/Ads';
import type { Progress } from '../state/Progress';
import { getSprites } from '../render/Sprites';
import { MenuBackdrop } from './MenuBackdrop';
import { GlassButton, Panel, PointsPill } from './ui';

export interface UpgradeActions {
  upgradeCannon: () => void;
  unlockMissile: (type: MissileType) => void;
  upgradeMissile: (type: MissileType) => void;
  equipMissile: (type: MissileType) => void;
  addPoints: (points: number) => void;
}

interface Props {
  progress: Progress;
  actions: UpgradeActions;
  onBack: () => void;
}

const ICON_W = 150;
const ICON_H = 52;

const Icon = ({ picture, width, height, scale }: { picture: SkPicture; width: number; height: number; scale: number }) => (
  <Canvas style={{ width: ICON_W, height: ICON_H }}>
    <Group transform={[{ translateX: (ICON_W - width * scale) / 2 }, { translateY: (ICON_H - height * scale) / 2 }, { scale }]}>
      <Picture picture={picture} />
    </Group>
  </Canvas>
);

const Pips = ({ level, max }: { level: number; max: number }) => (
  <View style={styles.pips}>
    {Array.from({ length: max }).map((_, i) => (
      <View key={i} style={[styles.pip, i < level && styles.pipOn]} />
    ))}
  </View>
);

export const UpgradeScreen = ({ progress, actions, onBack }: Props) => {
  const S = getSprites();
  const { points } = progress;

  const watchAd = async () => {
    if (await showRewardedAd()) actions.addPoints(REWARD_AD_POINTS);
  };

  const cannon = cannonStats(progress.cannon);
  const cannonMax = progress.cannon >= MAX_CANNON_LEVEL;
  const cannonCost = cannonUpgradeCost(progress.cannon);

  return (
    <View style={styles.container}>
      <MenuBackdrop />
      <View style={styles.shade} />

      <View style={styles.header}>
        <GlassButton label="‹ MENU" small onPress={onBack} />
        <Text style={styles.title}>UPGRADES</Text>
        <View style={styles.headerRight}>
          <GlassButton label="WATCH AD" sublabel={`+${REWARD_AD_POINTS} PTS`} small variant="ad" onPress={watchAd} />
          <PointsPill points={points} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        <Panel style={styles.card}>
          <Icon picture={S.player} width={56} height={26} scale={1.9} />
          <Text style={styles.name}>CANNON</Text>
          <Pips level={progress.cannon} max={MAX_CANNON_LEVEL} />
          <Text style={styles.stat}>{cannon.blurb}</Text>
          <Text style={styles.statDim}>{(60 / cannon.fireRate).toFixed(1)} volleys / sec</Text>
          <View style={styles.spacer} />
          {cannonMax ? (
            <GlassButton label="MAX LEVEL" small disabled onPress={() => {}} />
          ) : (
            <GlassButton
              label="UPGRADE"
              sublabel={`★ ${cannonCost}`}
              small
              variant="primary"
              disabled={points < cannonCost}
              onPress={actions.upgradeCannon}
            />
          )}
        </Panel>

        {MISSILE_TYPES.map(type => {
          const info = MISSILES[type];
          const owned = progress.missiles[type];
          const equipped = progress.equipped === type;
          const stats = missileStats(type, owned.level);
          const maxed = owned.level >= MAX_MISSILE_LEVEL;
          const upCost = missileUpgradeCost(owned.level);
          return (
            <Panel key={type} style={[styles.card, equipped && styles.cardEquipped]}>
              <Icon picture={S.missiles[type]} width={info.size.width} height={info.size.height} scale={type === 'lance' ? 3.2 : 3.6} />
              <Text style={styles.name}>{info.name} MISSILE</Text>
              {owned.owned ? <Pips level={owned.level} max={MAX_MISSILE_LEVEL} /> : <Text style={styles.locked}>LOCKED</Text>}
              <Text style={styles.stat}>{info.blurb}</Text>
              <Text style={styles.statDim}>
                DMG {stats.damage}  ·  RELOAD {(stats.cooldown / 60).toFixed(1)}s{stats.radius ? `  ·  AREA ${stats.radius}` : ''}
              </Text>
              <View style={styles.spacer} />
              {!owned.owned ? (
                <GlassButton
                  label="UNLOCK"
                  sublabel={`★ ${info.unlockCost}`}
                  small
                  variant="primary"
                  disabled={points < info.unlockCost}
                  onPress={() => actions.unlockMissile(type)}
                />
              ) : (
                <View style={styles.cardButtons}>
                  <GlassButton
                    label={equipped ? 'EQUIPPED' : 'EQUIP'}
                    small
                    disabled={equipped}
                    onPress={() => actions.equipMissile(type)}
                  />
                  {!maxed && (
                    <GlassButton
                      label="UPGRADE"
                      sublabel={`★ ${upCost}`}
                      small
                      variant="primary"
                      disabled={points < upCost}
                      onPress={() => actions.upgradeMissile(type)}
                    />
                  )}
                </View>
              )}
            </Panel>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4, 12, 24, 0.55)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    color: COLOR_TEXT,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  cards: { paddingHorizontal: 20, paddingVertical: 16, gap: 10, alignItems: 'stretch' },
  card: {
    width: 204,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(8, 20, 34, 0.94)',
  },
  cardEquipped: { borderColor: COLOR_ACCENT, borderWidth: 1.5 },
  name: { color: COLOR_TEXT, fontSize: 14, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  pips: { flexDirection: 'row', gap: 5, marginTop: 6 },
  pip: { width: 18, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  pipOn: { backgroundColor: COLOR_ACCENT },
  locked: { color: '#ff6a5e', fontSize: 11, fontWeight: '900', letterSpacing: 3, marginTop: 4 },
  stat: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 15 },
  statDim: { color: COLOR_ACCENT, fontSize: 10, fontWeight: '800', letterSpacing: 1, textAlign: 'center', marginTop: 4 },
  spacer: { flex: 1, minHeight: 10 },
  cardButtons: { gap: 8, alignSelf: 'stretch' },
});
