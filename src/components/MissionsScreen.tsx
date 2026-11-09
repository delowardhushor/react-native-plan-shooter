import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLOR_ACCENT, COLOR_TEXT } from '../engine/Constants';
import { playSound, buzz } from '../engine/SoundManager';
import {
  ACHIEVEMENTS, achievementProgress, ensureMissions, isAchievementClaimable, isAchievementDone, type Achievement,
} from '../state/Missions';
import type { Progress } from '../state/Progress';
import { equippedSkin } from '../state/Progress';
import { MenuBackdrop } from './MenuBackdrop';
import { GlassButton, Panel, PointsPill } from './ui';

export interface MissionActions {
  claimMission: (index: number) => void;
  claimAchievement: (id: string) => void;
}

interface Props {
  progress: Progress;
  actions: MissionActions;
  onBack: () => void;
}

const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <View style={styles.track}>
    <View style={[styles.fill, { width: `${Math.min(1, value / max) * 100}%`, backgroundColor: color }]} />
  </View>
);

type Tab = 'daily' | 'awards';

// Daily missions (three a day, reset at midnight) and lifetime achievements; both pay out points
export const MissionsScreen = ({ progress, actions, onBack }: Props) => {
  const [tab, setTab] = useState<Tab>('daily');
  const missions = ensureMissions(progress).missions!.items;
  const claimableMissions = missions.filter(m => !m.claimed && m.progress >= m.target).length;
  const claimableAwards = ACHIEVEMENTS.filter(a => isAchievementClaimable(progress, a)).length;

  const claim = (fn: () => void) => {
    playSound('pickup');
    buzz(25);
    fn();
  };

  // Ready-to-claim first, then in-progress, then collected
  const rank = (a: Achievement) => (isAchievementClaimable(progress, a) ? 0 : isAchievementDone(progress, a) ? 2 : 1);
  const awards = [...ACHIEVEMENTS].sort((a, b) => rank(a) - rank(b));

  return (
    <View style={styles.container}>
      <MenuBackdrop level={progress.level} cannon={progress.cannon} skin={equippedSkin(progress).id} />
      <View style={styles.shade} />

      <View style={styles.header}>
        <GlassButton label="‹ MENU" small onPress={onBack} />
        <View style={styles.titleWrap}>
          <Text style={styles.title}>MISSIONS</Text>
          <View style={styles.titleBar} />
        </View>
        <PointsPill points={progress.points} />
      </View>

      <View style={styles.tabs}>
        <GlassButton
          label="DAILY"
          sublabel={claimableMissions ? `${claimableMissions} READY` : undefined}
          small
          variant={tab === 'daily' ? 'primary' : 'secondary'}
          onPress={() => setTab('daily')}
          style={styles.tab}
        />
        <GlassButton
          label="ACHIEVEMENTS"
          sublabel={claimableAwards ? `${claimableAwards} READY` : undefined}
          small
          variant={tab === 'awards' ? 'primary' : 'secondary'}
          onPress={() => setTab('awards')}
          style={styles.tab}
        />
      </View>

      {tab === 'daily' ? (
        <View style={styles.body}>
          <Text style={styles.note}>NEW MISSIONS EVERY DAY AT MIDNIGHT</Text>
          <View style={styles.dailyRow}>
            {missions.map((m, i) => {
              const done = m.progress >= m.target;
              return (
                <Panel key={i} style={styles.missionCard} accent={m.claimed ? undefined : done ? '#3ecf7a' : COLOR_ACCENT}>
                  <Text style={styles.tier}>{['EASY', 'MEDIUM', 'HARD'][i]}</Text>
                  <Text style={styles.missionText}>{m.label}</Text>
                  <ProgressBar value={m.progress} max={m.target} color={done ? '#3ecf7a' : COLOR_ACCENT} />
                  <Text style={styles.count}>{m.progress} / {m.target}</Text>
                  <View style={styles.spacer} />
                  <GlassButton
                    label={m.claimed ? 'CLAIMED' : done ? `CLAIM +${m.reward}` : `+${m.reward} PTS`}
                    small
                    variant={done && !m.claimed ? 'primary' : 'secondary'}
                    disabled={m.claimed || !done}
                    onPress={() => claim(() => actions.claimMission(i))}
                  />
                </Panel>
              );
            })}
          </View>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.awardGrid}>
          {awards.map(a => {
            const done = isAchievementDone(progress, a);
            const claimed = !!progress.achClaimed[a.id];
            return (
              <Panel key={a.id} style={styles.awardCard} accent={claimed ? undefined : done ? '#3ecf7a' : undefined}>
                <View style={styles.awardTop}>
                  <View style={styles.awardText}>
                    <Text style={[styles.awardName, claimed && styles.dim]}>{a.name}</Text>
                    <Text style={[styles.awardDesc, claimed && styles.dim]}>{a.desc}</Text>
                  </View>
                  <GlassButton
                    label={claimed ? '✓' : `+${a.reward}`}
                    small
                    variant={done && !claimed ? 'primary' : 'secondary'}
                    disabled={claimed || !done}
                    onPress={() => claim(() => actions.claimAchievement(a.id))}
                    style={styles.awardBtn}
                  />
                </View>
                <ProgressBar value={achievementProgress(progress, a)} max={a.target} color={done ? '#3ecf7a' : COLOR_ACCENT} />
                <Text style={styles.count}>{achievementProgress(progress, a)} / {a.target}</Text>
              </Panel>
            );
          })}
        </ScrollView>
      )}
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
    paddingTop: 12,
  },
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
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  tab: { minWidth: 150 },
  body: { flex: 1, paddingHorizontal: 20, marginTop: 8 },
  note: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '900', letterSpacing: 3, textAlign: 'center', marginBottom: 8 },
  dailyRow: { flex: 1, flexDirection: 'row', gap: 12, paddingBottom: 14 },
  missionCard: { flex: 1, padding: 14, maxHeight: 250 },
  tier: { color: COLOR_ACCENT, fontSize: 10, fontWeight: '900', letterSpacing: 3 },
  missionText: { color: COLOR_TEXT, fontSize: 15, fontWeight: '900', marginTop: 6, marginBottom: 10, minHeight: 40 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  count: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  spacer: { flex: 1, minHeight: 8 },
  awardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 16 },
  awardCard: { width: '48.8%', padding: 12 },
  awardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  awardText: { flex: 1 },
  awardName: { color: COLOR_TEXT, fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  awardDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  awardBtn: { minWidth: 64 },
  dim: { opacity: 0.5 },
});
