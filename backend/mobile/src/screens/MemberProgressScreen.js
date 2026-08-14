import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, SectionTitle, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api, Session } from '../api';

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function MemberProgressScreen() {
  const [user, setUser] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [weightDate, setWeightDate] = useState(todayISO());
  const [weightKg, setWeightKg] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const [photoUrl, setPhotoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setUser(await api('/api/me')); setError(null); }
    catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); Session.getBaseUrl().then(setBaseUrl); }, [load]);

  const weightLog = [...(user?.weightLog || [])].reverse();
  const photos = user?.photos || [];

  async function addWeight() {
    const kg = parseFloat(weightKg);
    if (!weightDate || !kg) return Alert.alert('Missing info', 'Enter a date and weight.');
    setSavingWeight(true);
    try {
      await api('/api/me/weight', { method: 'POST', body: { date: weightDate, kg } });
      setWeightKg('');
      await load();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSavingWeight(false);
    }
  }

  async function deleteWeight(date) {
    try { await api(`/api/me/weight/${date}`, { method: 'DELETE' }); await load(); }
    catch (e) { Alert.alert('Failed', e.message); }
  }

  async function addPhoto() {
    if (!photoUrl.trim()) return Alert.alert('Missing URL', 'Paste an image URL.');
    setSavingPhoto(true);
    try {
      await api('/api/me/photos', { method: 'POST', body: { url: photoUrl.trim(), caption: caption.trim() } });
      setPhotoUrl(''); setCaption('');
      await load();
    } catch (e) {
      Alert.alert('Could not add photo', e.message);
    } finally {
      setSavingPhoto(false);
    }
  }

  async function deletePhoto(id) {
    try { await api(`/api/me/photos/${id}`, { method: 'DELETE' }); await load(); }
    catch (e) { Alert.alert('Failed', e.message); }
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!user) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <SectionTitle>Weight Log</SectionTitle>
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} value={weightDate} onChangeText={setWeightDate} placeholder={todayISO()} placeholderTextColor={colors.outline} />
          <TextInput style={[styles.input, { width: 90 }]} value={weightKg} onChangeText={setWeightKg} placeholder="kg" placeholderTextColor={colors.outline} keyboardType="numeric" />
        </View>
        <Button
          label={savingWeight ? '' : 'Log Weight'}
          onPress={addWeight}
          disabled={savingWeight}
          icon={savingWeight ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={16} color={colors.onPrimary} />}
          style={{ marginTop: 10 }}
        />
      </Card>

      {weightLog.length === 0 ? (
        <Empty icon={<Ionicons name="trending-up-outline" size={26} color={colors.outline} />} text="No weight entries yet." />
      ) : weightLog.map(w => (
        <View key={w.date} style={styles.logRow}>
          <Text style={styles.logDate}>{w.date}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={styles.logKg}>{w.kg} kg</Text>
            <TouchableOpacity onPress={() => deleteWeight(w.date)}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <SectionTitle>Progress Photos</SectionTitle>
      <Card style={{ marginBottom: 14 }}>
        <Text style={styles.hint}>Paste a link to a photo (e.g. from your phone's cloud backup or a photo host).</Text>
        <TextInput style={styles.input} value={photoUrl} onChangeText={setPhotoUrl} placeholder="https://…" placeholderTextColor={colors.outline} autoCapitalize="none" />
        <TextInput style={[styles.input, { marginTop: 8 }]} value={caption} onChangeText={setCaption} placeholder="Caption (optional)" placeholderTextColor={colors.outline} />
        <Button
          label={savingPhoto ? '' : 'Add Photo'}
          onPress={addPhoto}
          disabled={savingPhoto}
          icon={savingPhoto ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={16} color={colors.onPrimary} />}
          style={{ marginTop: 10 }}
        />
      </Card>

      {photos.length === 0 ? (
        <Empty icon={<Ionicons name="images-outline" size={26} color={colors.outline} />} text="No progress photos yet." />
      ) : photos.map(p => (
        <View key={p.id} style={styles.photoRow}>
          <Image
            source={{ uri: p.url.startsWith('http') ? p.url : `${baseUrl}${p.url}` }}
            style={{ width: 64, height: 64, borderRadius: 10 }}
            contentFit="cover"
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.photoCaption}>{p.caption || 'Progress'}</Text>
            <Text style={styles.photoDate}>{p.date}</Text>
          </View>
          <TouchableOpacity onPress={() => deletePhoto(p.id)}>
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
  hint: { color: colors.onSurfaceVar, fontSize: 12, marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  logRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVar,
  },
  logDate: { color: colors.onSurface, fontSize: 13, fontWeight: '600' },
  logKg: { color: colors.onSurfaceVar, fontSize: 13, fontFamily: 'Menlo' },
  photoRow: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: colors.surfaceVar, borderRadius: radius.md, marginBottom: 8,
  },
  photoCaption: { color: colors.onSurface, fontWeight: '600', fontSize: 13 },
  photoDate: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 2 },
});
