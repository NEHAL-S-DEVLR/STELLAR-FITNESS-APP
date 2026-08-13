import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api, Session, defaultBaseUrl } from '../api';
import { colors, radius, spacing } from '../theme';
import { Button } from '../components/Common';

export default function LoginScreen({ onSignedIn }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    Session.getBaseUrl().then(setBaseUrl);
  }, []);

  async function submit() {
    setError(null); setBusy(true);
    try {
      const path = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const body = mode === 'signup'
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };
      const res = await api(path, { method: 'POST', body });
      await Session.setToken(res.token);
      onSignedIn();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>SF</Text>
        </View>
        <Text style={styles.title}>Stellar Fitness Club</Text>
        <Text style={styles.subtitle}>Track workouts, food and progress</Text>

        {/* Segmented toggle */}
        <View style={styles.segment}>
          <SegBtn label="Sign in" active={mode === 'login'} onPress={() => { setMode('login'); setError(null); }} />
          <SegBtn label="Create account" active={mode === 'signup'} onPress={() => { setMode('signup'); setError(null); }} />
        </View>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={colors.outline}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.outline}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.outline}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={busy ? '' : (mode === 'signup' ? 'Create account' : 'Sign in')}
          onPress={submit}
          disabled={busy || !email || !password || (mode === 'signup' && !name)}
          icon={busy ? <ActivityIndicator color={colors.onPrimary} /> : (
            <Ionicons name={mode === 'signup' ? 'person-add' : 'log-in'} size={18} color={colors.onPrimary} />
          )}
          style={{ marginTop: spacing.md }}
        />

        {/* Server URL toggle */}
        <TouchableOpacity onPress={() => setShowSettings(!showSettings)} style={{ marginTop: 18 }}>
          <Text style={styles.serverLink}>
            {showSettings ? 'Hide server URL' : `Server: ${baseUrl || defaultBaseUrl()}`}
          </Text>
        </TouchableOpacity>
        {showSettings && (
          <View style={{ marginTop: 10 }}>
            <TextInput
              style={styles.input}
              placeholder="http://192.168.x.x:3000"
              placeholderTextColor={colors.outline}
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
            />
            <Button
              label="Save"
              variant="tonal"
              onPress={async () => {
                await Session.setBaseUrl(baseUrl);
                Alert.alert('Saved', 'Server URL updated. Try signing in.');
              }}
            />
            <Text style={styles.hint}>
              Expo Go auto-detects your laptop's IP via Metro, so you rarely need to change this.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SegBtn({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.segBtn, active && { backgroundColor: colors.primary }]}
      activeOpacity={0.7}
    >
      <Text style={[styles.segBtnLabel, active && { color: colors.onPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { padding: 28, paddingTop: 60, alignItems: 'stretch' },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  logoText: { color: colors.onPrimaryContainer, fontWeight: '900', fontSize: 26 },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  subtitle: { color: colors.onSurfaceVar, fontSize: 13, textAlign: 'center', marginBottom: 22 },
  segment: {
    flexDirection: 'row', padding: 4, borderRadius: radius.full,
    backgroundColor: colors.surface, marginBottom: 20,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.full, alignItems: 'center' },
  segBtnLabel: { color: colors.onSurfaceVar, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: colors.surfaceHi,
    borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs,
    color: colors.onSurface, fontSize: 15,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 10,
  },
  error: { color: colors.error, fontSize: 13, textAlign: 'center', marginTop: 6 },
  serverLink: { color: colors.info, fontSize: 12, textAlign: 'center' },
  hint: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 6, textAlign: 'center' },
});
