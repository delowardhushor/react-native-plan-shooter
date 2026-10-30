import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLOR_ACCENT, COLOR_TEXT } from '../engine/Constants';
import { DAILY_REWARDS, type DailyStatus } from '../state/Progress';
import { GlassButton, Panel } from './ui';

interface Props {
  status: DailyStatus;
  onClaim: () => void;
  onClose: () => void;
}

// Shown once a day over the menu: seven reward slots with today's highlighted
export const DailyRewardCard = ({ status, onClaim, onClose }: Props) => (
  <View style={styles.layer}>
    <Panel style={styles.card}>
      <Text style={styles.title}>DAILY REWARD</Text>
      <Text style={styles.sub}>
        {status.streak > 1 ? `${status.streak} DAY STREAK! COME BACK TOMORROW FOR MORE` : 'COME BACK EVERY DAY FOR BIGGER REWARDS'}
      </Text>
      <View style={styles.days}>
        {DAILY_REWARDS.map((points, i) => {
          const today = i === status.dayIndex;
          const done = i < status.dayIndex;
          return (
            <View key={i} style={[styles.day, today && styles.dayToday, done && styles.dayDone]}>
              <Text style={[styles.dayLabel, today && styles.dayTodayText]}>DAY {i + 1}</Text>
              <Text style={[styles.dayStar, today && styles.dayTodayText]}>{done ? '✓' : '★'}</Text>
              <Text style={[styles.dayPoints, today && styles.dayTodayText]}>{points}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.buttons}>
        <GlassButton label={`CLAIM +${status.reward} PTS`} variant="primary" onPress={onClaim} />
        <GlassButton label="LATER" small onPress={onClose} />
      </View>
    </Panel>
  </View>
);

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  card: {
    width: 520,
    paddingVertical: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    backgroundColor: 'rgba(8, 20, 34, 0.92)',
  },
  title: { color: COLOR_TEXT, fontSize: 24, fontWeight: '900', letterSpacing: 5 },
  sub: { color: COLOR_ACCENT, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 4, marginBottom: 14, textAlign: 'center' },
  days: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dayToday: { backgroundColor: COLOR_ACCENT, borderColor: '#ffd58a' },
  dayDone: { opacity: 0.45 },
  dayLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  dayStar: { color: COLOR_ACCENT, fontSize: 18, fontWeight: '900', marginVertical: 2 },
  dayPoints: { color: COLOR_TEXT, fontSize: 14, fontWeight: '900' },
  dayTodayText: { color: '#10202e' },
  buttons: { alignSelf: 'stretch', gap: 8 },
});
