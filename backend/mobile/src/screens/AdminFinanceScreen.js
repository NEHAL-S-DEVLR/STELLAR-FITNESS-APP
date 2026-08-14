import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, StatCard, Chip, SectionTitle, Empty } from '../components/Common';
import { colors, spacing } from '../theme';
import { api } from '../api';

const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const STATUS_TONE = { paid: 'success', pending: 'warning', refunded: 'error' };

export default function AdminFinanceScreen() {
  const [finance, setFinance] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [f, p] = await Promise.all([api('/api/admin/finance'), api('/api/admin/payments')]);
      setFinance(f);
      setPayments(p);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendReceipt(payment) {
    setSendingId(payment.id);
    try {
      const res = await api(`/api/admin/payments/${payment.id}/receipt`, { method: 'POST' });
      if (res.mode === 'link' && res.link) Linking.openURL(res.link);
      else Alert.alert('Sent', `Receipt sent to ${payment.member_name}.`);
    } catch (e) {
      Alert.alert('Could not send receipt', e.message);
    } finally {
      setSendingId(null);
    }
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!finance || !payments) return <View style={styles.center}><Text style={styles.hint}>Loading…</Text></View>;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      data={payments}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>Finance</Text>
          <View style={styles.row}>
            <StatCard label="Revenue (Month)" value={money(finance.mtdRevenue)} style={styles.half} />
            <StatCard label="Revenue (Year)" value={money(finance.ytdRevenue)} style={styles.half} />
          </View>
          <View style={styles.row}>
            <StatCard label="Gym Revenue (Month)" value={money(finance.gymRevenue.mtd)} sub="Membership only" style={styles.half} />
            <StatCard label="PT Revenue (Month)" value={money(finance.ptRevenue.mtd)} style={styles.half} />
          </View>
          <View style={styles.row}>
            <StatCard label="Pending" value={money(finance.pendingAmount)} sub={`${finance.pendingCount} payments`} style={styles.half} />
            <StatCard label="Active Subs" value={finance.activeSubscriptions} style={styles.half} />
          </View>
          <SectionTitle>Recent Payments</SectionTitle>
        </View>
      }
      ListEmptyComponent={<Empty icon={<Ionicons name="cash-outline" size={30} color={colors.outline} />} text="No payments recorded yet." />}
      renderItem={({ item }) => (
        <Card style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.member_name || '—'}</Text>
              <Text style={styles.sub}>{item.plan_name} · {item.payment_date}</Text>
            </View>
            <Text style={styles.amount}>{money(item.amount)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Chip label={item.status} tone={STATUS_TONE[item.status] || 'default'} />
            <TouchableOpacity onPress={() => sendReceipt(item)} disabled={sendingId === item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="logo-whatsapp" size={16} color={colors.primary} />
              <Text style={styles.receiptLink}>{sendingId === item.id ? 'Sending…' : 'Send Receipt'}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  hint: { color: colors.onSurfaceVar, fontSize: 13 },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  half: { flex: 1 },
  name: { color: colors.onSurface, fontSize: 14, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 2 },
  amount: { color: colors.onSurface, fontSize: 15, fontWeight: '800', fontFamily: 'Menlo' },
  receiptLink: { color: colors.primary, fontSize: 12, fontWeight: '600' },
});
