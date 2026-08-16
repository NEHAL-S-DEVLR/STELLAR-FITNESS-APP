import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Chip, Empty } from '../components/Common';

export default function WorkoutScreen({ user }) {
  const plan = user.workoutPlan;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long' });

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center' }}>
        <Empty text="No workout plan assigned yet." />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.planName}>{plan.name}</Text>
      <Text style={styles.planMeta}>Assigned by {plan.assignedBy}</Text>

      {(plan.days || []).length === 0 ? (
        <Empty text="Your plan is being put together — check back soon." />
      ) : (
        plan.days.map((day) => (
          <DayCard key={day.day} day={day} isToday={day.day === today} />
        ))
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function DayCard({ day, isToday }) {
  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday]}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayName}>{day.day}</Text>
        {day.focus ? <Text style={styles.dayFocus}>{day.focus}</Text> : null}
      </View>
      {(day.items || []).length === 0 ? (
        <Text style={styles.rest}>Rest day</Text>
      ) : (
        day.items.map((item, i) => (
          <View key={i} style={styles.exercise}>
            <Text style={styles.exName}>{item.exercise}</Text>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              {item.muscleGroup ? <Chip label={item.muscleGroup} tone="primary" /> : null}
              {item.machine ? <Chip label={item.machine} tone="info" /> : null}
              {item.sets ? <Text style={styles.sets}>{item.sets}</Text> : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  planName: { color: colors.onSurface, fontSize: 22, fontWeight: '700' },
  planMeta: { color: colors.onSurfaceVar, fontSize: 12, marginBottom: 14 },
  dayCard: {
    backgroundColor: colors.surfaceVar,
    borderRadius: radius.md,
    padding: 14, marginBottom: 10,
  },
  dayCardToday: {
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.30)',
    backgroundColor: 'rgba(59,130,246,0.06)',
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  dayName:  { color: colors.onSurface, fontWeight: '700', fontSize: 15 },
  dayFocus: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  rest:  { color: colors.onSurfaceVar, fontSize: 12 },
  exercise: {
    padding: 10, borderRadius: radius.sm,
    backgroundColor: colors.surface, marginBottom: 6,
  },
  exName: { color: colors.onSurface, fontWeight: '600', fontSize: 13 },
  sets:   { color: colors.onSurfaceVar, fontSize: 11, fontFamily: 'Menlo', marginLeft: 'auto' },
});
