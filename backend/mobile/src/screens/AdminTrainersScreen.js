import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button, SectionTitle } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const SUB_TABS = ['Trainers', 'Packages', 'Assignments'];
const ASSIGN_STATUS_TONE = { active: 'success', completed: 'default', cancelled: 'error' };

export default function AdminTrainersScreen({ navigation, route }) {
  const isAdmin = route.params?.isAdmin;
  const [tab, setTab] = useState('Trainers');
  const [trainers, setTrainers] = useState(null);
  const [packages, setPackages] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [pkgName, setPkgName] = useState('');
  const [pkgPrice, setPkgPrice] = useState('');
  const [pkgDays, setPkgDays] = useState('90');
  const [addingPkg, setAddingPkg] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [t, p, a] = await Promise.all([
        api('/api/admin/trainers'), api('/api/admin/pt-packages'), api('/api/admin/pt-assignments?status=active'),
      ]);
      setTrainers(t); setPackages(p); setAssignments(a);
      setError(null);
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addPackage() {
    if (!pkgName.trim() || !pkgPrice) return Alert.alert('Missing info', 'Name and price required.');
    setAddingPkg(true);
    try {
      await api('/api/admin/pt-packages', { method: 'POST', body: { name: pkgName.trim(), price: pkgPrice, validity_days: pkgDays } });
      setPkgName(''); setPkgPrice(''); setPkgDays('90');
      await load();
    } catch (e) { Alert.alert('Could not add package', e.message); } finally { setAddingPkg(false); }
  }

  async function deletePackage(pkg) {
    Alert.alert('Delete package?', null, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/pt-packages/${pkg.id}`, { method: 'DELETE' }); load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  async function cancelAssignment(a) {
    Alert.alert('Cancel PT assignment?', 'This also removes its payment from revenue.', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Assignment', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/pt-assignments/${a.id}`, { method: 'PATCH', body: { status: 'cancelled' } }); load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!trainers) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Trainers & PT</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 18 }}>
        {SUB_TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.7} style={{ flex: 1 }}>
            <View style={[styles.subTab, tab === t && styles.subTabActive]}>
              <Text style={[styles.subTabText, tab === t && styles.subTabTextActive]}>{t}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Trainers' && (
        <>
          {isAdmin && (
            <Button
              label="Add Trainer"
              onPress={() => navigation.navigate('AdminAddTrainer')}
              icon={<Ionicons name="person-add" size={16} color={colors.onPrimary} />}
              style={{ marginBottom: 14 }}
            />
          )}
          {trainers.length === 0 ? (
            <Empty icon={<Ionicons name="body-outline" size={30} color={colors.outline} />} text="No trainers yet." />
          ) : trainers.map((t) => (
            <Card key={t.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.sub}>{t.specialization || 'No specialization set'}</Text>
                </View>
                <Chip label={t.is_partner ? 'Partner · 100%' : `${t.membership_rate ?? t.pt_rate ?? ''}%`} tone="primary" />
              </View>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                <Text style={styles.stat}>{money(t.revenue)} revenue (MTD)</Text>
                <Text style={styles.stat}>{money(t.commission)} commission</Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {tab === 'Packages' && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <TextInput style={styles.input} placeholder="Package name" placeholderTextColor={colors.outline} value={pkgName} onChangeText={setPkgName} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="₹ Price" placeholderTextColor={colors.outline} value={pkgPrice} onChangeText={setPkgPrice} keyboardType="numeric" />
              <TextInput style={[styles.input, { width: 90 }]} placeholder="Days" placeholderTextColor={colors.outline} value={pkgDays} onChangeText={setPkgDays} keyboardType="numeric" />
            </View>
            <Button
              label={addingPkg ? '' : 'Add Package'}
              onPress={addPackage}
              disabled={addingPkg}
              icon={addingPkg ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={16} color={colors.onPrimary} />}
              style={{ marginTop: 10 }}
            />
          </Card>
          {packages.length === 0 ? (
            <Empty icon={<Ionicons name="cube-outline" size={30} color={colors.outline} />} text="No PT packages yet." />
          ) : packages.map((p) => (
            <Card key={p.id} style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.sub}>{money(p.price)} · {p.validity_days} days</Text>
              </View>
              <TouchableOpacity onPress={() => deletePackage(p)}><Ionicons name="trash-outline" size={18} color={colors.error} /></TouchableOpacity>
            </Card>
          ))}
        </>
      )}

      {tab === 'Assignments' && (
        <>
          <Button
            label="New Assignment"
            onPress={() => navigation.navigate('AdminNewAssignment')}
            icon={<Ionicons name="add" size={16} color={colors.onPrimary} />}
            style={{ marginBottom: 14 }}
          />
          {!assignments || assignments.length === 0 ? (
            <Empty icon={<Ionicons name="clipboard-outline" size={30} color={colors.outline} />} text="No active PT assignments." />
          ) : assignments.map((a) => (
            <Card key={a.id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{a.member_name}</Text>
                  <Text style={styles.sub}>{money(a.price_paid)} · started {a.start_date}</Text>
                </View>
                <Chip label={a.status} tone={ASSIGN_STATUS_TONE[a.status] || 'default'} />
              </View>
              {a.status === 'active' && (
                <TouchableOpacity onPress={() => cancelAssignment(a)} style={{ marginTop: 10 }}>
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>Cancel Assignment</Text>
                </TouchableOpacity>
              )}
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
  subTab: { paddingVertical: 8, borderRadius: radius.full, alignItems: 'center', backgroundColor: colors.surfaceHi },
  subTabActive: { backgroundColor: colors.primary },
  subTabText: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '700' },
  subTabTextActive: { color: colors.onPrimary },
  name: { color: colors.onSurface, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2 },
  stat: { color: colors.onSurfaceVar, fontSize: 11 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
});
