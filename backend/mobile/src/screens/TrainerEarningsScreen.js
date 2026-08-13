import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Card, StatCard, SectionTitle, Empty } from '../components/Common';
import { colors, spacing } from '../theme';
import { api } from '../api';

const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function TrainerEarningsScreen() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const s = await api('/api/trainer/stats');
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!stats && !error) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (error) {
    return <View style={styles.center}><Empty text={error} /></View>;
  }

  const rateLabel = stats.trainer.is_partner
    ? 'Partner · 100% of PT'
    : `${stats.ptRate}% PT · ${stats.membershipRate}% membership`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Earnings</Text>

      <Card tinted style={{ marginTop: 16 }}>
        <Text style={styles.lbl}>THIS MONTH'S COMMISSION</Text>
        <Text style={styles.big}>{money(stats.mtd.commissionEarned)}</Text>
        <Text style={styles.sub}>{rateLabel}</Text>
      </Card>

      <View style={styles.row}>
        <StatCard label="Revenue (MTD)" value={money(stats.mtd.totalRevenue)} style={styles.half} />
        <StatCard label="Active Clients" value={stats.activeClients} sub="10+ unlocks higher rate" style={styles.half} />
      </View>

      <SectionTitle>Breakdown — This Month</SectionTitle>
      <Card>
        <Row label="Admissions revenue" value={money(stats.mtd.admissionRevenue)} />
        <Row label="PT revenue" value={money(stats.mtd.ptRevenue)} />
        <Row label="Monthly target" value={stats.mtd.targetProgress != null ? `${stats.mtd.targetProgress}%` : 'No target set'} last />
      </Card>

      <SectionTitle>Year to Date</SectionTitle>
      <Card>
        <Row label="PT sessions" value={stats.ytd.ptSessions} />
        <Row label="PT revenue" value={money(stats.ytd.ptRevenue)} last />
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.tableRow, !last && styles.tableRowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  lbl: { fontSize: 10, fontWeight: '700', color: colors.onSurfaceVar, letterSpacing: 0.6 },
  big: { fontSize: 32, fontWeight: '800', color: colors.onSurface, marginTop: 6 },
  sub: { fontSize: 12, color: colors.onSurfaceVar, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  half: { flex: 1 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.outlineVar },
  rowLabel: { color: colors.onSurfaceVar, fontSize: 13 },
  rowValue: { color: colors.onSurface, fontSize: 13, fontWeight: '700' },
});
