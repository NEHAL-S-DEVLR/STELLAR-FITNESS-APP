import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, StatCard, Chip, SectionTitle, Empty } from '../components/Common';
import { colors, spacing } from '../theme';
import { api } from '../api';

const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function yearStart() { return `${new Date().getFullYear()}-01-01`; }
function lastMonthRange() {
  const d = new Date(); const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const lme = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: lm.toISOString().slice(0, 10), to: lme.toISOString().slice(0, 10) };
}

const RANGES = [
  { key: 'month', label: 'This Month' },
  { key: 'last', label: 'Last Month' },
  { key: 'year', label: 'This Year' },
];

export default function AdminReportsScreen() {
  const [tab, setTab] = useState('range');
  const [range, setRange] = useState('month');
  const [report, setReport] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const rangeDates = () => {
    if (range === 'last') return lastMonthRange();
    if (range === 'year') return { from: yearStart(), to: todayISO() };
    return { from: monthStart(), to: todayISO() };
  };

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { from, to } = rangeDates();
      const [r, m] = await Promise.all([
        api(`/api/admin/reports?from=${from}&to=${to}`), api('/api/admin/reports/monthly-summary'),
      ]);
      setReport(r); setMonthly(m);
      setError(null);
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!report || !monthly) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Reports</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 18 }}>
        {['range', 'split'].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.7} style={{ flex: 1 }}>
            <View style={[styles.subTab, tab === t && styles.subTabActive]}>
              <Text style={[styles.subTabText, tab === t && styles.subTabTextActive]}>{t === 'range' ? 'Trends' : 'Profit Split'}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'range' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {RANGES.map(r => (
              <TouchableOpacity key={r.key} onPress={() => setRange(r.key)}>
                <Chip label={r.label} tone={range === r.key ? 'primary' : 'default'} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <StatCard label="Revenue" value={money(report.revenue.total)} sub={`${report.revenue.count} payments`} style={styles.half} />
            <StatCard label="Expenses" value={money(report.expenses.total)} sub={`${report.expenses.count} entries`} style={styles.half} />
          </View>
          <View style={styles.row}>
            <StatCard label="Admissions" value={report.admissions.total_count} sub={`${report.admissions.new_count} new · ${report.admissions.renewal_count} renewals`} style={styles.half} />
            <StatCard label="Attendance" value={report.attendance.total} sub={`${report.attendance.unique} unique · ${report.attendance.days} days`} style={styles.half} />
          </View>

          <SectionTitle>Revenue by Method</SectionTitle>
          <Card>
            {report.revenue.by_method.length === 0 ? (
              <Text style={styles.hint}>No revenue in this period.</Text>
            ) : report.revenue.by_method.map((m, i) => (
              <View key={m.method} style={[styles.rowLine, i > 0 && styles.rowBorder]}>
                <Text style={styles.rowLabel}>{m.method.toUpperCase()}</Text>
                <Text style={styles.rowValue}>{money(m.total)} · {m.count}</Text>
              </View>
            ))}
          </Card>

          <SectionTitle>Expenses by Category</SectionTitle>
          <Card>
            {report.expenses.by_category.length === 0 ? (
              <Text style={styles.hint}>No expenses in this period.</Text>
            ) : report.expenses.by_category.map((c, i) => (
              <View key={c.category} style={[styles.rowLine, i > 0 && styles.rowBorder]}>
                <Text style={styles.rowLabel}>{c.category}</Text>
                <Text style={styles.rowValue}>{money(c.total)} · {c.count}</Text>
              </View>
            ))}
          </Card>

          <SectionTitle>Trainer Performance</SectionTitle>
          {report.trainers.map(t => (
            <Card key={t.id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.memberName}>{t.name}</Text>
                <Text style={styles.rowValue}>{money(t.commission)} commission</Text>
              </View>
              <Text style={styles.hint}>{money(t.revenue)} revenue · {t.admissions} admissions · {t.active_clients} active PT clients</Text>
            </Card>
          ))}

          <SectionTitle>Personal Training</SectionTitle>
          <Card>
            <Text style={styles.hint}>{money(report.pt.revenue)} revenue · {report.pt.assignments} assignments · {report.pt.members} members</Text>
          </Card>
        </>
      ) : (
        <>
          <Card style={{ marginBottom: 14 }}>
            <Text style={styles.hint}>Net profit split 50/50 between {monthly.companyName} and partner trainer {monthly.partnerName}.</Text>
          </Card>
          {monthly.months.length === 0 ? (
            <Empty icon={<Ionicons name="bar-chart-outline" size={30} color={colors.outline} />} text="No activity recorded yet." />
          ) : monthly.months.map(m => (
            <Card key={m.month} style={{ marginBottom: 8 }}>
              <Text style={styles.memberName}>{m.month}</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                <Text style={styles.hint}>Revenue {money(m.revenue)}</Text>
                <Text style={styles.hint}>Expenses {money(m.expenses)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                <Text style={[styles.hint, { color: m.netProfit >= 0 ? colors.success : colors.error }]}>Net Profit {money(m.netProfit)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                <Text style={styles.hint}>{monthly.companyName}: {money(m.companyShare)}</Text>
                <Text style={styles.hint}>{monthly.partnerName}: {money(m.partnerShare)}</Text>
              </View>
            </Card>
          ))}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  half: { flex: 1 },
  hint: { color: colors.onSurfaceVar, fontSize: 12 },
  subTab: { paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: colors.surfaceHi },
  subTabActive: { backgroundColor: colors.primary },
  subTabText: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '700' },
  subTabTextActive: { color: colors.onPrimary },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVar },
  rowLabel: { color: colors.onSurface, fontSize: 12, fontWeight: '600' },
  rowValue: { color: colors.onSurfaceVar, fontSize: 12 },
  memberName: { color: colors.onSurface, fontSize: 14, fontWeight: '700' },
});
