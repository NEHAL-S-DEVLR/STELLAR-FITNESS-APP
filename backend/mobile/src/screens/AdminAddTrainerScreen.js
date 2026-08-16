import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

export default function AdminAddTrainerScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [isPartner, setIsPartner] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !email.trim()) return Alert.alert('Missing info', 'Name and email are required.');
    setSaving(true);
    try {
      const effectivePassword = password.trim() || 'trainer123';
      const { id } = await api('/api/admin/trainers', {
        method: 'POST',
        body: {
          name: name.trim(), email: email.trim(), phone: phone.trim() || null,
          password: password.trim() || undefined, specialization: specialization.trim() || null,
          is_partner: isPartner,
        },
      });

      if (phone.trim()) {
        Alert.alert(
          'Trainer added',
          `Password: ${effectivePassword}\n\nSend their login details on WhatsApp now?`,
          [
            { text: 'Skip', style: 'cancel', onPress: () => navigation.goBack() },
            { text: 'Send on WhatsApp', onPress: () => sendCredentials(id, effectivePassword) },
          ]
        );
      } else {
        Alert.alert('Trainer added', `Password: ${effectivePassword}\n\nNo phone on file, so credentials can't be sent on WhatsApp.`);
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert('Could not add trainer', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendCredentials(id, effectivePassword) {
    try {
      const res = await api(`/api/admin/trainers/${id}/send-credentials`, { method: 'POST', body: { password: effectivePassword } });
      if (res.mode === 'link' && res.link) Linking.openURL(res.link);
      else Alert.alert('Sent', 'Login credentials sent on WhatsApp.');
    } catch (e) {
      Alert.alert('Could not send', e.message);
    } finally {
      navigation.goBack();
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Trainer's full name" placeholderTextColor={colors.outline} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={colors.outline} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Optional" placeholderTextColor={colors.outline} keyboardType="phone-pad" />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Leave blank for default (trainer123)" placeholderTextColor={colors.outline} secureTextEntry />

        <Text style={styles.label}>Specialization</Text>
        <TextInput style={styles.input} value={specialization} onChangeText={setSpecialization} placeholder="e.g. Strength & Conditioning" placeholderTextColor={colors.outline} />

        <Text style={styles.label}>Commission Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <TouchableOpacity onPress={() => setIsPartner(false)}><Chip label="Commission %" tone={!isPartner ? 'primary' : 'default'} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setIsPartner(true)}><Chip label="Partner (100%)" tone={isPartner ? 'primary' : 'default'} /></TouchableOpacity>
        </View>
      </Card>

      <Button
        label={saving ? '' : 'Add Trainer'}
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
  label: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
});
