import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

const STATUS_TONE = { active: 'success', expired: 'error', inactive: 'default' };

export default function GymPassScreen({ route }) {
  const memberId = route?.params?.memberId;
  const [pass, setPass] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const path = memberId ? `/api/admin/members/${memberId}/gym-pass` : '/api/me/gym-pass';
    api(path).then(setPass).catch(e => setError(e.message));
  }, [memberId]);

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle" size={36} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!pass) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, alignItems: 'center' }}>
      <View style={styles.card}>
        <View style={styles.cardFace}>
          <View style={styles.head}>
            <View style={styles.logo}><Text style={styles.logoText}>SF</Text></View>
            <View>
              <Text style={styles.brand}>STELLAR FITNESS CLUB</Text>
              <Text style={styles.brandSub}>Digital Membership Pass</Text>
            </View>
          </View>

          <View style={styles.bodyRow}>
            {pass.photoUrl ? (
              <Image source={{ uri: pass.photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Ionicons name="person" size={40} color={colors.outline} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{pass.name}</Text>
              <Text style={styles.memberId}>{pass.memberId}</Text>
              <Chip label={pass.status} tone={STATUS_TONE[pass.status] || 'default'} />
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                <Detail lbl="Plan" val={pass.plan || '—'} />
                <Detail lbl="Valid Until" val={fmtDate(pass.expiryDate)} />
              </View>
            </View>
          </View>

          <View style={styles.qrBadge}>
            <Image source={{ uri: pass.qrDataUrl }} style={styles.qr} />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.details}>
          <Detail lbl="Batch" val={pass.batchName || '—'} />
          <Detail lbl="Trainer" val={pass.trainerName || '—'} />
          <Detail lbl="Member Since" val={fmtDate(pass.memberSince)} />
          <Detail lbl="Type" val={pass.memberType === 'pt' ? 'Personal Training' : 'Regular'} />
        </View>
      </View>
      <Text style={styles.hint}>Show this QR at the front desk for a quick membership check.</Text>
    </ScrollView>
  );
}

function Detail({ lbl, val }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLbl}>{lbl.toUpperCase()}</Text>
      <Text style={styles.detailVal}>{val}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  errorText: { color: colors.error, marginTop: 10, textAlign: 'center' },
  card: {
    width: '100%', maxWidth: 380, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#1f2227', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardFace: { position: 'relative' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 12 },
  logo: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontWeight: '800', color: '#111' },
  brand: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  brandSub: { color: '#aaa', fontSize: 11, marginTop: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20 },
  bodyRow: { flexDirection: 'row', gap: 16, padding: 20, paddingTop: 4, paddingBottom: 20, alignItems: 'flex-start' },
  photo: { width: 92, height: 116, borderRadius: 14 },
  photoPlaceholder: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 2, marginTop: 4 },
  memberId: { color: '#999', fontSize: 12, fontFamily: 'Menlo', marginBottom: 8 },
  details: { padding: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  detailItem: { width: '45%' },
  detailLbl: { color: '#8a8f99', fontSize: 10, letterSpacing: 0.5, marginBottom: 2 },
  detailVal: { color: '#fff', fontSize: 13, fontWeight: '500' },
  qrBadge: {
    position: 'absolute', right: 16, bottom: 16,
    width: 44, height: 44, borderRadius: 8, backgroundColor: '#fff', padding: 3,
  },
  qr: { width: '100%', height: '100%', borderRadius: 5 },
  hint: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 16, textAlign: 'center' },
});
