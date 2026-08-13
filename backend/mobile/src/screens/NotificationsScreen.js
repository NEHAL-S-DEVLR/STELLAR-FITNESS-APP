import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { Empty } from '../components/Common';

const TYPE_META = {
  offer:   { icon: 'pricetag',       color: colors.success },
  expiry:  { icon: 'time',           color: colors.warning },
  general: { icon: 'megaphone',      color: colors.info },
};

export default function NotificationsScreen({ notifications }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>Notifications</Text>
      {notifications.length === 0 ? (
        <Empty text="No notifications yet" />
      ) : (
        notifications.map(n => {
          const meta = TYPE_META[n.type] || TYPE_META.general;
          return (
            <View key={n.id} style={[styles.card, !n.read && styles.cardUnread]}>
              <View style={[styles.icon, { backgroundColor: `${meta.color}22` }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifBody}>{n.body}</Text>
                <Text style={styles.notifWhen}>{new Date(n.sent).toLocaleString()}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 28, fontWeight: '700', marginBottom: 14 },
  card: {
    flexDirection: 'row', gap: 12, padding: 14,
    borderRadius: radius.md, backgroundColor: colors.surfaceVar, marginBottom: 8,
  },
  cardUnread: {
    backgroundColor: 'rgba(255,181,154,0.10)',
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  icon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  notifTitle: { color: colors.onSurface, fontWeight: '700', fontSize: 14 },
  notifBody:  { color: colors.onSurfaceVar, fontSize: 13, marginTop: 2 },
  notifWhen:  { color: colors.outline, fontSize: 10, marginTop: 6 },
});
