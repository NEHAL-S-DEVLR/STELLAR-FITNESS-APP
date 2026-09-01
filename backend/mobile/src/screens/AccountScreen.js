import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { Button } from '../components/Common';
import { api, Session, initials } from '../api';

export default function AccountScreen({ user, onSaved, onLogout, baseUrl, navigation }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [goal, setGoal] = useState(user.goal || '');
  const [height, setHeight] = useState(user.height ? String(user.height) : '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api('/api/me', {
        method: 'PATCH',
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          goal: goal.trim(),
          height: height.trim(),
        },
      });
      Alert.alert('Saved', 'Profile updated.');
      await onSaved();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally { setSaving(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle}>Update your profile — every change is logged in the audit trail.</Text>

      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.meta}>Member since {user.joined}</Text>
        </View>
      </View>

      <Field label="Name"             value={name}   onChange={setName} />
      <Field label="Email"            value={email}  onChange={setEmail}  keyboardType="email-address" autoCap="none" />
      <Field label="Phone (WhatsApp)" value={phone}  onChange={setPhone}  placeholder="+91 …" />
      <Field label="Goal"             value={goal}   onChange={setGoal} />
      <Field label="Height (cm)"      value={height} onChange={t => setHeight(t.replace(/[^\d]/g, ''))} keyboardType="numeric" />

      <Button
        label={saving ? 'Saving…' : 'Save changes'}
        onPress={save}
        disabled={saving}
        icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="save" size={18} color={colors.onPrimary} />}
        style={{ marginTop: 16 }}
      />

      <Text style={styles.section}>MORE</Text>
      <Button
        label="Progress: Weight & Photos"
        variant="tonal"
        onPress={() => navigation.navigate('MemberProgress')}
        icon={<Ionicons name="trending-up" size={18} color={colors.onPrimaryContainer} />}
        style={{ marginBottom: 10 }}
      />
      <Button
        label="Payment History"
        variant="tonal"
        onPress={() => navigation.navigate('MemberPayments')}
        icon={<Ionicons name="receipt" size={18} color={colors.onPrimaryContainer} />}
        style={{ marginBottom: 10 }}
      />
      <Button
        label="Reel Shoot Request"
        variant="tonal"
        onPress={() => navigation.navigate('ReelRequests')}
        icon={<Ionicons name="videocam" size={18} color={colors.onPrimaryContainer} />}
      />

      <Button
        label="Sign out"
        variant="outlined"
        onPress={async () => {
          await Session.setToken(null);
          onLogout();
        }}
        icon={<Ionicons name="log-out" size={18} color={colors.primary} />}
        style={{ marginTop: 30 }}
      />
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, autoCap = 'sentences' }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        keyboardType={keyboardType}
        autoCapitalize={autoCap}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title:    { color: colors.onSurface, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 4, marginBottom: 18 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimaryContainer, fontWeight: '800', fontSize: 20 },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.onSurfaceVar, fontSize: 12 },
  fieldLabel: { color: colors.onSurfaceVar, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  section: {
    color: colors.onSurfaceVar, fontSize: 11, fontWeight: '700', letterSpacing: 1,
    marginTop: 26, marginBottom: 10,
  },
});
