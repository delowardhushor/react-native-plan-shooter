import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { COLOR_ACCENT, COLOR_PANEL, COLOR_PANEL_BORDER, COLOR_TEXT } from '../engine/Constants';
import { isMuted, setMuted, subscribeMuted } from '../engine/SoundManager';

type Variant = 'primary' | 'secondary' | 'ad';

interface ButtonProps {
  label: string;
  sublabel?: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Chunky arcade button: a glossy top half and a darker lip underneath make it read as pressable
export const GlassButton = ({ label, sublabel, onPress, variant = 'secondary', disabled, small, style }: ButtonProps) => {
  const lit = variant !== 'secondary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.button, small && styles.small, disabled ? styles.disabled : variantStyles[variant], style]}
    >
      {!disabled && <View style={[styles.gloss, small && styles.glossSmall]} pointerEvents="none" />}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[styles.label, small && styles.smallLabel, lit && !disabled && styles.darkLabel, disabled && styles.disabledLabel]}
      >
        {label}
      </Text>
      {!!sublabel && (
        <Text style={[styles.sublabel, lit && !disabled && styles.darkLabel, disabled && styles.disabledLabel]}>{sublabel}</Text>
      )}
    </TouchableOpacity>
  );
};

interface PanelProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string; // border and top-glow colour, any CSS colour
}

// Card with a Skia gradient body, a soft highlight along the top and a thin accent rim
export const Panel = ({ children, style, accent }: PanelProps) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(s => (s.w === width && s.h === height ? s : { w: width, h: height }));
  };
  const radius = 18;
  return (
    <View style={[styles.panel, style]} onLayout={onLayout}>
      {size.w > 0 && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <RoundedRect x={0} y={0} width={size.w} height={size.h} r={radius}>
            <LinearGradient start={vec(0, 0)} end={vec(0, size.h)} colors={['rgba(32,62,98,0.95)', 'rgba(10,22,40,0.97)', 'rgba(6,14,28,0.98)']} />
          </RoundedRect>
          <RoundedRect x={1} y={1} width={size.w - 2} height={size.h * 0.42} r={radius - 1}>
            <LinearGradient start={vec(0, 0)} end={vec(0, size.h * 0.42)} colors={[accent ? `${accent}55` : 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} />
          </RoundedRect>
          <RoundedRect x={0.75} y={0.75} width={size.w - 1.5} height={size.h - 1.5} r={radius} style="stroke" strokeWidth={1.5}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, size.h)}
              colors={[accent ?? 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.1)']}
            />
          </RoundedRect>
        </Canvas>
      )}
      {children}
    </View>
  );
};

// Star rating, e.g. 2 of 3 lit
export const Stars = ({ count, max = 3, size = 14 }: { count: number; max?: number; size?: number }) => (
  <View style={styles.starsRow}>
    {Array.from({ length: max }).map((_, i) => (
      <Text key={i} style={[styles.star, { fontSize: size, lineHeight: size + 4 }, i < count && styles.starOn]}>★</Text>
    ))}
  </View>
);

export const PointsPill = ({ points }: { points: number }) => (
  <View style={styles.pill}>
    <View style={styles.coin}>
      <Text style={styles.coinStar}>★</Text>
    </View>
    <Text style={styles.pillText}>{points}</Text>
    <Text style={styles.pillUnit}>PTS</Text>
  </View>
);

// Round speaker button that toggles all sound, music and vibration
export const SoundToggle = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const [muted, setMutedState] = useState(isMuted());
  useEffect(() => {
    setMutedState(isMuted());
    return subscribeMuted(setMutedState);
  }, []);
  return (
    <TouchableOpacity onPress={() => setMuted(!muted)} activeOpacity={0.7} style={[styles.soundBtn, style]}>
      <Text style={[styles.soundIcon, muted && styles.soundIconOff]}>{muted ? '🔇' : '🔊'}</Text>
    </TouchableOpacity>
  );
};

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: COLOR_ACCENT, borderColor: '#ffd58a', borderBottomColor: '#b8701a' },
  secondary: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: COLOR_PANEL_BORDER, borderBottomColor: 'rgba(0,0,0,0.35)' },
  ad: { backgroundColor: '#3ecf7a', borderColor: '#9cf0c0', borderBottomColor: '#1f8a4c' },
});

const styles = StyleSheet.create({
  button: {
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  small: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 3 },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  glossSmall: { height: '45%' },
  disabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderBottomColor: 'rgba(0,0,0,0.3)',
  },
  label: { color: COLOR_TEXT, fontSize: 15, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  smallLabel: { fontSize: 12, letterSpacing: 1.5 },
  darkLabel: { color: '#10202e' },
  disabledLabel: { color: 'rgba(255,255,255,0.38)' },
  sublabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 2, color: COLOR_TEXT, textAlign: 'center' },
  panel: {
    borderRadius: 18,
    borderWidth: 0,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 6,
    backgroundColor: COLOR_PANEL,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,178,62,0.55)',
  },
  coin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLOR_ACCENT,
    borderWidth: 2,
    borderColor: '#ffe0a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinStar: { color: '#8a4b00', fontSize: 16, fontWeight: '900', marginTop: -1 },
  pillText: { color: COLOR_TEXT, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  pillUnit: { color: COLOR_ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 2, alignSelf: 'flex-end', marginBottom: 4 },
  starsRow: { flexDirection: 'row', gap: 2 },
  star: { color: 'rgba(255,255,255,0.22)', fontWeight: '900' },
  starOn: { color: COLOR_ACCENT },
  soundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLOR_PANEL,
    borderWidth: 1.5,
    borderColor: COLOR_PANEL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundIcon: { fontSize: 18 },
  soundIconOff: { opacity: 0.6 },
});
