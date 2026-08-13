import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '../components/Common';
import { colors, spacing } from '../theme';
import { api } from '../api';

// Scans the gym's shared entrance QR (same code the web check-in page reads)
// and calls the same /api/checkin endpoint, so attendance is marked
// identically whether a member scans with the app or with their phone's
// bare camera app.
export default function CheckInScreen({ navigation, onCheckedIn }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }
  const scannedRef = useRef(false);

  async function handleScan({ data }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setLocked(true);

    let token = data;
    try {
      const url = new URL(data);
      token = url.searchParams.get('t') || data;
    } catch {
      // Not a URL — treat the raw scanned value as the token.
    }

    try {
      const res = await api('/api/checkin', { method: 'POST', body: { token } });
      setResult({ ok: true, message: res.alreadyCheckedIn ? "You're already checked in today." : `Checked in for ${res.date}.` });
      onCheckedIn && onCheckedIn();
    } catch (e) {
      setResult({ ok: false, message: e.message });
    }
  }

  function scanAgain() {
    scannedRef.current = false;
    setLocked(false);
    setResult(null);
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={40} color={colors.outline} />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>To scan the gym's check-in QR code, allow camera access.</Text>
        <Button label="Allow Camera" onPress={requestPermission} style={{ marginTop: 16 }} />
        <Button label="Cancel" variant="text" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {!result ? (
        <>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={locked ? undefined : handleScan}
          />
          <View style={styles.overlay}>
            <Text style={styles.hint}>Point your camera at the gym's entrance QR code</Text>
            <Button label="Cancel" variant="tonal" onPress={() => navigation.goBack()} />
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Ionicons
            name={result.ok ? 'checkmark-circle' : 'close-circle'}
            size={56}
            color={result.ok ? colors.success : colors.error}
          />
          <Text style={styles.resultTitle}>{result.ok ? 'Checked in!' : 'Could not check in'}</Text>
          <Text style={styles.permBody}>{result.message}</Text>
          <Button label={result.ok ? 'Done' : 'Try Again'} onPress={result.ok ? () => navigation.goBack() : scanAgain} style={{ marginTop: 20 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.bg },
  permTitle: { color: colors.onSurface, fontSize: 17, fontWeight: '700', marginTop: 14 },
  permBody: { color: colors.onSurfaceVar, fontSize: 13, marginTop: 8, textAlign: 'center' },
  resultTitle: { color: colors.onSurface, fontSize: 20, fontWeight: '800', marginTop: 16 },
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.lg, gap: 12, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  hint: { color: '#fff', textAlign: 'center', fontSize: 13, marginBottom: 4 },
});
