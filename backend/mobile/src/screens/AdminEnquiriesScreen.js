import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty } from '../components/Common';
import { colors, spacing } from '../theme';
import { api } from '../api';

const STATUSES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'];
const STATUS_TONE = { new: 'info', contacted: 'primary', confirmed: 'success', completed: 'default', cancelled: 'error' };
const SOURCE_LABEL = { 'book-visit': 'Enquiry', contact: 'Contact' };

export default function AdminEnquiriesScreen() {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setLeads(await api('/api/admin/leads'));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(lead, status) {
    try {
      await api(`/api/admin/leads/${lead.id}`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) { Alert.alert('Failed', e.message); }
  }

  async function remove(lead) {
    Alert.alert('Delete enquiry?', null, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/leads/${lead.id}`, { method: 'DELETE' }); load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={leads || []}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={<Text style={styles.title}>Enquiries</Text>}
      ListEmptyComponent={
        error
          ? <Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} />
          : <Empty icon={<Ionicons name="chatbubbles-outline" size={30} color={colors.outline} />} text="No enquiries yet." />
      }
      renderItem={({ item }) => (
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>{item.phone || item.email}{item.whatsapp && item.whatsapp !== item.phone ? ` · WA: ${item.whatsapp}` : ''}</Text>
            </View>
            <Chip label={SOURCE_LABEL[item.source] || item.source} />
          </View>
          {(item.interested_plan_name || item.goal || item.message) && (
            <Text style={styles.detail} numberOfLines={2}>
              {[item.interested_plan_name && `Interested in: ${item.interested_plan_name}`, item.goal, item.message].filter(Boolean).join(' · ')}
            </Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {STATUSES.map((s) => (
              <TouchableOpacity key={s} onPress={() => setStatus(item, s)} activeOpacity={0.7}>
                <Chip label={s} tone={item.status === s ? STATUS_TONE[s] : 'default'} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => remove(item)} activeOpacity={0.7} style={{ marginLeft: 'auto' }}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800', marginBottom: 16 },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2 },
  detail: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 8 },
});
