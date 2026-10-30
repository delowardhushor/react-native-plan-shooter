import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Group, Picture, RadialGradient, vec, type SkPicture } from '@shopify/react-native-skia';
import { COLOR_ACCENT, COLOR_TEXT } from '../engine/Constants';
import { MAX_ARMOR_LEVEL, armorMaxHp, armorUpgradeCost, medicHeal } from '../engine/Armor';
import {
  MAX_CANNON_LEVEL, MAX_MISSILE_LEVEL, MISSILES, MISSILE_TYPES,
  cannonStats, cannonUpgradeCost, missileStats, missileUpgradeCost, type MissileType,
} from '../engine/Weapons';
import { buzz, playSound } from '../engine/SoundManager';
import { REWARD_AD_POINTS, showRewardedAd } from '../services/Ads';
import type { Progress } from '../state/Progress';
import { HERO_TIERS, getSprites } from '../render/Sprites';
import { MenuBackdrop } from './MenuBackdrop';
import { GlassButton, Panel, PointsPill } from './ui';

export interface UpgradeActions {
  upgradeArmor: () => void;
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

const ICON_W = 160;
const ICON_H = 60;
const GREEN = '#4cd97b';

// Sprite on a soft glow in the item's colour
const Icon = ({ picture, width, height, scale, color, dim }: {
  picture: SkPicture; width: number; height: number; scale: number; color: string; dim?: boolean;
}) => (
  <Canvas style={{ width: ICON_W, height: ICON_H, opacity: dim ? 0.45 : 1 }}>
    <Circle cx={ICON_W / 2} cy={ICON_H / 2} r={ICON_H / 2}>
      <RadialGradient c={vec(ICON_W / 2, ICON_H / 2)} r={ICON_H / 2} colors={[`${color}77`, `${color}00`]} />
    </Circle>
    <Group transform={[{ translateX: (ICON_W - width * scale) / 2 }, { translateY: (ICON_H - height * scale) / 2 }, { scale }]}>
      <Picture picture={picture} />
    </Group>
  </Canvas>
);

const LevelPips = ({ level, max, color }: { level: number; max: number; color: string }) => (
  <View style={styles.levelRow}>
    <Text style={[styles.levelText, { color }]}>LV {level}/{max}</Text>
    <View style={styles.pips}>
      {Array.from({ length: max }).map((_, i) => (
        <View key={i} style={[styles.pip, i < level && { backgroundColor: color }]} />
      ))}
    </View>
  </View>
);

// One stat line; `next` previews the value after the next upgrade
const StatRow = ({ label, value, next }: { label: string; value: string; next?: string }) => (
  <View style={styles.statRow}>
    <Text style={styles.statLabel}>{label}</Text>
    <View style={styles.statValueWrap}>
      <Text style={styles.statValue}>{value}</Text>
      {next !== undefined && <Text style={styles.statNext}>→ {next}</Text>}
    </View>
  </View>
);

const NeedMore = ({ points, cost }: { points: number; cost: number }) =>
  points < cost ? <Text style={styles.need}>NEED {cost - points} MORE</Text> : <View style={styles.needSpace} />;

export const UpgradeScreen = ({ progress, actions, onBack }: Props) => {
  const S = getSprites();
  const { points } = progress;

  const watchAd = async () => {
    if (await showRewardedAd()) actions.addPoints(REWARD_AD_POINTS);
  };

  // Every purchase gets a chime and a tick so it feels like something happened
  const buy = (action: () => void) => () => {
    playSound('pickup');
    buzz(25);
    action();
  };

  const hull = armorMaxHp(progress.armor);
  const armorMax = progress.armor >= MAX_ARMOR_LEVEL;
  const armorCost = armorUpgradeCost(progress.armor);

  const cannon = cannonStats(progress.cannon);
  const cannonNext = cannonStats(progress.cannon + 1);
  const cannonMax = progress.cannon >= MAX_CANNON_LEVEL;
  const cannonCost = cannonUpgradeCost(progress.cannon);
  const rate = (c: { fireRate: number }) => `${(60 / c.fireRate).toFixed(1)}/s`;

  return (
    <View style={styles.container}>
      <MenuBackdrop level={progress.level} cannon={progress.cannon} />
      <View style={styles.shade} />

      <View style={styles.header}>
        <GlassButton label="‹ MENU" small onPress={onBack} />
        <View style={styles.titleWrap}>
          <Text style={styles.title}>UPGRADES</Text>
          <View style={styles.titleBar} />
        </View>
        <View style={styles.headerRight}>
          <GlassButton label="WATCH AD" sublabel={`+${REWARD_AD_POINTS} PTS`} small variant="ad" onPress={watchAd} />
          <PointsPill points={points} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        <Panel style={styles.card} accent={GREEN}>
          <Icon picture={S.medic} width={28} height={28} scale={1.7} color={GREEN} />
          <Text style={styles.name}>ARMOR</Text>
          <LevelPips level={progress.armor} max={MAX_ARMOR_LEVEL} color={GREEN} />
          <Text style={styles.blurb}>Hit points before your plane goes down</Text>
          <View style={styles.stats}>
            <StatRow label="HULL" value={String(hull)} next={armorMax ? undefined : String(armorMaxHp(progress.armor + 1))} />
            <StatRow label="MEDIC KIT" value={`+${medicHeal(hull)}`} next={armorMax ? undefined : `+${medicHeal(armorMaxHp(progress.armor + 1))}`} />
          </View>
          <View style={styles.spacer} />
          {armorMax ? (
            <GlassButton label="MAX LEVEL" small disabled onPress={() => {}} />
          ) : (
            <>
              <NeedMore points={points} cost={armorCost} />
              <GlassButton
                label="UPGRADE"
                sublabel={`★ ${armorCost}`}
                small
                variant="primary"
                disabled={points < armorCost}
                onPress={buy(actions.upgradeArmor)}
              />
            </>
          )}
        </Panel>

        <Panel style={styles.card} accent={COLOR_ACCENT}>
          <Icon picture={S.heroes[Math.min(progress.cannon, HERO_TIERS) - 1]} width={56} height={26} scale={1.8} color={COLOR_ACCENT} />
          <Text style={styles.name}>CANNON</Text>
          <LevelPips level={progress.cannon} max={MAX_CANNON_LEVEL} color={COLOR_ACCENT} />
          <Text style={styles.blurb}>{cannon.blurb}</Text>
          <View style={styles.stats}>
            <StatRow label="FIRE RATE" value={rate(cannon)} next={cannonMax || rate(cannonNext) === rate(cannon) ? undefined : rate(cannonNext)} />
            <StatRow label="SHOTS" value={String(cannon.shots)} next={cannonMax || cannonNext.shots === cannon.shots ? undefined : String(cannonNext.shots)} />
          </View>
          <View style={styles.spacer} />
          {cannonMax ? (
            <GlassButton label="MAX LEVEL" small disabled onPress={() => {}} />
          ) : (
            <>
              <NeedMore points={points} cost={cannonCost} />
              <GlassButton
                label="UPGRADE"
                sublabel={`★ ${cannonCost}`}
                small
                variant="primary"
                disabled={points < cannonCost}
                onPress={buy(actions.upgradeCannon)}
              />
            </>
          )}
        </Panel>

        {MISSILE_TYPES.map(type => {
          const info = MISSILES[type];
          const owned = progress.missiles[type];
          const equipped = progress.equipped === type;
          const stats = missileStats(type, owned.level);
          const next = missileStats(type, owned.level + 1);
          const maxed = owned.level >= MAX_MISSILE_LEVEL;
          const upCost = missileUpgradeCost(owned.level);
          return (
            <Panel key={type} style={styles.card} accent={info.color}>
              {equipped && (
                <View style={[styles.ribbon, { backgroundColor: info.color }]}>
                  <Text style={styles.ribbonText}>EQUIPPED</Text>
                </View>
              )}
              <Icon
                picture={S.missiles[type]}
                width={info.size.width}
                height={info.size.height}
                scale={type === 'lance' ? 3 : 3.3}
                color={info.color}
                dim={!owned.owned}
              />
              <Text style={styles.name}>{info.name}</Text>
              {owned.owned ? (
                <LevelPips level={owned.level} max={MAX_MISSILE_LEVEL} color={info.color} />
              ) : (
                <Text style={styles.locked}>🔒 LOCKED</Text>
              )}
              <Text style={styles.blurb}>{info.blurb}</Text>
              <View style={styles.stats}>
                <StatRow label="DAMAGE" value={String(stats.damage)} next={owned.owned && !maxed ? String(next.damage) : undefined} />
                <StatRow
                  label="RELOAD"
                  value={`${(stats.cooldown / 60).toFixed(1)}s`}
                  next={owned.owned && !maxed ? `${(next.cooldown / 60).toFixed(1)}s` : undefined}
                />
                {!!stats.radius && <StatRow label="BLAST AREA" value={String(stats.radius)} next={owned.owned && !maxed ? String(next.radius) : undefined} />}
              </View>
              <View style={styles.spacer} />
              {!owned.owned ? (
                <>
                  <NeedMore points={points} cost={info.unlockCost} />
                  <GlassButton
                    label="UNLOCK"
                    sublabel={`★ ${info.unlockCost}`}
                    small
                    variant="primary"
                    disabled={points < info.unlockCost}
                    onPress={buy(() => actions.unlockMissile(type))}
                  />
                </>
              ) : (
                <>
                  {!maxed && <NeedMore points={points} cost={upCost} />}
                  <View style={styles.cardButtons}>
                    {!equipped && (
                      <GlassButton label="EQUIP" small onPress={() => actions.equipMissile(type)} style={styles.flex} />
                    )}
                    {maxed ? (
                      equipped && <GlassButton label="MAX LEVEL" small disabled onPress={() => {}} style={styles.flex} />
                    ) : (
                      <GlassButton
                        label="UPGRADE"
                        sublabel={`★ ${upCost}`}
                        small
                        variant="primary"
                        disabled={points < upCost}
                        onPress={buy(() => actions.upgradeMissile(type))}
                        style={styles.flex}
                      />
                    )}
                  </View>
                </>
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
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4, 12, 24, 0.5)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleWrap: { alignItems: 'center' },
  title: {
    color: COLOR_TEXT,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  titleBar: { width: 70, height: 3, borderRadius: 2, backgroundColor: COLOR_ACCENT, marginTop: 2 },
  cards: { paddingHorizontal: 20, paddingVertical: 12, gap: 12, alignItems: 'stretch' },
  card: {
    width: 192,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  ribbon: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, zIndex: 5 },
  ribbonText: { color: '#10202e', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  name: { color: COLOR_TEXT, fontSize: 14, fontWeight: '900', letterSpacing: 3, marginTop: 2 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  levelText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 12, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  locked: { color: '#ff6a5e', fontSize: 11, fontWeight: '900', letterSpacing: 3, marginTop: 4 },
  blurb: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 6, lineHeight: 13, minHeight: 26 },
  stats: { alignSelf: 'stretch', marginTop: 6, gap: 3 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { color: COLOR_TEXT, fontSize: 11, fontWeight: '900' },
  statNext: { color: GREEN, fontSize: 11, fontWeight: '900' },
  spacer: { flex: 1, minHeight: 6 },
  need: { color: '#ff7a6e', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  needSpace: { height: 13 },
  cardButtons: { flexDirection: 'row', gap: 6, alignSelf: 'stretch' },
  flex: { flex: 1 },
});
