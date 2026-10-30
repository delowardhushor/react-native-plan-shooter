import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLOR_ACCENT, COLOR_TEXT, SCREEN_WIDTH } from '../engine/Constants';
import { BOSS_DEFS, bossKindFor } from '../engine/Enemies';
import { BOSS_EVERY, isBossLevel } from '../engine/Levels';
import { biomeAccentFor, biomeNameFor } from '../render/Backdrop';
import { MAX_STARS, REPLAY_REWARD_FACTOR, equippedSkin, isCleared, starsFor, type Progress } from '../state/Progress';
import { MenuBackdrop } from './MenuBackdrop';
import { GlassButton, Panel, PointsPill, Stars } from './ui';

interface Props {
  progress: Progress;
  onPlayLevel: (level: number) => void;
  onBack: () => void;
}

const CARD_W = 300;
const GAP = 12;

interface NodeProps {
  level: number;
  progress: Progress;
  accent: string;
  onPress: () => void;
}

// One level on the map: cleared (stars), current (glowing), or locked
const LevelNode = ({ level, progress, accent, onPress }: NodeProps) => {
  const boss = isBossLevel(level);
  const cleared = isCleared(progress, level);
  const current = level === progress.level;
  const locked = !cleared && !current;
  const stars = starsFor(progress, level);
  const bossName = boss ? BOSS_DEFS[bossKindFor(level / BOSS_EVERY)].name : '';
  const tone = boss ? '#ff4a3d' : accent;

  return (
    <TouchableOpacity activeOpacity={0.8} disabled={locked} onPress={onPress} style={styles.nodeWrap}>
      <View style={styles.nodeSlot}>
      <View
        style={[
          styles.node,
          boss && styles.nodeBoss,
          { borderColor: locked ? 'rgba(255,255,255,0.18)' : tone },
          cleared && { backgroundColor: `${tone}33` },
          current && { backgroundColor: tone, borderColor: '#ffffff' },
          locked && styles.nodeLocked,
        ]}
      >
        {locked ? (
          <Text style={styles.lock}>🔒</Text>
        ) : (
          <Text style={[styles.nodeNumber, current && styles.nodeNumberOn]}>{level}</Text>
        )}
      </View>
      </View>
      <View style={styles.starSlot}>
        {cleared ? <Stars count={stars} size={13} /> : current ? <Text style={[styles.playTag, { color: tone }]}>PLAY</Text> : null}
      </View>
      {boss && <Text style={[styles.bossName, locked && styles.dim]}>{bossName}</Text>}
    </TouchableOpacity>
  );
};

// Campaign map: levels grouped into chapters of BOSS_EVERY, one world and one boss per chapter
export const CampaignScreen = ({ progress, onPlayLevel, onBack }: Props) => {
  const scroll = useRef<ScrollView>(null);
  const currentChapter = Math.ceil(progress.level / BOSS_EVERY);
  const chapters = Array.from({ length: currentChapter + 1 }, (_, i) => i + 1); // plus one locked teaser

  // Once the chapters are laid out, bring the current one to the middle of the screen
  const centred = useRef(false);
  const centreCurrentChapter = () => {
    if (centred.current) return;
    centred.current = true;
    const cardLeft = 20 + (currentChapter - 1) * (CARD_W + GAP);
    scroll.current?.scrollTo({ x: Math.max(0, cardLeft + CARD_W / 2 - SCREEN_WIDTH / 2), animated: false });
  };

  return (
    <View style={styles.container}>
      <MenuBackdrop level={progress.level} cannon={progress.cannon} skin={equippedSkin(progress).id} />
      <View style={styles.shade} />

      <View style={styles.header}>
        <GlassButton label="‹ MENU" small onPress={onBack} />
        <View style={styles.titleWrap}>
          <Text style={styles.title}>CAMPAIGN</Text>
          <View style={styles.titleBar} />
        </View>
        <PointsPill points={progress.points} />
      </View>
      <Text style={styles.hint}>
        Tap a level to play. Replays pay {Math.round(REPLAY_REWARD_FACTOR * 100)}% points, new stars pay a bonus.
      </Text>

      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cards}
        onContentSizeChange={centreCurrentChapter}
      >
        {chapters.map(chapter => {
          const first = (chapter - 1) * BOSS_EVERY + 1;
          const levels = Array.from({ length: BOSS_EVERY }, (_, i) => first + i);
          const accent = biomeAccentFor(first);
          const locked = first > progress.level;
          const earned = levels.reduce((sum, l) => sum + (isCleared(progress, l) ? starsFor(progress, l) : 0), 0);
          return (
            <Panel key={chapter} style={[styles.card, locked && styles.cardLocked]} accent={locked ? 'rgba(255,255,255,0.3)' : accent}>
              <View style={styles.cardHead}>
                <View>
                  <Text style={styles.chapter}>CHAPTER {chapter}</Text>
                  <Text style={[styles.world, { color: locked ? 'rgba(255,255,255,0.55)' : accent }]}>{biomeNameFor(first)}</Text>
                </View>
                {!locked && (
                  <View style={styles.total}>
                    <Text style={styles.totalText}>{earned}/{BOSS_EVERY * MAX_STARS}</Text>
                    <Text style={styles.totalStar}>★</Text>
                  </View>
                )}
              </View>

              <View style={styles.path}>
                {levels.map((level, i) => (
                  <React.Fragment key={level}>
                    {i > 0 && <View style={[styles.link, level <= progress.level && { backgroundColor: accent }]} />}
                    <LevelNode level={level} progress={progress} accent={accent} onPress={() => onPlayLevel(level)} />
                  </React.Fragment>
                ))}
              </View>
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
  hint: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textAlign: 'center', marginTop: 6 },
  cards: { paddingHorizontal: 20, paddingVertical: 14, gap: GAP, alignItems: 'center' },
  card: { width: CARD_W, paddingVertical: 14, paddingHorizontal: 16 },
  cardLocked: { opacity: 0.6 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  chapter: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 3 },
  world: { fontSize: 15, fontWeight: '900', letterSpacing: 3, marginTop: 2 },
  total: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  totalText: { color: COLOR_TEXT, fontSize: 14, fontWeight: '900' },
  totalStar: { color: COLOR_ACCENT, fontSize: 16, fontWeight: '900' },
  path: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginTop: 4, marginBottom: 6 },
  link: { width: 20, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 30 },
  nodeWrap: { alignItems: 'center', width: 74 },
  nodeSlot: { height: 64, justifyContent: 'center' }, // keeps the star row level whether the node is round or a boss square
  node: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeBoss: { borderRadius: 14, width: 64, height: 64 },
  nodeLocked: { backgroundColor: 'rgba(255,255,255,0.04)' },
  nodeNumber: { color: COLOR_TEXT, fontSize: 24, fontWeight: '900' },
  nodeNumberOn: { color: '#10202e' },
  lock: { fontSize: 20, opacity: 0.7 },
  starSlot: { height: 20, justifyContent: 'center', marginTop: 6 },
  playTag: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  bossName: { color: '#ff8a7e', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 2 },
  dim: { opacity: 0.6 },
});
