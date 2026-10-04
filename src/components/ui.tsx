import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLOR_ACCENT, COLOR_PANEL, COLOR_PANEL_BORDER, COLOR_TEXT } from '../engine/Constants';

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

export const GlassButton = ({ label, sublabel, onPress, variant = 'secondary', disabled, small, style }: ButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.75}
    style={[styles.button, small && styles.small, variantStyles[variant], disabled && styles.disabled, style]}
  >
    <Text style={[styles.label, small && styles.smallLabel, variant !== 'secondary' && styles.darkLabel]}>{label}</Text>
    {!!sublabel && <Text style={[styles.sublabel, variant !== 'secondary' && styles.darkLabel]}>{sublabel}</Text>}
  </TouchableOpacity>
);

export const Panel = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.panel, style]}>{children}</View>
);

export const PointsPill = ({ points }: { points: number }) => (
  <View style={styles.pill}>
    <Text style={styles.pillStar}>★</Text>
    <Text style={styles.pillText}>{points}</Text>
    <Text style={styles.pillUnit}>PTS</Text>
  </View>
);

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: COLOR_ACCENT, borderColor: '#ffd58a' },
  secondary: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: COLOR_PANEL_BORDER },
  ad: { backgroundColor: '#3ecf7a', borderColor: '#9cf0c0' },
});

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  disabled: { opacity: 0.4 },
  label: { color: COLOR_TEXT, fontSize: 15, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  smallLabel: { fontSize: 12, letterSpacing: 1.5 },
  darkLabel: { color: '#10202e' },
  sublabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 2, color: COLOR_TEXT, textAlign: 'center' },
  panel: {
    backgroundColor: COLOR_PANEL,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLOR_PANEL_BORDER,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLOR_PANEL,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLOR_PANEL_BORDER,
  },
  pillStar: { color: COLOR_ACCENT, fontSize: 18, fontWeight: '900' },
  pillText: { color: COLOR_TEXT, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  pillUnit: { color: COLOR_ACCENT, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
});
