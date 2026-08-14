import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Button, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

export default function AdminNewAssignmentScreen({ navigation }) {
  const [members, setMembers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [memberQuery, setMemberQuery] = useState('');
  const [member, setMember] = useState(null);
  const [trainerId, setTrainerId] = useState(null);
  const [packageId, setPackageId] = useState(null);
  const [price, setPrice] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, t, p] = await Promise.all([
          api('/api/admin/members'), api('/api/admin/trainers'), api('/api/admin/pt-packages'),
        ]);
        setMembers(m); setTrainers(t); setPackages(p.filter(x => x.is_active !== false));
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, []);

  const filtered = memberQuery.trim()
    ? members.filter(m => (m.name || '').toLowerCase().includes(memberQuery.toLowerCase()) || (m.email || '').toLowerCase().includes(memberQuery.toLowerCase()))
    : [];

  async function save() {
    if (!member) return Alert.alert('Pick a member', 'Search and select a member first.');
    setSaving(true);
    try {
      await api('/api/admin/pt-assignments', {
        method: 'POST',
        body: {
          user_id: member.id, trainer_id: trainerId, package_id: packageId,
          price_paid: price.trim() || undefined, remarks: remarks.trim() || null,
        },
      });
      Alert.alert('PT assignment created');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not create assignment', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={styles.label}>Member</Text>
        {member ? (
          <View style={styles.selectedMember}>
            <View>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberSub}>{member.email}</Text>
            </View>
            <TouchableOpacity onPress={() => { setMember(null); setMemberQuery(''); }}>
              <Ionicons name="close-circle" size={20} color={colors.outline} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={memberQuery}
              onChangeText={setMemberQuery}
              placeholder="Search member by name or email"
              placeholderTextColor={colors.outline}
            />
            {filtered.slice(0, 6).map(m => (
              <TouchableOpacity key={m.id} onPress={() => setMember(m)} style={styles.resultRow}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberSub}>{m.email}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.label}>Trainer</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {trainers.map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTrainerId(t.id)}>
              <Chip label={t.name} tone={trainerId === t.id ? 'primary' : 'default'} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Package</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {packages.map(p => (
            <TouchableOpacity key={p.id} onPress={() => { setPackageId(p.id); setPrice(String(p.price)); }}>
              <Chip label={`${p.name} · ₹${p.price}`} tone={packageId === p.id ? 'primary' : 'default'} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Price Paid (₹)</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Defaults to package price" placeholderTextColor={colors.outline} />

        <Text style={styles.label}>Remarks</Text>
        <TextInput style={styles.input} value={remarks} onChangeText={setRemarks} placeholder="Optional" placeholderTextColor={colors.outline} />
      </Card>

      <Button
        label={saving ? '' : 'Create Assignment'}
        onPress={save}
        disabled={saving}
        icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
        style={{ marginTop: 18 }}
      />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
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
  memberSub: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 2 },
});
