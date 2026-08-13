import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { Button, Chip } from '../components/Common';
import { initials } from '../api';

const ROLE_LABEL = { admin: 'Admin', staff: 'Staff', trainer: 'Trainer' };

// Shared account screen for trainer/admin/staff — no workout/nutrition
// profile fields (those are member-specific), just identity + logout.
export default function SimpleAccountScreen({ user, onLogout }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, alignItems: 'center', paddingTop: 60 }}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user.name)}</Text></View>
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.email}>{user.email}</Text>
      <Chip label={ROLE_LABEL[user.role] || user.role} tone="primary" style={{ marginTop: 8 }} />

      <Button
        label="Log Out"
        variant="danger"
        onPress={onLogout}
        icon={<Ionicons name="log-out" size={18} color={colors.error} />}
        style={{ marginTop: 32, width: '100%' }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 76, height: 76, borderRadius: radius.lg,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimaryContainer, fontSize: 26, fontWeight: '800' },
  name: { color: colors.onSurface, fontSize: 20, fontWeight: '700', marginTop: 14 },
  email: { color: colors.onSurfaceVar, fontSize: 13, marginTop: 2 },
});
