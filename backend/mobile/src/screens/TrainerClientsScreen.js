import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const STATUS_TONE = { active: 'success', completed: 'default', cancelled: 'error' };

export default function TrainerClientsScreen() {
  const [clients, setClients] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await api('/api/trainer/clients');
      setClients(rows);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (clients === null && !error) {
    return <View style={styles.center}><Text style={styles.hint}>Loading clients…</Text></View>;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={clients || []}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={<Text style={styles.title}>My Clients</Text>}
      ListEmptyComponent={
        error
          ? <Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} />
          : <Empty icon={<Ionicons name="people-outline" size={30} color={colors.outline} />} text="No clients assigned yet." />
      }
      renderItem={({ item }) => (
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>{item.package_name || 'No package'}</Text>
            </View>
            <Chip label={item.assignment_status || '—'} tone={STATUS_TONE[item.assignment_status] || 'default'} />
          </View>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
            <Text style={styles.stat}>{item.attendance_30d ?? 0} check-ins (30d)</Text>
            {item.last_weight_kg ? <Text style={styles.stat}>{Number(item.last_weight_kg).toFixed(1)} kg</Text> : null}
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  hint: { color: colors.onSurfaceVar, fontSize: 13 },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800', marginBottom: 16 },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2 },
  stat: { color: colors.onSurfaceVar, fontSize: 11 },
});
