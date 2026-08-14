import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Card({ children, style, tinted, gradient }) {
  return (
    <View style={[styles.card, tinted && styles.cardTinted, gradient && styles.cardGradient, style]}>
      {children}
    </View>
  );
}

export function StatCard({ label, value, sub, style, tinted }) {
  return (
    <Card tinted={tinted} style={[styles.stat, style]}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </Card>
  );
}

export function Chip({ label, tone = 'default', style }) {
  const t = TONES[tone] || TONES.default;
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.chipLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const TONES = {
  default: { bg: colors.surfaceHi,        border: colors.outlineVar,          fg: colors.onSurfaceVar },
  primary: { bg: 'rgba(59,130,246,0.14)',  border: 'rgba(59,130,246,0.30)',   fg: colors.primary },
  success: { bg: 'rgba(52,211,153,0.14)',  border: 'rgba(52,211,153,0.30)',   fg: colors.success },
  warning: { bg: 'rgba(251,191,36,0.14)',  border: 'rgba(251,191,36,0.30)',   fg: colors.warning },
  error:   { bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.30)',  fg: colors.error },
  info:    { bg: 'rgba(96,165,250,0.14)',  border: 'rgba(96,165,250,0.30)',   fg: colors.info },
};

export function Button({ label, onPress, disabled, variant = 'filled', icon, style }) {
  const v = VARIANTS[variant] || VARIANTS.filled;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[styles.btn, { backgroundColor: v.bg, borderColor: v.border || 'transparent' }, disabled && { opacity: 0.4 }, style]}
    >
      {icon}
      <Text style={[styles.btnLabel, { color: v.fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const VARIANTS = {
  filled:   { bg: colors.primary,          fg: colors.onPrimary },
  tonal:    { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
  outlined: { bg: 'transparent',           fg: colors.primary,           border: colors.outline },
  text:     { bg: 'transparent',           fg: colors.primary },
  danger:   { bg: 'rgba(255,180,171,0.12)', fg: colors.error },
};

export function Empty({ icon, text }) {
  return (
    <View style={styles.empty}>
      {icon ? <View style={{ marginBottom: 6 }}>{icon}</View> : null}
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ children, style }) {
  return <Text style={[styles.sectionTitle, style]}>{String(children).toUpperCase()}</Text>;
}

export function ProgressBar({ value, tone = 'primary' }) {
  const pct = Math.max(0, Math.min(1, value || 0));
  const t = TONES[tone] || TONES.primary;
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: t.fg }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceVar,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTinted: {
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  cardGradient: {
    backgroundColor: colors.primaryContainer,
  },
  stat: { paddingVertical: 16, paddingHorizontal: 16 },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.onSurfaceVar, letterSpacing: 0.6 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.onSurface, marginTop: 4 },
  statSub:   { fontSize: 11, color: colors.onSurfaceVar, marginTop: 2 },
  chip: {
    paddingVertical: 3, paddingHorizontal: 8,
    borderRadius: radius.xs, borderWidth: 1, alignSelf: 'flex-start',
  },
  chipLabel: { fontSize: 11, fontWeight: '700' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.full,
    borderWidth: 1,
  },
  btnLabel: { fontSize: 14, fontWeight: '700' },
  empty: {
    padding: 30, alignItems: 'center',
    backgroundColor: colors.surfaceVar, borderRadius: radius.md,
    borderStyle: 'dashed', borderWidth: 1, borderColor: colors.outlineVar,
  },
  emptyText: { color: colors.onSurfaceVar, fontSize: 13, textAlign: 'center' },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.onSurfaceVar,
    letterSpacing: 1, marginTop: 20, marginBottom: 10,
  },
  progressBg: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
});
