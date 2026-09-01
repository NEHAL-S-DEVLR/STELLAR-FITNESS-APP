import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Button, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const STATUS_TONE = { requested: 'info', scheduled: 'warning', completed: 'success', declined: 'error' };

export default function ReelRequestsScreen() {
  const [requests, setRequests] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [reelUrl, setReelUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try { setRequests(await api('/api/member/reel-requests')); }
    catch (e) { Alert.alert('Could not load', e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function submit() {
    setSubmitting(true);
    try {
      await api('/api/member/reel-requests', {
        method: 'POST',
        body: { message: message.trim(), reel_url: reelUrl.trim() },
      });
      setMessage('');
      setReelUrl('');
      await load();
    } catch (e) {
      Alert.alert('Could not send', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveUrl(id, url) {
    if (!url.trim()) return;
    try {
      await api(`/api/member/reel-requests/${id}`, { method: 'PATCH', body: { reel_url: url.trim() } });
      await load();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Reel Shoot Request</Text>
      <Text style={styles.subtitle}>Ask a trainer to shoot a reel with you, or paste the link once it's live.</Text>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.field}>MESSAGE — OPTIONAL</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="e.g. Want a shoulder-day reel this week"
          placeholderTextColor={colors.outline}
          multiline
          value={message}
          onChangeText={setMessage}
        />
        <Text style={styles.field}>REEL URL — IF YOU ALREADY HAVE ONE</Text>
        <TextInput
          style={styles.input}
          placeholder="https://instagram.com/reel/…"
          placeholderTextColor={colors.outline}
          autoCapitalize="none"
          keyboardType="url"
          value={reelUrl}
          onChangeText={setReelUrl}
        />
        <Button
          label={submitting ? 'Sending…' : 'Send Request'}
          onPress={submit}
          disabled={submitting}
          icon={submitting ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="videocam" size={18} color={colors.onPrimary} />}
          style={{ marginTop: 14 }}
        />
      </Card>

      <Text style={styles.section}>YOUR REQUESTS</Text>
      {requests === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : requests.length === 0 ? (
        <Empty icon={<Ionicons name="film-outline" size={28} color={colors.outline} />} text="No requests yet" />
      ) : (
        requests.map(r => <RequestCard key={r.id} r={r} onSaveUrl={saveUrl} />)
      )}
    </ScrollView>
  );
}

function RequestCard({ r, onSaveUrl }) {
  const [url, setUrl] = useState('');
  return (
    <Card style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reqMessage}>{r.message || 'No message'}</Text>
          <Text style={styles.reqDate}>
            {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <Chip label={r.status[0].toUpperCase() + r.status.slice(1)} tone={STATUS_TONE[r.status] || 'default'} />
      </View>
      {r.reelUrl ? (
        <Text style={styles.reqUrl} numberOfLines={1}>{r.reelUrl}</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <TextInput
            style={[styles.input, { flex: 1, marginTop: 0 }]}
            placeholder="Paste your reel URL once it's live"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            value={url}
            onChangeText={setUrl}
          />
          <Button label="Save" variant="tonal" onPress={() => onSaveUrl(r.id, url)} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.onSurfaceVar, fontSize: 13, marginTop: 4 },
  section: {
    fontSize: 11, fontWeight: '700', color: colors.onSurfaceVar,
    letterSpacing: 1, marginTop: 24, marginBottom: 4,
  },
  field: { color: colors.onSurfaceVar, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12, marginTop: 4,
  },
  reqMessage: { color: colors.onSurface, fontSize: 14, fontWeight: '600' },
  reqDate: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 4 },
  reqUrl: { color: colors.primary, fontSize: 13, marginTop: 10 },
});
