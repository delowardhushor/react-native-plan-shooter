import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { registerAdPresenter } from '../services/Ads';
import { COLOR_ACCENT, COLOR_TEXT } from '../engine/Constants';
import { GlassButton, Panel } from './ui';

const AD_SECONDS = 4;

// Stand-in for a rewarded video until AdMob is wired up. Closing early forfeits the reward,
// exactly like a real rewarded ad.
export const AdOverlay = () => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const resolver = useRef<((rewarded: boolean) => void) | null>(null);

  const finish = useCallback((rewarded: boolean) => {
    resolver.current?.(rewarded);
    resolver.current = null;
    setRemaining(null);
  }, []);

  useEffect(
    () =>
      registerAdPresenter(
        () =>
          new Promise<boolean>(resolve => {
            resolver.current = resolve;
            setRemaining(AD_SECONDS);
          }),
      ),
    [],
  );

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const t = setTimeout(() => setRemaining(r => (r === null ? r : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  if (remaining === null) return null;
  const done = remaining <= 0;

  return (
    <View style={styles.backdrop}>
      <Panel style={styles.card}>
        <Text style={styles.tag}>SIMULATED REWARDED AD</Text>
        <Text style={styles.title}>{done ? 'REWARD READY' : 'WATCHING AD…'}</Text>
        <Text style={styles.body}>
          {done ? 'Thanks for watching!' : `Reward unlocks in ${remaining}s`}
        </Text>
        <View style={styles.row}>
          {done ? (
            <GlassButton label="CLAIM REWARD" variant="ad" onPress={() => finish(true)} />
          ) : (
            <GlassButton label="CLOSE (NO REWARD)" small onPress={() => finish(false)} />
          )}
        </View>
      </Panel>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 8, 16, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  card: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 44, backgroundColor: 'rgba(8,20,34,0.95)' },
  tag: { color: COLOR_ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  title: { color: COLOR_TEXT, fontSize: 30, fontWeight: '900', letterSpacing: 3, marginTop: 8 },
  body: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700', letterSpacing: 1, marginTop: 8 },
  row: { marginTop: 20 },
});
