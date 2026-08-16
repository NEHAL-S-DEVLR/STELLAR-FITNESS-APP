import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, SectionTitle, Button } from '../components/Common';
import Heatmap from '../components/Heatmap';
import { colors, radius, spacing } from '../theme';
import { api, daysUntil } from '../api';

export default function AdminMemberDetailScreen({ route, navigation }) {
  const { memberId, isAdmin } = route.params;
  const [member, setMember] = useState(null);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [goal, setGoal] = useState('');
  const [height, setHeight] = useState('');
  const [trainers, setTrainers] = useState([]);
  const [trainerId, setTrainerId] = useState(null);
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ptAssignment, setPtAssignment] = useState(null);

  const load = React.useCallback(() => {
    api(`/api/admin/members/${memberId}`)
      .then((m) => {
        setMember(m);
        setName(m.name || '');
        setPhone(m.phone || '');
        setGoal(m.goal || '');
        setHeight(m.height ? String(m.height) : '');
        setTrainerId(m.assignedTrainerId || null);
        setBatchId(m.batchId || null);
      })
      .catch((e) => setError(e.message));
    api('/api/admin/trainers').then(setTrainers).catch(() => {});
    api('/api/admin/batches').then(setBatches).catch(() => {});
    // A "Workout & Nutrition Plan" shortcut only makes sense for PT clients
    // (normal members get the shared gym-wide plan instead), and the routes
    // it opens are trainer/admin-only — staff can't use them even with
    // members.manage, so skip the fetch and hide the button for staff.
    if (isAdmin) {
      api(`/api/admin/pt-assignments?member_id=${memberId}&status=active`)
        .then((rows) => setPtAssignment(rows[0] || null))
        .catch(() => setPtAssignment(null));
    }
  }, [memberId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        body: {
          name: name.trim(), phone: phone.trim(), goal: goal.trim(),
          height: parseFloat(height) || null,
          assigned_trainer_id: trainerId, batch_id: batchId,
        },
      });
      Alert.alert('Saved', 'Member updated.');
      load();
    } catch (e) { Alert.alert('Could not save', e.message); } finally { setSaving(false); }
  }

  async function remove() {
    Alert.alert('Remove member?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await api(`/api/admin/members/${memberId}`, { method: 'DELETE' });
            navigation.goBack();
          } catch (e) { Alert.alert('Could not remove', e.message); }
        },
      },
    ]);
  }

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!member) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const days = member.subscription ? daysUntil(member.subscription.expiryDate) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>{member.name}</Text>
      <Text style={styles.email}>{member.email}</Text>

      {member.subscription && (
        <Card tinted style={{ marginTop: 16 }}>
          <Text style={styles.lbl}>SUBSCRIPTION</Text>
          <Text style={styles.planName}>{member.subscription.plan}</Text>
          <Text style={styles.days}>{days != null ? (days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`) : '—'}</Text>
        </Card>
      )}

      <Button
        label="View Gym Pass"
        variant="outlined"
        onPress={() => navigation.navigate('GymPass', { memberId })}
        icon={<Ionicons name="card" size={16} color={colors.primary} />}
        style={{ marginTop: 16 }}
      />

      {ptAssignment && (
        <Button
          label="Workout & Nutrition Plan"
          variant="tonal"
          onPress={() => navigation.navigate('TrainerClientDetail', {
            clientId: memberId, clientName: member.name,
            status: ptAssignment.status, packageName: ptAssignment.package_name,
            trainerId: ptAssignment.trainer_id,
          })}
          icon={<Ionicons name="barbell" size={16} color={colors.onPrimaryContainer} />}
          style={{ marginTop: 10 }}
        />
      )}

      <SectionTitle>Details</SectionTitle>
      <Card>
        <Field label="Name"><TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.outline} /></Field>
        <Field label="Phone (WhatsApp)"><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholderTextColor={colors.outline} /></Field>
        <Field label="Goal"><TextInput style={styles.input} value={goal} onChangeText={setGoal} placeholderTextColor={colors.outline} /></Field>
        <Field label="Height (cm)"><TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholderTextColor={colors.outline} /></Field>

        <Text style={styles.label}>Assigned Trainer</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => setTrainerId(null)} activeOpacity={0.7}>
            <Chip label="None" tone={!trainerId ? 'primary' : 'default'} />
          </TouchableOpacity>
          {trainers.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => setTrainerId(t.id)} activeOpacity={0.7}>
              <Chip label={t.name} tone={trainerId === t.id ? 'primary' : 'default'} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Batch</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => setBatchId(null)} activeOpacity={0.7}>
            <Chip label="No batch" tone={!batchId ? 'primary' : 'default'} />
          </TouchableOpacity>
          {batches.map((b) => (
            <TouchableOpacity key={b.id} onPress={() => setBatchId(b.id)} activeOpacity={0.7}>
              <Chip label={b.name} tone={batchId === b.id ? 'primary' : 'default'} />
            </TouchableOpacity>
          ))}
        </View>

        <Button
          label={saving ? '' : 'Save Changes'}
          onPress={save}
          disabled={saving}
          icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="save" size={16} color={colors.onPrimary} />}
        />
      </Card>

      <SectionTitle>Attendance</SectionTitle>
      <Card>
        <Heatmap dateStrings={member.attendance || []} weeks={20} />
      </Card>

      <Button
        label="Remove Member"
        variant="danger"
        onPress={remove}
        icon={<Ionicons name="trash" size={16} color={colors.error} />}
        style={{ marginTop: 20 }}
      />
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  error: { color: colors.error, fontSize: 14, textAlign: 'center' },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: '800' },
  email: { color: colors.onSurfaceVar, fontSize: 13, marginTop: 2 },
  lbl: { fontSize: 10, fontWeight: '700', color: colors.onSurfaceVar, letterSpacing: 0.6 },
  planName: { fontSize: 17, fontWeight: '700', color: colors.onSurface, marginTop: 4 },
  days: { fontSize: 13, color: colors.onSurfaceVar, marginTop: 2 },
  label: { color: colors.onSurfaceVar, fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
});
