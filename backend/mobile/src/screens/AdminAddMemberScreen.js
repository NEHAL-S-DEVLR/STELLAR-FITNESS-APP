import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

export default function AdminAddMemberScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('demo1234');
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(null);
  const [memberType, setMemberType] = useState('regular');
  const [trainers, setTrainers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [trainerId, setTrainerId] = useState(null);
  const [packageId, setPackageId] = useState(null);
  const [ptPrice, setPtPrice] = useState('');
  const [ptError, setPtError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/plans').then((rows) => { setPlans(rows); if (rows.length) setPlanId(rows[0].id); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (memberType !== 'pt' || trainers.length || packages.length) return;
    (async () => {
      try {
        const [t, p] = await Promise.all([api('/api/admin/trainers'), api('/api/admin/pt-packages')]);
        setTrainers(t);
        setPackages(p);
        setPtError(null);
      } catch (e) {
        setPtError("Can't load trainers/packages — ask admin for PT permissions on your account.");
      }
    })();
  }, [memberType]);

  const selectedPlan = plans.find((p) => p.id === planId);

  async function save() {
    if (!name.trim() || !email.trim()) return Alert.alert('Missing info', 'Name and email are required.');
    if (memberType === 'pt' && !trainerId) return Alert.alert('Missing trainer', 'Pick a trainer for a PT member.');
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        password,
        plan: selectedPlan?.name || 'Monthly',
        subDays: selectedPlan?.duration_days || 30,
        member_type: memberType,
      };
      if (memberType === 'pt') {
        body.trainer_id = trainerId;
        body.package_id = packageId;
        body.pt_price = parseFloat(ptPrice) || 0;
      }
      await api('/api/admin/members', { method: 'POST', body });
      Alert.alert('Member created', `${name.trim()} is set up. Send their login on WhatsApp from the website's Members page.`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not create member', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>Add Member</Text>

      <Field label="Full Name"><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Jane Doe" placeholderTextColor={colors.outline} /></Field>
      <Field label="Email"><TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="jane@example.com" placeholderTextColor={colors.outline} /></Field>
      <Field label="Phone (WhatsApp)"><TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" placeholderTextColor={colors.outline} /></Field>
      <Field label="Temporary Password"><TextInput style={styles.input} value={password} onChangeText={setPassword} placeholderTextColor={colors.outline} /></Field>

      <Text style={styles.label}>Plan</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {plans.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => setPlanId(p.id)} activeOpacity={0.7}>
            <Chip label={`${p.name} · ₹${p.price}`} tone={planId === p.id ? 'primary' : 'default'} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Member Type</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Button label="Regular" variant={memberType === 'regular' ? 'filled' : 'outlined'} onPress={() => setMemberType('regular')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="PT" variant={memberType === 'pt' ? 'filled' : 'outlined'} onPress={() => setMemberType('pt')} />
        </View>
      </View>

      {memberType === 'pt' && (
        <View style={{ marginBottom: 8 }}>
          {ptError ? (
            <Text style={styles.error}>{ptError}</Text>
          ) : !trainers.length ? (
            <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />
          ) : (
            <>
              <Text style={styles.label}>Trainer</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {trainers.map((t) => (
                  <TouchableOpacity key={t.id} onPress={() => setTrainerId(t.id)} activeOpacity={0.7}>
                    <Chip label={t.name} tone={trainerId === t.id ? 'primary' : 'default'} />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Package</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {packages.map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => { setPackageId(p.id); setPtPrice(String(p.price)); }} activeOpacity={0.7}>
                    <Chip label={`${p.name} · ₹${p.price}`} tone={packageId === p.id ? 'primary' : 'default'} />
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="PT Price (₹)"><TextInput style={styles.input} value={ptPrice} onChangeText={setPtPrice} keyboardType="numeric" placeholderTextColor={colors.outline} /></Field>
            </>
          )}
        </View>
      )}

      <Button
        label={saving ? '' : 'Create Member'}
        onPress={save}
        disabled={saving}
        icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="person-add" size={18} color={colors.onPrimary} />}
        style={{ marginTop: 12 }}
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
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800', marginBottom: 20 },
  label: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 15,
    paddingVertical: 11, paddingHorizontal: 14,
  },
  error: { color: colors.error, fontSize: 12, marginBottom: 12 },
});
