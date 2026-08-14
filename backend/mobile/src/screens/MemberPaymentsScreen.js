import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Button, SectionTitle, Empty } from '../components/Common';
import { colors, spacing } from '../theme';
import { api } from '../api';

const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const STATUS_TONE = { paid: 'success', pending: 'warning', refunded: 'error' };

export default function MemberPaymentsScreen() {
  const [payments, setPayments] = useState(null);
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [planId, setPlanId] = useState(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [p, pl] = await Promise.all([api('/api/me/payments'), api('/api/plans')]);
      setPayments(p); setPlans(pl);
      setError(null);
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function requestRenewal() {
    if (!planId) return Alert.alert('Pick a plan', 'Select which plan you want to renew.');
    setRequesting(true);
    try {
      await api('/api/me/payments/request', { method: 'POST', body: { plan_id: planId } });
      Alert.alert('Request sent', 'Front desk will confirm your payment and activate the plan.');
      setShowRenew(false); setPlanId(null);
      await load();
    } catch (e) {
      Alert.alert('Could not send request', e.message);
    } finally {
      setRequesting(false);
    }
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!payments || !plans) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Payment History</Text>

      <Button
        label={showRenew ? 'Cancel' : 'Request Renewal'}
        variant={showRenew ? 'outlined' : 'filled'}
        onPress={() => setShowRenew(v => !v)}
        icon={<Ionicons name={showRenew ? 'close' : 'refresh'} size={16} color={showRenew ? colors.primary : colors.onPrimary} />}
        style={{ marginTop: 14, marginBottom: 14 }}
      />

      {showRenew && (
        <Card style={{ marginBottom: 18 }}>
          <Text style={styles.label}>Choose a plan</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {plans.map(p => (
              <TouchableOpacity key={p.id} onPress={() => setPlanId(p.id)}>
                <Chip label={`${p.name} · ${money(p.price)}`} tone={planId === p.id ? 'primary' : 'default'} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>Sends a renewal request to the front desk. They'll confirm your payment method in person or on WhatsApp.</Text>
          <Button
            label={requesting ? '' : 'Send Request'}
            onPress={requestRenewal}
            disabled={requesting}
            icon={requesting ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}

      <SectionTitle>Payments</SectionTitle>
      {payments.length === 0 ? (
        <Empty icon={<Ionicons name="receipt-outline" size={30} color={colors.outline} />} text="No payments yet." />
      ) : payments.map(p => (
        <Card key={p.id} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{p.plan_name}</Text>
              <Text style={styles.hint}>{p.payment_date} · {(p.method || 'cash').toUpperCase()}</Text>
              {p.notes ? <Text style={styles.hint}>{p.notes}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amount}>{money(p.amount)}</Text>
              <Chip label={p.status} tone={STATUS_TONE[p.status] || 'default'} style={{ marginTop: 4 }} />
            </View>
          </View>
        </Card>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  label: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '600' },
  hint: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 4 },
  planName: { color: colors.onSurface, fontSize: 14, fontWeight: '700' },
  amount: { color: colors.onSurface, fontSize: 15, fontWeight: '800', fontFamily: 'Menlo' },
});
