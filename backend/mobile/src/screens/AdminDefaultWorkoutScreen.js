import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, SectionTitle, Button, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function itemsToText(items) {
  return (items || []).map(i => [i.exercise, i.muscleGroup, i.machine, i.sets].filter(Boolean).join(' | ')).join('\n');
}
function textToItems(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [exercise, muscleGroup, machine, sets] = line.split('|').map(s => (s || '').trim());
    return { exercise: exercise || line, muscleGroup: muscleGroup || '', machine: machine || '', sets: sets || '' };
  });
}

export default function AdminDefaultWorkoutScreen() {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [planName, setPlanName] = useState('');
  const [dayIdx, setDayIdx] = useState(0);
  const [dayFocus, setDayFocus] = useState({});
  const [dayText, setDayText] = useState({});
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api('/api/admin/default-workout-plan')
      .then((d) => {
        setPlan(d);
        setPlanName(d.name || '');
        const focus = {}; const text = {};
        WEEKDAYS.forEach((day) => {
          const found = d.days?.find((x) => x.day === day);
          focus[day] = found?.focus || '';
          text[day] = itemsToText(found?.items);
        });
        setDayFocus(focus); setDayText(text);
      })
      .catch((e) => setError(e.message));
  }, []);

  function buildPlan() {
    return {
      name: planName,
      days: WEEKDAYS.map((day) => ({ day, focus: dayFocus[day] || '', items: textToItems(dayText[day] || '') })),
    };
  }

  async function save() {
    setSaving(true);
    try {
      await api('/api/admin/default-workout-plan', { method: 'PUT', body: buildPlan() });
      Alert.alert('Saved', 'The gym-wide workout plan was updated.');
    } catch (e) { Alert.alert('Could not save', e.message); } finally { setSaving(false); }
  }

  async function sendToAll() {
    Alert.alert('Send to all members?', 'Sends this plan on WhatsApp to every active member who is not currently on a PT package.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
        setSending(true);
        try {
          await api('/api/admin/default-workout-plan', { method: 'PUT', body: buildPlan() });
          const res = await api('/api/admin/default-workout-plan/whatsapp', { method: 'POST' });
          const count = res.results?.length || 0;
          if (!res.waConfigured && count > 0) {
            Alert.alert('Links ready', `${count} WhatsApp links were generated. Since auto-send isn't configured, open each one from a computer to actually send.`);
          } else {
            Alert.alert('Sent', `Sent to ${count} member${count === 1 ? '' : 's'}.`);
          }
        } catch (e) { Alert.alert('Could not send', e.message); } finally { setSending(false); }
      }},
    ]);
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;
  if (!plan) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
      <Text style={styles.title}>Default Workout Plan</Text>
      <Text style={styles.hint}>Every member without a PT package sees this plan. PT clients keep getting their own trainer's plan instead.</Text>

      <SectionTitle>Plan Name</SectionTitle>
      <TextInput style={styles.input} value={planName} onChangeText={setPlanName} placeholder="e.g. Gym Standard Plan" placeholderTextColor={colors.outline} />

      <SectionTitle>Days</SectionTitle>
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
          placeholder={'Squats | Legs | Barbell | 3x10\nTreadmill | | | 20 min'}
          placeholderTextColor={colors.outline}
        />
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <Button label={saving ? '' : 'Save'} variant="tonal" onPress={save} disabled={saving}
            icon={saving ? <ActivityIndicator color={colors.onPrimaryContainer} /> : <Ionicons name="save" size={16} color={colors.onPrimaryContainer} />} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={sending ? '' : 'Save & Send to All'} onPress={sendToAll} disabled={sending}
            icon={sending ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="logo-whatsapp" size={16} color={colors.onPrimary} />} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  hint: { color: colors.onSurfaceVar, fontSize: 12, marginTop: 6, marginBottom: 4 },
  label: { color: colors.onSurfaceVar, fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top', fontFamily: 'Menlo' },
});
