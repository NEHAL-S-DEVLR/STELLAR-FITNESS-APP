import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api, daysUntil } from '../api';

export default function AdminMembersScreen({ navigation, isAdmin }) {
  const [members, setMembers] = useState(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await api('/api/admin/members');
      setMembers(rows);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const filtered = (members || []).filter(m =>
    !query.trim() || m.name.toLowerCase().includes(query.toLowerCase()) || (m.email || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={filtered}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={styles.title}>Members</Text>
            <Button
              label="Add"
              onPress={() => navigation.navigate('AdminAddMember')}
              icon={<Ionicons name="person-add" size={16} color={colors.onPrimary} />}
            />
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search by name or email…"
            placeholderTextColor={colors.outline}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      }
      ListEmptyComponent={
        error
          ? <Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} />
          : <Empty icon={<Ionicons name="people-outline" size={30} color={colors.outline} />} text="No members yet — tap Add to create one." />
      }
      renderItem={({ item }) => {
        const days = item.subscription ? daysUntil(item.subscription.expiryDate) : null;
        const expired = days != null && days < 0;
        return (
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('AdminMemberDetail', { memberId: item.id, isAdmin })}>
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.sub}>{item.email}</Text>
                </View>
                <Chip label={item.memberType === 'pt' ? 'PT' : 'Regular'} tone={item.memberType === 'pt' ? 'primary' : 'default'} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                {item.subscription
                  ? <Chip label={expired ? `Expired ${Math.abs(days)}d ago` : `${days}d left · ${item.subscription.plan}`} tone={expired ? 'error' : 'success'} />
                  : <Chip label="No subscription" tone="default" />}
              </View>
            </Card>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  search: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2 },
});
