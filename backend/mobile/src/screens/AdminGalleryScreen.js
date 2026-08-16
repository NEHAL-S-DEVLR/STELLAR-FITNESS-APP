import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api, Session } from '../api';

const CATEGORIES = ['Gym', 'Equipment', 'Classes', 'Events', 'Transformations'];

export default function AdminGalleryScreen() {
  const [items, setItems] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await api('/api/admin/gallery'));
      setError(null);
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); Session.getBaseUrl().then(setBaseUrl); }, [load]);

  async function addItem() {
    if (!title.trim() || !imageUrl.trim()) return Alert.alert('Missing info', 'Title and image URL are required.');
    setSaving(true);
    try {
      await api('/api/admin/gallery', { method: 'POST', body: { category, title: title.trim(), image_url: imageUrl.trim() } });
      setTitle(''); setImageUrl('');
      await load();
    } catch (e) {
      Alert.alert('Could not add photo', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    Alert.alert('Delete photo?', null, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/gallery/${item.id}`, { method: 'DELETE' }); load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!items) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Gallery</Text>
      <Text style={styles.hint}>Photos shown on the public website's Gallery page — includes Equipment.</Text>

      <Card style={{ marginTop: 14, marginBottom: 18 }}>
        <Text style={styles.label}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} onPress={() => setCategory(c)}>
              <Chip label={c} tone={category === c ? 'primary' : 'default'} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Squat rack row" placeholderTextColor={colors.outline} />

        <Text style={styles.label}>Image URL</Text>
        <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" placeholderTextColor={colors.outline} autoCapitalize="none" />
        <Text style={styles.hint}>Paste a link to a hosted photo — direct upload from the app isn't available on this deployment.</Text>

        <Button
          label={saving ? '' : 'Add Photo'}
          onPress={addItem}
          disabled={saving}
          icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={16} color={colors.onPrimary} />}
          style={{ marginTop: 12 }}
        />
      </Card>

      {items.length === 0 ? (
        <Empty icon={<Ionicons name="images-outline" size={30} color={colors.outline} />} text="No photos yet." />
      ) : items.map(item => (
        <View key={item.id} style={styles.row}>
          <Image
            source={{ uri: item.image_url.startsWith('http') ? item.image_url : `${baseUrl}${item.image_url}` }}
            style={{ width: 64, height: 64, borderRadius: 10 }}
            contentFit="cover"
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Chip label={item.category} tone="default" style={{ marginTop: 4, alignSelf: 'flex-start' }} />
          </View>
          <TouchableOpacity onPress={() => remove(item)}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
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
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: colors.surfaceVar, borderRadius: radius.md, marginBottom: 8,
  },
  rowTitle: { color: colors.onSurface, fontWeight: '700', fontSize: 13 },
});
