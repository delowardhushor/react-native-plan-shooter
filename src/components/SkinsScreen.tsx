import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLOR_ACCENT, COLOR_TEXT } from '../engine/Constants';
import { SKINS, unlockText, type Skin } from '../engine/Skins';
import { buzz, playSound } from '../engine/SoundManager';
import { getHero } from '../render/Sprites';
import { showRewardedAd } from '../services/Ads';
import { equippedSkin, isSkinUnlocked, type Progress } from '../state/Progress';
import { MenuBackdrop } from './MenuBackdrop';
import { SpriteIcon } from './SpriteIcon';
import { GlassButton, Panel, PointsPill } from './ui';

export interface SkinActions {
  equipSkin: (id: string) => void;
  addSkinAd: (id: string) => void;
}

interface Props {
  progress: Progress;
  actions: SkinActions;
  onBack: () => void;
}

// Hangar: pick the jet livery. Skins unlock for free, by reaching a level, or by watching rewarded ads.
export const SkinsScreen = ({ progress, actions, onBack }: Props) => {
  const current = equippedSkin(progress);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const watchAd = async (skin: Skin) => {
    if (busy) return;
    setBusy(skin.id);
    setMessage('');
    const rewarded = await showRewardedAd('skin');
    setBusy(null);
    if (rewarded) {
      playSound('pickup');
      buzz(25);
      actions.addSkinAd(skin.id);
    } else {
      setMessage('Ad unavailable or closed early. Watch the full ad to progress.');
    }
  };

  const equip = (skin: Skin) => {
    playSound('pickup');
    actions.equipSkin(skin.id);
  };

  return (
    <View style={styles.container}>
      <MenuBackdrop level={progress.level} cannon={progress.cannon} skin={current.id} />
      <View style={styles.shade} />

      <View style={styles.header}>
        <GlassButton label="‹ MENU" small onPress={onBack} />
        <View style={styles.titleWrap}>
          <Text style={styles.title}>HANGAR</Text>
          <View style={styles.titleBar} />
        </View>
        <PointsPill points={progress.points} />
      </View>

      {!!message && <Text style={styles.message}>{message}</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {SKINS.map(skin => {
          const unlocked = isSkinUnlocked(progress, skin);
          const equipped = current.id === skin.id;
          const u = skin.unlock;
          const adsDone = u.kind === 'ads' ? Math.min(progress.skinAds[skin.id] ?? 0, u.count) : 0;
          return (
            <Panel key={skin.id} style={styles.card} accent={skin.ui}>
              {equipped && (
                <View style={[styles.ribbon, { backgroundColor: skin.ui }]}>
                  <Text style={styles.ribbonText}>EQUIPPED</Text>
                </View>
              )}
              <SpriteIcon
                picture={getHero(skin.id, progress.cannon)}
                width={56}
                height={26}
                scale={2}
                color={skin.ui}
                dim={!unlocked}
              />
              <Text style={styles.name}>{skin.name}</Text>
              {unlocked ? (
                <Text style={[styles.status, { color: skin.ui }]}>UNLOCKED</Text>
              ) : (
                <Text style={styles.locked}>🔒 {unlockText(u)}</Text>
              )}

              {u.kind === 'ads' && !unlocked && (
                <View style={styles.pips}>
                  {Array.from({ length: u.count }).map((_, i) => (
                    <View key={i} style={[styles.pip, i < adsDone && { backgroundColor: skin.ui }]} />
                  ))}
                </View>
              )}
              {u.kind === 'level' && !unlocked && (
                <Text style={styles.hint}>You are on level {progress.level}</Text>
              )}
              {unlocked && <Text style={styles.hint}>Looks only, no stat changes</Text>}

              <View style={styles.spacer} />
              {unlocked ? (
                <GlassButton
                  label={equipped ? 'EQUIPPED' : 'EQUIP'}
                  small
                  variant={equipped ? 'secondary' : 'primary'}
                  disabled={equipped}
                  onPress={() => equip(skin)}
                />
              ) : u.kind === 'ads' ? (
                <GlassButton
                  label={busy === skin.id ? 'LOADING AD…' : 'WATCH AD'}
                  sublabel={`${adsDone}/${u.count}`}
                  small
                  variant="ad"
                  disabled={!!busy}
                  onPress={() => watchAd(skin)}
                />
              ) : (
                <GlassButton label="LOCKED" small disabled onPress={() => {}} />
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
  message: { color: '#ff9a8d', fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 6, letterSpacing: 1 },
  cards: { paddingHorizontal: 20, paddingVertical: 14, gap: 12, alignItems: 'stretch' },
  card: { width: 190, alignItems: 'center', paddingTop: 12, paddingBottom: 12, paddingHorizontal: 14 },
  ribbon: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, zIndex: 5 },
  ribbonText: { color: '#10202e', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  name: { color: COLOR_TEXT, fontSize: 14, fontWeight: '900', letterSpacing: 3, marginTop: 6 },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 3, marginTop: 6 },
  locked: { color: '#ff8a7e', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 6 },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  pips: { flexDirection: 'row', gap: 4, marginTop: 10 },
  pip: { width: 18, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  spacer: { flex: 1, minHeight: 8 },
});
