import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const emptyForm = { name: '', price: '', originalPrice: '', duration_days: '30', description: '', featuresText: '', highlighted: false };

export default function AdminPlansScreen() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setPlans(await api('/api/admin/plans'));
      setError(null);
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(p) {
    setEditingId(p.id);
    setShowNew(false);
    setForm({
      name: p.name, price: String(p.price), originalPrice: p.originalPrice ? String(p.originalPrice) : '',
      duration_days: String(p.duration_days), description: p.description || '',
      featuresText: (p.features || []).join('\n'), highlighted: !!p.highlighted,
    });
  }

  function startNew() {
    setEditingId(null);
    setShowNew(true);
    setForm(emptyForm);
  }

  function cancelEdit() {
    setEditingId(null);
    setShowNew(false);
    setForm(emptyForm);
  }

  function buildBody() {
    return {
      name: form.name.trim(),
      price: parseFloat(form.price) || 0,
      original_price: form.originalPrice ? parseFloat(form.originalPrice) : null,
      duration_days: parseInt(form.duration_days, 10) || 30,
      description: form.description.trim() || null,
      features: form.featuresText.split('\n').map(f => f.trim()).filter(Boolean),
      highlighted: form.highlighted,
    };
  }

  async function save() {
    if (!form.name.trim() || !form.price) return Alert.alert('Missing info', 'Name and price are required.');
    setSaving(true);
    try {
      if (editingId) {
        await api(`/api/admin/plans/${editingId}`, { method: 'PATCH', body: buildBody() });
      } else {
        await api('/api/admin/plans', { method: 'POST', body: buildBody() });
      }
      cancelEdit();
      await load();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p) {
    try { await api(`/api/admin/plans/${p.id}`, { method: 'PATCH', body: { is_active: !p.is_active } }); load(); }
    catch (e) { Alert.alert('Failed', e.message); }
  }

  async function remove(p) {
    Alert.alert('Deactivate plan?', 'It will stop showing on the website but past payments referencing it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/plans/${p.id}`, { method: 'DELETE' }); load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!plans) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const isEditing = editingId != null || showNew;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Membership Plans</Text>
      <Text style={styles.hint}>These show on the public website's Membership page.</Text>

      {!isEditing && (
        <Button label="Add Plan" onPress={startNew} icon={<Ionicons name="add" size={16} color={colors.onPrimary} />} style={{ marginTop: 14, marginBottom: 16 }} />
      )}

      {isEditing && (
        <Card style={{ marginBottom: 18 }}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Monthly" placeholderTextColor={colors.outline} />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Price (₹)</Text>
              <TextInput style={styles.input} value={form.price} onChangeText={(v) => setForm(f => ({ ...f, price: v }))} keyboardType="numeric" placeholderTextColor={colors.outline} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Original Price (₹)</Text>
              <TextInput style={styles.input} value={form.originalPrice} onChangeText={(v) => setForm(f => ({ ...f, originalPrice: v }))} keyboardType="numeric" placeholder="Optional strikethrough" placeholderTextColor={colors.outline} />
            </View>
          </View>

          <Text style={styles.label}>Duration (days)</Text>
          <TextInput style={styles.input} value={form.duration_days} onChangeText={(v) => setForm(f => ({ ...f, duration_days: v }))} keyboardType="numeric" placeholderTextColor={colors.outline} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.input} value={form.description} onChangeText={(v) => setForm(f => ({ ...f, description: v }))} placeholder="One line under the plan name" placeholderTextColor={colors.outline} />

          <Text style={styles.label}>Features — one per line</Text>
          <TextInput
            style={[styles.input, styles.textArea]} value={form.featuresText} onChangeText={(v) => setForm(f => ({ ...f, featuresText: v }))}
            multiline placeholder={'Full gym floor & free weights\nLocker room access\nGroup classes included'} placeholderTextColor={colors.outline}
          />

          <TouchableOpacity onPress={() => setForm(f => ({ ...f, highlighted: !f.highlighted }))} style={{ marginTop: 12 }}>
            <Chip label="Most Popular badge" tone={form.highlighted ? 'primary' : 'default'} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Button label={saving ? '' : 'Save'} onPress={save} disabled={saving}
                icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={16} color={colors.onPrimary} />} />
            </View>
            <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn}>
              <Text style={{ color: colors.onSurfaceVar, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {plans.map(p => (
        <Card key={p.id} style={{ marginBottom: 10, opacity: p.is_active ? 1 : 0.5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name} {p.highlighted && '★'}</Text>
              <Text style={styles.sub}>{p.description || 'No description'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {p.originalPrice > p.price && <Text style={styles.strike}>{money(p.originalPrice)}</Text>}
              <Text style={styles.price}>{money(p.price)}</Text>
            </View>
          </View>
          <Text style={styles.sub}>{p.duration_days} days · {(p.features || []).length} features</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            <TouchableOpacity onPress={() => startEdit(p)}><Text style={styles.link}>Edit</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => toggleActive(p)}><Text style={styles.link}>{p.is_active ? 'Deactivate' : 'Activate'}</Text></TouchableOpacity>
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
  hint: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 4 },
  label: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  cancelBtn: { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.onSurface, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2 },
  price: { color: colors.onSurface, fontSize: 16, fontWeight: '800', fontFamily: 'Menlo' },
  strike: { color: colors.outline, fontSize: 12, textDecorationLine: 'line-through' },
  link: { color: colors.primary, fontSize: 12, fontWeight: '600' },
});
