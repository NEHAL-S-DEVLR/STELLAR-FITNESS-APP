import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

export default function AdminCheckinQrScreen() {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api('/api/admin/checkin-qr').then(setQr).catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, []);

  async function regenerate() {
    Alert.alert(
      'Regenerate QR code?',
      "The old printed copy will stop working immediately.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate', style: 'destructive', onPress: async () => {
            setBusy(true);
            try {
              await api('/api/admin/checkin-qr/regenerate', { method: 'POST' });
              load();
            } catch (e) { Alert.alert('Failed', e.message); } finally { setBusy(false); }
          },
        },
      ]
    );
  }

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!qr) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Check-in QR</Text>
      <Text style={styles.hint}>Members scan this with their phone camera to mark today's attendance. Print it and stick it at the entrance.</Text>
      <Image source={{ uri: qr.qrDataUrl }} style={styles.qr} />
      <Button
        label={busy ? '' : 'Regenerate'}
        variant="tonal"
        onPress={regenerate}
        disabled={busy}
        icon={busy ? <ActivityIndicator color={colors.onPrimaryContainer} /> : <Ionicons name="refresh" size={16} color={colors.onPrimaryContainer} />}
        style={{ marginTop: 24, width: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  error: { color: colors.error, fontSize: 14, textAlign: 'center' },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: '800', marginBottom: 10 },
  hint: { color: colors.onSurfaceVar, fontSize: 13, textAlign: 'center', marginBottom: 20 },
  qr: { width: 240, height: 240, borderRadius: radius.md, backgroundColor: '#fff' },
});
