import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

export default function AdminBatchesScreen() {
  const [batches, setBatches] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setBatches(await api('/api/admin/batches'));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addBatch() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await api('/api/admin/batches', { method: 'POST', body: { name: name.trim(), capacity: capacity || null } });
      setName(''); setCapacity('');
      await load();
    } catch (e) { Alert.alert('Could not add batch', e.message); } finally { setAdding(false); }
  }

  async function toggleActive(b) {
    try {
      await api(`/api/admin/batches/${b.id}`, { method: 'PATCH', body: { is_active: !b.is_active } });
      await load();
    } catch (e) { Alert.alert('Failed', e.message); }
  }

  async function remove(b) {
    Alert.alert('Delete batch?', 'Members in it become unassigned.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/batches/${b.id}`, { method: 'DELETE' }); await load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={batches || []}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>Batches</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. Morning Batch"
              placeholderTextColor={colors.outline}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, { width: 70 }]}
              placeholder="Limit"
              placeholderTextColor={colors.outline}
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="numeric"
            />
            <Button
              label=""
              onPress={addBatch}
              disabled={adding}
              icon={adding ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={20} color={colors.onPrimary} />}
              style={{ paddingHorizontal: 14 }}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        error
          ? <Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} />
          : <Empty icon={<Ionicons name="people-outline" size={30} color={colors.outline} />} text="No batches yet." />
      }
      renderItem={({ item }) => {
        const full = item.capacity != null && item.member_count >= item.capacity;
        return (
          <Card style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {full && <Chip label="FULL" tone="error" />}
                  {!item.is_active && <Chip label="Inactive" tone="default" />}
                </View>
                <Text style={styles.sub}>{item.member_count}{item.capacity != null ? `/${item.capacity}` : ''} members</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Button label={item.is_active ? 'Deactivate' : 'Activate'} variant="tonal" onPress={() => toggleActive(item)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Delete" variant="danger" onPress={() => remove(item)} />
              </View>
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2 },
});
