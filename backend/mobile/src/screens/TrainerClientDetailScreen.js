import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, SectionTitle, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Each exercise line is "Exercise | Muscle Group | Machine | Sets" — a plain-
// text stand-in for the website's exercise-library picker, saving/sending
// the exact same workout_plan_json shape the backend and the website both
// read, just typed instead of picked from a list.
function itemsToText(items) {
  return (items || []).map(i => [i.exercise, i.muscleGroup, i.machine, i.sets].filter(Boolean).join(' | ')).join('\n');
}
function textToItems(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [exercise, muscleGroup, machine, sets] = line.split('|').map(s => (s || '').trim());
    return { exercise: exercise || line, muscleGroup: muscleGroup || '', machine: machine || '', sets: sets || '' };
  });
}

export default function TrainerClientDetailScreen({ route }) {
  const { clientId, clientName, status, packageName, trainerId } = route.params;
  // trainerId is only passed when an admin opens a PT client's plan from
  // AdminMemberDetailScreen — mirrors the website's "viewing as trainer"
  // dropdown, just auto-scoped to that member's actual assigned trainer
  // instead of a manual picker.
  const withTrainerParam = (path) => trainerId ? `${path}${path.includes('?') ? '&' : '?'}trainerId=${trainerId}` : path;
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  const [dayIdx, setDayIdx] = useState(0);
  const [dayFocus, setDayFocus] = useState({});
  const [dayText, setDayText] = useState({});
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [sendingWorkout, setSendingWorkout] = useState(false);

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [mealsText, setMealsText] = useState('');
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [sendingNutrition, setSendingNutrition] = useState(false);

  useEffect(() => {
    api(withTrainerParam(`/api/trainer/clients/${clientId}`))
      .then((d) => {
        setDetail(d);
        const focus = {}; const text = {};
        WEEKDAYS.forEach((day) => {
          const found = d.workoutPlan?.days?.find((x) => x.day === day);
          focus[day] = found?.focus || '';
          text[day] = itemsToText(found?.items);
        });
        setDayFocus(focus); setDayText(text);
        setCalories(String(d.nutritionPlan?.calories || ''));
        setProtein(String(d.nutritionPlan?.protein || ''));
        setCarbs(String(d.nutritionPlan?.carbs || ''));
        setFats(String(d.nutritionPlan?.fats || ''));
        setMealsText((d.nutritionPlan?.meals || []).map(m => `${m.name} | ${m.items}`).join('\n'));
      })
      .catch((e) => setError(e.message));
  }, [clientId]);

  function buildWorkoutPlan() {
    return {
      name: detail?.workoutPlan?.name || '',
      assignedBy: detail?.workoutPlan?.assignedBy || '',
      days: WEEKDAYS.map((day) => ({ day, focus: dayFocus[day] || '', items: textToItems(dayText[day] || '') })),
    };
  }

  async function saveWorkout() {
    setSavingWorkout(true);
    try {
      await api(withTrainerParam(`/api/trainer/clients/${clientId}/workout`), { method: 'PUT', body: buildWorkoutPlan() });
      Alert.alert('Saved', 'Workout plan updated.');
    } catch (e) { Alert.alert('Could not save', e.message); } finally { setSavingWorkout(false); }
  }

  async function sendWorkout() {
    setSendingWorkout(true);
    try {
      await saveWorkoutSilently();
      const res = await api(withTrainerParam(`/api/trainer/clients/${clientId}/workout/whatsapp`), { method: 'POST' });
      if (res.mode === 'link' && res.link) Alert.alert('Open WhatsApp', 'Tap OK, then send the pre-filled message.', [{ text: 'OK' }]);
      else Alert.alert('Sent', 'Workout plan sent on WhatsApp.');
    } catch (e) { Alert.alert('Could not send', e.message); } finally { setSendingWorkout(false); }
  }
  async function saveWorkoutSilently() {
    await api(withTrainerParam(`/api/trainer/clients/${clientId}/workout`), { method: 'PUT', body: buildWorkoutPlan() });
  }

  function buildNutritionPlan() {
    return {
      calories: parseInt(calories) || 0,
      protein: parseInt(protein) || 0,
      carbs: parseInt(carbs) || 0,
      fats: parseInt(fats) || 0,
      meals: mealsText.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
        const [name, ...rest] = line.split('|');
        return { name: (name || '').trim(), items: rest.join('|').trim() };
      }),
    };
  }

  async function saveNutrition() {
    setSavingNutrition(true);
    try {
      await api(withTrainerParam(`/api/trainer/clients/${clientId}/nutrition`), { method: 'PUT', body: buildNutritionPlan() });
      Alert.alert('Saved', 'Nutrition plan updated.');
    } catch (e) { Alert.alert('Could not save', e.message); } finally { setSavingNutrition(false); }
  }

  async function sendNutrition() {
    setSendingNutrition(true);
    try {
      await api(withTrainerParam(`/api/trainer/clients/${clientId}/nutrition`), { method: 'PUT', body: buildNutritionPlan() });
      const res = await api(withTrainerParam(`/api/trainer/clients/${clientId}/nutrition/whatsapp`), { method: 'POST' });
      if (res.mode === 'link' && res.link) Alert.alert('Open WhatsApp', 'Tap OK, then send the pre-filled message.', [{ text: 'OK' }]);
      else Alert.alert('Sent', 'Nutrition plan sent on WhatsApp.');
    } catch (e) { Alert.alert('Could not send', e.message); } finally { setSendingNutrition(false); }
  }

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!detail) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>{clientName}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 20 }}>
        {status ? <Chip label={status} tone="primary" /> : null}
        {packageName ? <Chip label={packageName} /> : null}
      </View>

      <SectionTitle>Workout Plan</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {WEEKDAYS.map((day, i) => (
            <TouchableOpacity key={day} onPress={() => setDayIdx(i)} activeOpacity={0.7}>
              <Chip label={day.slice(0, 3)} tone={dayIdx === i ? 'primary' : 'default'} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Focus (e.g. "Push Day", "Rest")</Text>
        <TextInput
          style={styles.input}
          value={dayFocus[WEEKDAYS[dayIdx]] || ''}
          onChangeText={(v) => setDayFocus((s) => ({ ...s, [WEEKDAYS[dayIdx]]: v }))}
          placeholder="Focus for this day"
          placeholderTextColor={colors.outline}
        />
        <Text style={[styles.label, { marginTop: 12 }]}>Exercises — one per line: Exercise | Muscle Group | Machine | Sets</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={dayText[WEEKDAYS[dayIdx]] || ''}
          onChangeText={(v) => setDayText((s) => ({ ...s, [WEEKDAYS[dayIdx]]: v }))}
          multiline
          placeholder={'Bench Press | Chest | Barbell | 4x8\nLat Pulldown | Back | Cable | 3x12'}
          placeholderTextColor={colors.outline}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Button label={savingWorkout ? '' : 'Save'} variant="tonal" onPress={saveWorkout} disabled={savingWorkout}
              icon={savingWorkout ? <ActivityIndicator color={colors.onPrimaryContainer} /> : <Ionicons name="save" size={16} color={colors.onPrimaryContainer} />} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={sendingWorkout ? '' : 'Save & Send'} onPress={sendWorkout} disabled={sendingWorkout}
              icon={sendingWorkout ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="logo-whatsapp" size={16} color={colors.onPrimary} />} />
          </View>
        </View>
      </Card>

      <SectionTitle>Nutrition Plan</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <NumField label="Calories" value={calories} onChangeText={setCalories} />
          <NumField label="Protein (g)" value={protein} onChangeText={setProtein} />
          <NumField label="Carbs (g)" value={carbs} onChangeText={setCarbs} />
          <NumField label="Fats (g)" value={fats} onChangeText={setFats} />
        </View>
        <Text style={styles.label}>Meals — one per line: Meal name | items</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={mealsText}
          onChangeText={setMealsText}
          multiline
          placeholder={'Breakfast | Oats with banana and protein shake\nLunch | Grilled chicken, rice, vegetables'}
          placeholderTextColor={colors.outline}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Button label={savingNutrition ? '' : 'Save'} variant="tonal" onPress={saveNutrition} disabled={savingNutrition}
              icon={savingNutrition ? <ActivityIndicator color={colors.onPrimaryContainer} /> : <Ionicons name="save" size={16} color={colors.onPrimaryContainer} />} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={sendingNutrition ? '' : 'Save & Send'} onPress={sendNutrition} disabled={sendingNutrition}
              icon={sendingNutrition ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="logo-whatsapp" size={16} color={colors.onPrimary} />} />
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function NumField({ label, value, onChangeText }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.labelSm}>{label}</Text>
      <TextInput style={styles.inputSm} value={value} onChangeText={onChangeText} keyboardType="numeric" placeholderTextColor={colors.outline} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  error: { color: colors.error, fontSize: 14, textAlign: 'center' },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: '800' },
  label: { color: colors.onSurfaceVar, fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  labelSm: { color: colors.onSurfaceVar, fontSize: 10, fontWeight: '600', marginBottom: 4 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  inputSm: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 13,
    paddingVertical: 8, paddingHorizontal: 10,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top', fontFamily: 'Menlo' },
});
