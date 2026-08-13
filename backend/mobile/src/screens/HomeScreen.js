import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, StatCard, Chip, Button, SectionTitle, ProgressBar, Empty } from '../components/Common';
import Heatmap from '../components/Heatmap';
import { colors, radius, spacing } from '../theme';
import { bmi, bmiCategory, daysUntil } from '../api';

export default function HomeScreen({ user, foodToday, onCheckIn, onRefresh, refreshing, navigation }) {
  const todayName = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  const todayIso = new Date().toISOString().slice(0, 10);
  const dateFmt = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const checkedIn = (user.attendance || []).includes(todayIso);

  const latestWeight = user.weightLog?.[user.weightLog.length - 1]?.kg;
  const bmiVal = bmi(latestWeight, user.height);
  const bmiCat = bmiCategory(bmiVal);
  const last30 = countLast30(user.attendance || []);

  const workoutToday = user.workoutPlan?.days?.find(d => d.day === todayName);
  const foodTotal = foodToday?.total?.calories || 0;
  const foodTarget = foodToday?.target?.calories || null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.hello}>Hey, {user.name.split(' ')[0]}</Text>
      <Text style={styles.date}>{dateFmt}</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button
          label="Scan to Check In"
          onPress={() => navigation.navigate('CheckIn')}
          disabled={checkedIn}
          variant={checkedIn ? 'tonal' : 'filled'}
          icon={<Ionicons name={checkedIn ? 'checkmark-circle' : 'qr-code'} size={18} color={checkedIn ? colors.onPrimaryContainer : colors.onPrimary} />}
          style={{ flex: 1 }}
        />
        <Button
          label="Gym Pass"
          onPress={() => navigation.navigate('GymPass')}
          variant="outlined"
          icon={<Ionicons name="card" size={18} color={colors.primary} />}
          style={{ flex: 1 }}
        />
      </View>
      {checkedIn && <Text style={styles.checkedInNote}>Checked in today ✓ — tap Scan again tomorrow.</Text>}

      {/* Stats — 2x2 */}
      <View style={styles.row}>
        <StatCard label="Weight"       value={latestWeight ? `${latestWeight.toFixed(1)} kg` : '—'} style={styles.half} />
        <StatCard label="BMI"          value={bmiVal ? bmiVal.toFixed(1) : '—'} sub={bmiCat.label} style={styles.half} />
      </View>
      <View style={styles.row}>
        <StatCard label="Calories today" value={foodTotal} sub={foodTarget ? `of ${foodTarget} kcal` : 'No target set'} style={styles.half} />
        <StatCard label="Check-ins 30d"  value={last30} style={styles.half} />
      </View>

      {/* Subscription card */}
      {user.subscription && <SubscriptionCard sub={user.subscription} />}

      {/* Attendance heatmap */}
      <SectionTitle>Attendance</SectionTitle>
      <Card>
        <Heatmap dateStrings={user.attendance || []} weeks={20} />
      </Card>

      {/* Today's workout */}
      <SectionTitle>Today's Workout</SectionTitle>
      <Card>
        {!user.workoutPlan ? (
          <Empty text="No workout plan assigned yet." />
        ) : !workoutToday || (workoutToday.items || []).length === 0 ? (
          <View>
            <Text style={styles.dayName}>Rest day</Text>
            <Text style={styles.dayFocus}>Recover well.</Text>
          </View>
        ) : (
          <View>
            <View style={styles.dayHeader}>
              <Text style={styles.dayFocusMain}>{workoutToday.focus}</Text>
              <Chip label={`${workoutToday.items.length} exercises`} tone="default" />
            </View>
            {workoutToday.items.slice(0, 4).map((item, i) => (
              <ExerciseRow key={i} item={item} />
            ))}
            {workoutToday.items.length > 4 && (
              <Text style={styles.moreLink}>+ {workoutToday.items.length - 4} more — see Workout tab</Text>
            )}
          </View>
        )}
      </Card>

      {/* Nutrition summary */}
      <SectionTitle>Nutrition — Today</SectionTitle>
      <Card>
        {!foodToday || foodToday.entries.length === 0 ? (
          <Empty
            icon={<Ionicons name="restaurant" size={30} color={colors.outline} />}
            text="Nothing logged today — tap Food to add a meal."
          />
        ) : (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.calBig}>{foodToday.total.calories}</Text>
              <Text style={styles.calUnit}> kcal</Text>
              {foodTarget && (
                <Text style={styles.calTarget}>of {foodTarget}</Text>
              )}
            </View>
            {foodTarget && (
              <View style={{ marginTop: 8 }}>
                <ProgressBar value={foodTotal / foodTarget} tone={foodTotal / foodTarget > 1.1 ? 'error' : 'primary'} />
              </View>
            )}
            <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
              <MacroPill label="P" value={foodToday.total.protein} />
              <MacroPill label="C" value={foodToday.total.carbs} />
              <MacroPill label="F" value={foodToday.total.fats} />
              <Chip label={`${foodToday.entries.length} entries`} tone="primary" style={{ marginLeft: 'auto' }} />
            </View>
          </View>
        )}
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ExerciseRow({ item }) {
  return (
    <View style={styles.exerciseRow}>
      <Text style={styles.exName}>{item.exercise}</Text>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
        {item.muscleGroup ? <Chip label={item.muscleGroup} tone="primary" /> : null}
        {item.machine ? <Chip label={item.machine} tone="info" /> : null}
        {item.sets ? <Text style={styles.setsMono}>{item.sets}</Text> : null}
      </View>
    </View>
  );
}

