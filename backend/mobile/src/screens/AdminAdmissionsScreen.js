import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const MODES = [
  { key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' }, { key: 'bank_transfer', label: 'Bank Transfer' },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, days) {
  const d = new Date(dateStr); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AdminAdmissionsScreen() {
  const [admissions, setAdmissions] = useState(null);
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [memberQuery, setMemberQuery] = useState('');
  const [member, setMember] = useState(null);
  const [type, setType] = useState('new');
  const [planId, setPlanId] = useState(null);
  const [trainerId, setTrainerId] = useState(null);
  const [mode, setMode] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [a, m, p, t] = await Promise.all([
        api('/api/admin/admissions'), api('/api/admin/members'), api('/api/admin/plans'), api('/api/admin/trainers'),
      ]);
      setAdmissions(a.slice(0, 30));
      setMembers(m);
      setPlans(p.filter(x => x.is_active !== false));
      setTrainers(t);
      setError(null);
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredMembers = memberQuery.trim()
    ? members.filter(m => (m.name || '').toLowerCase().includes(memberQuery.toLowerCase()) || (m.email || '').toLowerCase().includes(memberQuery.toLowerCase()))
    : [];

  const selectedPlan = plans.find(p => p.id === planId);

  function resetForm() {
    setMember(null); setMemberQuery(''); setType('new'); setPlanId(null); setTrainerId(null);
    setMode('cash'); setPaidAmount(''); setDiscount(''); setShowForm(false);
  }

  async function submit() {
    if (!member) return Alert.alert('Pick a member', 'Search and select a member first.');
    if (!selectedPlan) return Alert.alert('Pick a plan', 'Select a subscription plan.');
    setSaving(true);
    try {
      const start = todayISO();
      await api('/api/admin/admissions', {
        method: 'POST',
        body: {
          user_id: member.id, type, plan_id: planId, trainer_id: trainerId,
          payment_mode: mode, paid_amount: paidAmount || selectedPlan.price, discount: discount || 0,
          start_date: start, end_date: addDays(start, selectedPlan.duration_days || 30),
        },
      });
      Alert.alert('Admission recorded');
      resetForm();
      await load();
    } catch (e) {
      Alert.alert('Could not record admission', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitBalance(adm) {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return Alert.alert('Enter an amount', 'Enter how much was paid.');
    setPayBusy(true);
    try {
      await api(`/api/admin/admissions/${adm.id}/payment`, { method: 'POST', body: { amount: amt, payment_mode: adm.payment_mode } });
      setPayingId(null); setPayAmount('');
      await load();
    } catch (e) {
      Alert.alert('Failed', e.message);
    } finally {
      setPayBusy(false);
    }
  }

  async function remove(adm) {
    Alert.alert('Delete admission record?', null, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/admissions/${adm.id}`, { method: 'DELETE' }); load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!admissions) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Admissions</Text>

      <Button
        label={showForm ? 'Cancel' : 'New Admission'}
        variant={showForm ? 'outlined' : 'filled'}
        onPress={() => setShowForm(v => !v)}
        icon={<Ionicons name={showForm ? 'close' : 'add'} size={16} color={showForm ? colors.primary : colors.onPrimary} />}
        style={{ marginTop: 14, marginBottom: 14 }}
      />

      {showForm && (
        <Card style={{ marginBottom: 18 }}>
          <Text style={styles.label}>Member</Text>
          {member ? (
            <View style={styles.selectedMember}>
              <View>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.sub}>{member.email}</Text>
              </View>
              <TouchableOpacity onPress={() => { setMember(null); setMemberQuery(''); }}>
                <Ionicons name="close-circle" size={20} color={colors.outline} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput style={styles.input} value={memberQuery} onChangeText={setMemberQuery} placeholder="Search member by name or email" placeholderTextColor={colors.outline} />
              {filteredMembers.slice(0, 6).map(m => (
                <TouchableOpacity key={m.id} onPress={() => setMember(m)} style={styles.resultRow}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.sub}>{m.email}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <Text style={styles.label}>Type</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => setType('new')}><Chip label="New Membership" tone={type === 'new' ? 'primary' : 'default'} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setType('renewal')}><Chip label="Renewal" tone={type === 'renewal' ? 'primary' : 'default'} /></TouchableOpacity>
          </View>

          <Text style={styles.label}>Plan</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {plans.map(p => (
              <TouchableOpacity key={p.id} onPress={() => setPlanId(p.id)}>
                <Chip label={`${p.name} · ${money(p.price)}`} tone={planId === p.id ? 'primary' : 'default'} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Trainer (optional)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {trainers.map(t => (
              <TouchableOpacity key={t.id} onPress={() => setTrainerId(trainerId === t.id ? null : t.id)}>
                <Chip label={t.name} tone={trainerId === t.id ? 'primary' : 'default'} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Payment Mode</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {MODES.map(m => (
              <TouchableOpacity key={m.key} onPress={() => setMode(m.key)}>
                <Chip label={m.label} tone={mode === m.key ? 'primary' : 'default'} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Paid Amount</Text>
              <TextInput style={styles.input} value={paidAmount} onChangeText={setPaidAmount} keyboardType="numeric" placeholder={selectedPlan ? String(selectedPlan.price) : '₹'} placeholderTextColor={colors.outline} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Discount</Text>
              <TextInput style={styles.input} value={discount} onChangeText={setDiscount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.outline} />
            </View>
          </View>

          <Button
            label={saving ? '' : 'Record Admission'}
            onPress={submit}
            disabled={saving}
            icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
            style={{ marginTop: 16 }}
          />
        </Card>
      )}

      {admissions.length === 0 ? (
        <Empty icon={<Ionicons name="document-text-outline" size={30} color={colors.outline} />} text="No admissions recorded yet." />
      ) : admissions.map(a => (
        <Card key={a.id} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{a.member_name}</Text>
              <Text style={styles.sub}>{a.plan_name} · {a.admission_date} · {a.receipt_number}</Text>
            </View>
            <Chip label={a.type === 'renewal' ? 'Renewal' : 'New'} tone={a.type === 'renewal' ? 'info' : 'success'} />
          </View>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
            <Text style={styles.stat}>Paid {money(a.paid_amount)}</Text>
            {a.balance > 0 && <Text style={[styles.stat, { color: colors.warning }]}>Due {money(a.balance)}</Text>}
          </View>
          {a.balance > 0 && payingId === a.id ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="numeric"
                placeholder={`Up to ${a.balance}`}
                placeholderTextColor={colors.outline}
                autoFocus
              />
              <Button
                label={payBusy ? '' : 'Save'}
                onPress={() => submitBalance(a)}
                disabled={payBusy}
                icon={payBusy ? <ActivityIndicator color={colors.onPrimary} /> : undefined}
                style={{ paddingHorizontal: 16 }}
              />
              <TouchableOpacity onPress={() => { setPayingId(null); setPayAmount(''); }} style={{ justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color={colors.outline} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
              {a.balance > 0 && (
                <TouchableOpacity onPress={() => { setPayingId(a.id); setPayAmount(String(a.balance)); }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Record Payment</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => remove(a)}>
                <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  label: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  resultRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.outlineVar, marginTop: 6 },
  selectedMember: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceHi, borderRadius: radius.xs, padding: 12,
  },
  memberName: { color: colors.onSurface, fontSize: 14, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 2 },
  stat: { color: colors.onSurfaceVar, fontSize: 11 },
});
