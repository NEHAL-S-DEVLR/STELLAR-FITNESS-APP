import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

export default function AdminStaffScreen({ navigation }) {
  const [staff, setStaff] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, p] = await Promise.all([api('/api/admin/staff'), api('/api/admin/permissions')]);
      setStaff(s); setCatalog(p.catalog);
      setError(null);
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function togglePermission(member, key) {
    const has = (member.permissions || []).includes(key);
    const next = has ? member.permissions.filter(k => k !== key) : [...(member.permissions || []), key];
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, permissions: next } : s));
  }

  async function savePermissions(member) {
    setSavingId(member.id);
    try {
      await api(`/api/admin/staff/${member.id}`, { method: 'PATCH', body: { permissions: member.permissions } });
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSavingId(null);
    }
  }

  async function remove(member) {
    Alert.alert('Remove staff account?', `${member.name} will no longer be able to sign in.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/staff/${member.id}`, { method: 'DELETE' }); load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!staff || !catalog) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const groups = [...new Set(catalog.map(c => c.group))];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Staff</Text>
      <Button
        label="Add Staff"
        onPress={() => navigation.navigate('AdminAddStaff')}
        icon={<Ionicons name="person-add" size={16} color={colors.onPrimary} />}
        style={{ marginTop: 14, marginBottom: 16 }}
      />

      {staff.length === 0 ? (
        <Empty icon={<Ionicons name="people-outline" size={30} color={colors.outline} />} text="No staff accounts yet." />
      ) : staff.map((s) => {
        const isOpen = expandedId === s.id;
        return (
          <Card key={s.id} style={{ marginBottom: 10 }}>
            <TouchableOpacity onPress={() => setExpandedId(isOpen ? null : s.id)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={styles.sub}>{s.email}</Text>
                  <Text style={styles.sub}>{(s.permissions || []).length} permission{(s.permissions || []).length === 1 ? '' : 's'} granted</Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.outline} />
              </View>
            </TouchableOpacity>

            {isOpen && (
              <View style={{ marginTop: 14 }}>
                {groups.map(g => (
                  <View key={g} style={{ marginBottom: 10 }}>
                    <Text style={styles.groupLabel}>{g.toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {catalog.filter(c => c.group === g).map(c => {
                        const on = (s.permissions || []).includes(c.key);
                        return (
                          <TouchableOpacity key={c.key} onPress={() => togglePermission(s, c.key)}>
                            <Chip label={c.label} tone={on ? 'primary' : 'default'} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <Button
                    label={savingId === s.id ? '' : 'Save Permissions'}
                    onPress={() => savePermissions(s)}
                    disabled={savingId === s.id}
                    icon={savingId === s.id ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
                    style={{ flex: 1 }}
                  />
                  <TouchableOpacity onPress={() => remove(s)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Card>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  name: { color: colors.onSurface, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2 },
  groupLabel: { color: colors.onSurfaceVar, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  removeBtn: {
    width: 46, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: 'rgba(248,113,113,0.12)',
  },
});
