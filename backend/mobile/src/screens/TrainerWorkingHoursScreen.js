import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button, SectionTitle } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function TrainerWorkingHoursScreen() {
  const [days, setDays] = useState(DOW_LABELS.map((label, dow) => ({ dow, label, startTime: '', endTime: '', isActive: false })));
  const [duration, setDuration] = useState('60');
  const [exceptions, setExceptions] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [exDate, setExDate] = useState(todayISO());
  const [exType, setExType] = useState('block');
  const [exStart, setExStart] = useState('');
  const [exEnd, setExEnd] = useState('');
  const [exReason, setExReason] = useState('');
  const [addingEx, setAddingEx] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [wh, ex] = await Promise.all([api('/api/trainer/working-hours'), api('/api/trainer/schedule-exceptions')]);
      setDuration(String(wh.sessionDurationMinutes || 60));
      const byDow = {};
      wh.hours.forEach(h => { byDow[h.dayOfWeek] = h; });
      setDays(DOW_LABELS.map((label, dow) => ({
        dow, label,
        startTime: byDow[dow]?.startTime || '',
        endTime: byDow[dow]?.endTime || '',
        isActive: byDow[dow]?.isActive || false,
      })));
      setExceptions(ex);
      setError(null);
    } catch (e) { setError(e.message); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateDay(dow, patch) {
    setDays(prev => prev.map(d => d.dow === dow ? { ...d, ...patch } : d));
  }

  async function saveHours() {
    setSaving(true);
    try {
      const hours = days.filter(d => d.startTime && d.endTime).map(d => ({
        dayOfWeek: d.dow, startTime: d.startTime, endTime: d.endTime, isActive: d.isActive,
      }));
      await api('/api/trainer/working-hours', { method: 'PUT', body: { sessionDurationMinutes: parseInt(duration, 10) || 60, hours } });
      Alert.alert('Saved', 'Working hours updated.');
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addException() {
    if (!exDate) return Alert.alert('Missing date', 'Pick a date (YYYY-MM-DD).');
    if (exType === 'add' && (!exStart || !exEnd)) return Alert.alert('Missing time', 'Extra availability needs a start and end time.');
    setAddingEx(true);
    try {
      await api('/api/trainer/schedule-exceptions', {
        method: 'POST',
        body: { date: exDate, type: exType, startTime: exStart || null, endTime: exEnd || null, reason: exReason.trim() || null },
      });
      setExStart(''); setExEnd(''); setExReason('');
      await load();
    } catch (e) {
      Alert.alert('Could not add', e.message);
    } finally {
      setAddingEx(false);
    }
  }

  async function removeException(ex) {
    try { await api(`/api/trainer/schedule-exceptions/${ex.id}`, { method: 'DELETE' }); load(); }
    catch (e) { Alert.alert('Failed', e.message); }
  }

  if (error) return <View style={styles.center}><Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} /></View>;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Working Hours</Text>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.label}>Session Duration (minutes)</Text>
        <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" />

        {days.map(d => (
          <View key={d.dow} style={styles.dayRow}>
            <TouchableOpacity onPress={() => updateDay(d.dow, { isActive: !d.isActive })} style={{ width: 90 }}>
              <Chip label={d.label.slice(0, 3)} tone={d.isActive ? 'primary' : 'default'} />
            </TouchableOpacity>
            <TextInput
              style={[styles.timeInput]} value={d.startTime} onChangeText={t => updateDay(d.dow, { startTime: t })}
              placeholder="09:00" placeholderTextColor={colors.outline}
            />
            <Text style={styles.dash}>–</Text>
            <TextInput
              style={[styles.timeInput]} value={d.endTime} onChangeText={t => updateDay(d.dow, { endTime: t })}
              placeholder="18:00" placeholderTextColor={colors.outline}
            />
          </View>
        ))}

        <Button
          label={saving ? '' : 'Save Working Hours'}
          onPress={saveHours}
          disabled={saving}
          icon={saving ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
          style={{ marginTop: 16 }}
        />
      </Card>

      <SectionTitle>Time Off / Extra Availability</SectionTitle>
      <Card style={{ marginBottom: 14 }}>
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={exDate} onChangeText={setExDate} placeholder={todayISO()} placeholderTextColor={colors.outline} />

        <Text style={styles.label}>Type</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity onPress={() => setExType('block')}><Chip label="Block Time Off" tone={exType === 'block' ? 'error' : 'default'} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setExType('add')}><Chip label="Extra Availability" tone={exType === 'add' ? 'success' : 'default'} /></TouchableOpacity>
        </View>

        {exType === 'add' && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TextInput style={[styles.input, { flex: 1 }]} value={exStart} onChangeText={setExStart} placeholder="Start 09:00" placeholderTextColor={colors.outline} />
            <TextInput style={[styles.input, { flex: 1 }]} value={exEnd} onChangeText={setExEnd} placeholder="End 12:00" placeholderTextColor={colors.outline} />
          </View>
        )}

        <Text style={styles.label}>Reason (optional)</Text>
        <TextInput style={styles.input} value={exReason} onChangeText={setExReason} placeholder="e.g. Leave, festival" placeholderTextColor={colors.outline} />

        <Button
          label={addingEx ? '' : 'Add'}
          onPress={addException}
          disabled={addingEx}
          icon={addingEx ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={16} color={colors.onPrimary} />}
          style={{ marginTop: 12 }}
        />
      </Card>

      {!exceptions ? (
        <ActivityIndicator color={colors.primary} />
      ) : exceptions.length === 0 ? (
        <Empty icon={<Ionicons name="calendar-outline" size={30} color={colors.outline} />} text="No exceptions added." />
      ) : exceptions.map(ex => (
        <Card key={ex.id} style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>{ex.date} · {ex.type === 'block' ? 'Blocked' : 'Extra availability'}</Text>
            <Text style={styles.hint}>{ex.startTime && ex.endTime ? `${ex.startTime}–${ex.endTime}` : 'Whole day'}{ex.reason ? ` · ${ex.reason}` : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => removeException(ex)}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </Card>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  label: { color: colors.onSurfaceVar, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  timeInput: {
    flex: 1, backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 13,
    paddingVertical: 8, paddingHorizontal: 10, textAlign: 'center',
  },
  dash: { color: colors.outline, fontSize: 13 },
  rowLabel: { color: colors.onSurface, fontSize: 13, fontWeight: '700' },
  hint: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 2 },
});
