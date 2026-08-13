import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, Session, defaultBaseUrl } from '../api';
import { colors, radius, spacing } from '../theme';
import { Button } from '../components/Common';

// Sign-in only — accounts are created by admin (member/trainer/staff), who
// sends login credentials over WhatsApp. There is no public self-signup.
export default function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const res = await api('/api/auth/login', { method: 'POST', body: { email: email.trim(), password } });
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
          label={busy ? '' : 'Sign in'}
          onPress={submit}
          disabled={busy || !email || !password}
          icon={busy ? <ActivityIndicator color={colors.onPrimary} /> : (
            <Ionicons name="log-in" size={18} color={colors.onPrimary} />
          )}
          style={{ marginTop: spacing.md }}
        />

        <Text style={styles.hint}>
          New here? Visit the front desk to get set up — your login is sent to you on WhatsApp.
        </Text>

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
  hint: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 14, textAlign: 'center' },
});
