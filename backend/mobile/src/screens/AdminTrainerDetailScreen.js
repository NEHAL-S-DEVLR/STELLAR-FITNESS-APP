import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, SectionTitle, Button, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

export default function AdminTrainerDetailScreen({ route, navigation }) {
  const { trainer } = route.params;
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);

  const [name, setName] = useState(trainer.name || '');
  const [phone, setPhone] = useState(trainer.phone || '');
  const [specialization, setSpecialization] = useState(trainer.specialization || '');
  const [photoUrl, setPhotoUrl] = useState(trainer.photo_url || '');
  const [isPartner, setIsPartner] = useState(!!trainer.is_partner);
  const [permissions, setPermissions] = useState(trainer.permissions || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/admin/permissions')
      .then(p => setCatalog(p.catalog))
      .catch(e => setError(e.message));
  }, []);

  function toggle(key) {
    setPermissions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function save() {
    setSaving(true);
    try {
      await api(`/api/admin/trainers/${trainer.id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(), phone: phone.trim() || null, specialization: specialization.trim() || null,
          photo_url: photoUrl.trim() || null, is_partner: isPartner, permissions,
        },
      });
      Alert.alert('Saved', 'Trainer updated.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    Alert.alert('Remove trainer?', 'Their clients will keep their assigned-trainer history, but no longer have an active trainer link. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api(`/api/admin/trainers/${trainer.id}`, { method: 'DELETE' });
          navigation.goBack();
        } catch (e) { Alert.alert('Could not remove', e.message); }
      }},
    ]);
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!catalog) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const groups = [...new Set(catalog.map(c => c.group))];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>{trainer.name}</Text>
      <Text style={styles.email}>{trainer.email}</Text>

      <SectionTitle>Details</SectionTitle>
      <Card>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.outline} />

        <Text style={styles.label}>Phone (WhatsApp)</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholderTextColor={colors.outline} keyboardType="phone-pad" />

        <Text style={styles.label}>Specialization</Text>
        <TextInput style={styles.input} value={specialization} onChangeText={setSpecialization} placeholderTextColor={colors.outline} />

        <Text style={styles.label}>Photo URL</Text>
        <TextInput style={styles.input} value={photoUrl} onChangeText={setPhotoUrl} placeholder="https://…" placeholderTextColor={colors.outline} autoCapitalize="none" />

        <Text style={styles.label}>Commission Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TouchableOpacity onPress={() => setIsPartner(false)}><Chip label="Commission %" tone={!isPartner ? 'primary' : 'default'} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setIsPartner(true)}><Chip label="Partner (100%)" tone={isPartner ? 'primary' : 'default'} /></TouchableOpacity>
        </View>
      </Card>

      <SectionTitle>Permissions</SectionTitle>
      <Card>
        {groups.map(g => (
          <View key={g} style={{ marginBottom: 10 }}>
            <Text style={styles.groupLabel}>{g.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {catalog.filter(c => c.group === g).map(c => (
                <TouchableOpacity key={c.key} onPress={() => toggle(c.key)}>
                  <Chip label={c.label} tone={permissions.includes(c.key) ? 'primary' : 'default'} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </Card>

      <Button
        label={saving ? '' : 'Save Changes'}
        onPress={save}
        disabled={saving}
        icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="save" size={16} color={colors.onPrimary} />}
        style={{ marginTop: 20 }}
      />

      <Button
        label="Remove Trainer"
        variant="danger"
        onPress={remove}
        icon={<Ionicons name="trash" size={16} color={colors.error} />}
        style={{ marginTop: 12 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: '800' },
  email: { color: colors.onSurfaceVar, fontSize: 13, marginTop: 2, marginBottom: 6 },
  label: { color: colors.onSurfaceVar, fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  groupLabel: { color: colors.onSurfaceVar, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
});
