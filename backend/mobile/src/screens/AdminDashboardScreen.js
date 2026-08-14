import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, StatCard, SectionTitle, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const MENU = [
  { key: 'AdminFinance', icon: 'cash', label: 'Finance', sub: 'Revenue, payments, receipts' },
  { key: 'AdminAdmissions', icon: 'document-text', label: 'Admissions', sub: 'New memberships, renewals, receipts' },
  { key: 'AdminTrainers', icon: 'body', label: 'Trainers & PT', sub: 'Trainers, packages, PT assignments' },
  { key: 'AdminBatches', icon: 'people', label: 'Batches', sub: 'Morning/Evening groups, capacity' },
  { key: 'AdminEnquiries', icon: 'chatbubbles', label: 'Enquiries', sub: 'Book Visit & Contact submissions' },
  { key: 'AdminCheckinQr', icon: 'qr-code', label: 'Check-in QR', sub: 'Print or regenerate the entrance code' },
  { key: 'AdminExpenses', icon: 'receipt', label: 'Expenses', sub: 'Rent, salary, maintenance, etc.' },
  { key: 'AdminReports', icon: 'bar-chart', label: 'Reports', sub: 'Trends, attendance, profit split' },
];

const ADMIN_ONLY_MENU = [
  { key: 'AdminStaff', icon: 'shield-checkmark', label: 'Staff & Permissions', sub: 'Front-desk accounts and access' },
];

export default function AdminDashboardScreen({ navigation, isAdmin }) {
  const [dash, setDash] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await api('/api/admin/dashboard');
      setDash(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Dashboard</Text>

      {error ? (
        <Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} />
      ) : !dash ? (
        <Text style={styles.hint}>Loading…</Text>
      ) : (
        <>
          <View style={styles.row}>
            <StatCard label="Revenue Today" value={money(dash.today.revenue)} sub={`${dash.today.admissions} admissions`} style={styles.half} />
            <StatCard label="Check-ins Today" value={dash.today.attendance} style={styles.half} />
          </View>
          <View style={styles.row}>
            <StatCard label="Revenue (Month)" value={money(dash.monthly.revenue)} style={styles.half} />
            <StatCard
              label="Profit (Month)"
              value={money(dash.monthly.profit)}
              style={styles.half}
            />
          </View>
          <View style={styles.row}>
            <StatCard label="Active Members" value={dash.activeMembers} style={styles.half} />
            <StatCard label="Outstanding" value={money(dash.outstanding.s)} sub={`${dash.outstanding.n || 0} balances due`} style={styles.half} />
          </View>

          {dash.expiringMemberships?.length > 0 && (
            <>
              <SectionTitle>Expiring in 14 Days</SectionTitle>
              <Card>
                {dash.expiringMemberships.slice(0, 5).map((m, i) => (
                  <View key={m.id} style={[styles.expRow, i > 0 && styles.expRowBorder]}>
                    <Text style={styles.expName}>{m.name}</Text>
                    <Text style={styles.expDate}>{m.subscription_expiry}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <SectionTitle>Manage</SectionTitle>
      {[...MENU, ...(isAdmin ? ADMIN_ONLY_MENU : [])].map((item) => (
        <TouchableOpacity key={item.key} activeOpacity={0.8} onPress={() => navigation.navigate(item.key, { isAdmin })}>
          <Card style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={styles.menuIcon}><Ionicons name={item.icon} size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.outline} />
          </Card>
        </TouchableOpacity>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800', marginBottom: 16 },
  hint: { color: colors.onSurfaceVar, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  half: { flex: 1 },
  expRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  expRowBorder: { borderTopWidth: 1, borderTopColor: colors.outlineVar },
  expName: { color: colors.onSurface, fontSize: 13, fontWeight: '600' },
  expDate: { color: colors.onSurfaceVar, fontSize: 12 },
  menuIcon: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { color: colors.onSurface, fontSize: 14, fontWeight: '700' },
  menuSub: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 1 },
});