function MacroPill({ label, value }) {
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroValue}>{Math.round(value || 0)}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function SubscriptionCard({ sub }) {
  const days = daysUntil(sub.expiryDate);
  const label = days == null ? '—' :
    days < 0    ? `Expired ${Math.abs(days)}d ago` :
    days === 0  ? 'Expires today' :
    days === 1  ? 'Expires tomorrow' :
                  `${days} days left`;
  return (
    <View style={styles.subCard}>
      <Text style={styles.subLbl}>SUBSCRIPTION</Text>
      <Text style={styles.subPlan}>{sub.plan}</Text>
      <Text style={styles.subCountdown}>{label}</Text>
      <Text style={styles.subDates}>{sub.startDate} → {sub.expiryDate}</Text>
    </View>
  );
}

function countLast30(dates) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  return dates.filter(d => new Date(d) >= cutoff).length;
}

const styles = StyleSheet.create({
  hello: { color: colors.onSurface, fontSize: 28, fontWeight: '700' },
  date:  { color: colors.onSurfaceVar, fontSize: 13, marginTop: 2 },
  checkedInNote: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 8, textAlign: 'center' },
  row:   { flexDirection: 'row', gap: 10, marginTop: 12 },
  half:  { flex: 1 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayName:      { color: colors.onSurface, fontWeight: '700', fontSize: 15 },
  dayFocus:     { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2 },
  dayFocusMain: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  moreLink:     { color: colors.onSurfaceVar, fontSize: 11, marginTop: 6, textAlign: 'center' },
  exerciseRow: {
    padding: 10, borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginBottom: 6,
  },
  exName:   { color: colors.onSurface, fontWeight: '600', fontSize: 13 },
  setsMono: { color: colors.onSurfaceVar, fontSize: 11, fontFamily: 'Menlo', marginLeft: 'auto' },
  calBig:    { color: colors.primary, fontSize: 36, fontWeight: '800' },
  calUnit:   { color: colors.onSurfaceVar, fontSize: 14 },
  calTarget: { color: colors.onSurfaceVar, fontSize: 11, marginLeft: 'auto', alignSelf: 'flex-end', marginBottom: 4 },
  macroPill: {
    flex: 1, padding: 8, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center',
  },
  macroValue: { color: colors.onSurface, fontWeight: '700', fontSize: 14 },
  macroLabel: { color: colors.onSurfaceVar, fontSize: 10 },
  subCard: {
    marginTop: 16, padding: 18, borderRadius: radius.lg,
    backgroundColor: colors.primaryContainer,
  },
  subLbl:       { color: 'rgba(255,219,202,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  subPlan:      { color: colors.onPrimaryContainer, fontSize: 17, fontWeight: '700', marginTop: 4 },
  subCountdown: { color: colors.onPrimaryContainer, fontSize: 24, fontWeight: '800' },
  subDates:     { color: 'rgba(255,219,202,0.65)', fontSize: 12, marginTop: 2 },
});
