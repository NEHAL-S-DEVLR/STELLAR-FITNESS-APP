import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Button, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

export default function AdminAddStaffScreen({ navigation }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/admin/permissions')
      .then(p => { setCatalog(p.catalog); setPermissions(p.staffDefaults); })
      .catch(e => setError(e.message));
  }, []);

  function toggle(key) {
    setPermissions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function save() {
    if (!name.trim() || !email.trim()) return Alert.alert('Missing info', 'Name and email are required.');
    setSaving(true);
    try {
      await api('/api/admin/staff', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), phone: phone.trim() || null, password: password.trim() || undefined, permissions },
      });
      Alert.alert('Staff added', password.trim() ? undefined : 'Default password: staff1234');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not add staff', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!catalog) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const groups = [...new Set(catalog.map(c => c.group))];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Staff member's full name" placeholderTextColor={colors.outline} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={colors.outline} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Optional" placeholderTextColor={colors.outline} keyboardType="phone-pad" />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Leave blank for default (staff1234)" placeholderTextColor={colors.outline} secureTextEntry />
      </Card>

      <Text style={[styles.label, { marginTop: 20 }]}>Permissions</Text>
      {groups.map(g => (
        <View key={g} style={{ marginTop: 10 }}>
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

      <Button
        label={saving ? '' : 'Add Staff'}
        onPress={save}
        disabled={saving}
        icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
        style={{ marginTop: 20 }}
      />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  label: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  groupLabel: { color: colors.onSurfaceVar, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
});
