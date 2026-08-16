import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, StatCard, Chip, Button, ProgressBar, Empty } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: 'egg-fried' },
  { key: 'lunch',     label: 'Lunch',     icon: 'food' },
  { key: 'snack',     label: 'Snack',     icon: 'cookie' },
  { key: 'dinner',    label: 'Dinner',    icon: 'food-turkey' },
];

const QUICK_ADD = [
  { name: '2 eggs + toast',      calories: 320, protein: 18, carbs: 20, fats: 15 },
  { name: 'Protein shake',       calories: 180, protein: 26, carbs: 6,  fats: 3 },
  { name: 'Banana',              calories: 105, protein: 1,  carbs: 27, fats: 0 },
  { name: 'Chicken (100g)',      calories: 165, protein: 31, carbs: 0,  fats: 4 },
  { name: 'Rice (150g cooked)',  calories: 195, protein: 4,  carbs: 42, fats: 0 },
  { name: 'Almonds (30g)',       calories: 175, protein: 6,  carbs: 6,  fats: 15 },
];

export default function FoodScreen({ day, onRefresh }) {
  const [addOpen, setAddOpen] = useState(false);

  const total = day?.total || { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const target = day?.target;
  const calPct = target?.calories ? total.calories / target.calories : 0;

  async function saveMeal(entry) {
    try {
      await api('/api/me/food', { method: 'POST', body: { ...entry, source: 'expo' } });
      setAddOpen(false);
      await onRefresh();
    } catch (e) {
      Alert.alert('Could not save', e.message);
    }
  }

  async function deleteEntry(id) {
    try {
      await api(`/api/me/food/${id}`, { method: 'DELETE' });
      await onRefresh();
    } catch (e) {
      Alert.alert('Delete failed', e.message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <Text style={styles.title}>Food Log</Text>
        <Text style={styles.date}>{day?.date || 'Today'}</Text>

        {/* Big calorie summary */}
        <View style={styles.summary}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.calBig}>{total.calories}</Text>
            <Text style={styles.calUnit}> kcal</Text>
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              {target ? (
                <>
                  <Text style={styles.calTarget}>of {target.calories} kcal</Text>
                  <Text style={styles.calPct}>{Math.round(calPct * 100)}%</Text>
                </>
              ) : (
                <Text style={styles.calTarget}>No target set</Text>
              )}
            </View>
          </View>
          {target && (
            <View style={{ marginTop: 12 }}>
              <ProgressBar value={calPct} tone={calPct > 1.1 ? 'error' : 'primary'} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <MacroCard label="Protein" grams={total.protein} target={target?.protein} />
            <MacroCard label="Carbs"   grams={total.carbs}   target={target?.carbs} />
            <MacroCard label="Fats"    grams={total.fats}    target={target?.fats} />
          </View>
        </View>

        {MEALS.map(m => (
          <MealSection
            key={m.key}
            label={m.label}
            icon={m.icon}
            entries={(day?.entries || []).filter(e => e.meal_type === m.key)}
            onDelete={deleteEntry}
          />
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setAddOpen(true)} activeOpacity={0.8}>
        <Ionicons name="add" size={24} color={colors.onPrimaryContainer} />
        <Text style={styles.fabLabel}>Log meal</Text>
      </TouchableOpacity>

      <AddMealModal
        visible={addOpen}
        onDismiss={() => setAddOpen(false)}
        onSave={saveMeal}
      />
    </View>
  );
}

function MacroCard({ label, grams, target }) {
  const g = Math.round(grams || 0);
  const pct = target ? Math.min(1, g / target) : null;
  return (
    <View style={styles.macroCard}>
      <Text style={styles.macroLabel}>{label.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={styles.macroValue}>{g}</Text>
        <Text style={styles.macroUnit}>g</Text>
        {target ? <Text style={styles.macroTarget}>/{Math.round(target)}g</Text> : null}
      </View>
      {pct != null && (
        <View style={{ marginTop: 4 }}>
          <ProgressBar value={pct} tone="primary" />
        </View>
      )}
    </View>
  );
}

function MealSection({ label, icon, entries, onDelete }) {
  const kcal = entries.reduce((s, e) => s + (e.calories || 0), 0);
  return (
    <View style={styles.meal}>
      <View style={styles.mealHeader}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
        <Text style={styles.mealLabel}>{label}</Text>
        <Text style={styles.mealKcal}>{kcal} kcal</Text>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.mealEmpty}>Nothing logged</Text>
      ) : (
        entries.map(e => (
          <View key={e.id} style={styles.entry}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryName}>{e.food_name}</Text>
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                <Chip label={`${e.calories} kcal`} tone="primary" />
                {e.protein ? <Chip label={`${Math.round(e.protein)}p`} tone="info" /> : null}
                {e.carbs ? <Chip label={`${Math.round(e.carbs)}c`} tone="info" /> : null}
                {e.fats ? <Chip label={`${Math.round(e.fats)}f`} tone="info" /> : null}
              </View>
            </View>
            <TouchableOpacity onPress={() => onDelete(e.id)} style={{ padding: 8 }}>
              <Ionicons name="close" size={18} color={colors.onSurfaceVar} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

function AddMealModal({ visible, onDismiss, onSave }) {
  const [meal, setMeal] = useState('breakfast');
  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [notes, setNotes] = useState('');

  function reset() {
    setMeal('breakfast'); setName(''); setCal(''); setP(''); setC(''); setF(''); setNotes('');
  }
  function useQuick(q) {
    setName(q.name); setCal(String(q.calories));
    setP(String(q.protein)); setC(String(q.carbs)); setF(String(q.fats));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.modalTitle}>Log a meal</Text>

              {/* Meal type filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {MEALS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setMeal(m.key)}
                    style={[styles.mealChip, meal === m.key && styles.mealChipActive]}
                  >
                    <MaterialCommunityIcons name={m.icon} size={14} color={meal === m.key ? colors.onPrimary : colors.onSurfaceVar} />
                    <Text style={[styles.mealChipLabel, meal === m.key && { color: colors.onPrimary }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.field}>FOOD</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Grilled chicken with rice"
                placeholderTextColor={colors.outline}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.field}>CALORIES (KCAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.outline}
                keyboardType="numeric"
                value={cal}
                onChangeText={t => setCal(t.replace(/[^\d]/g, ''))}
              />

              <Text style={styles.field}>MACROS — OPTIONAL</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Protein g" placeholderTextColor={colors.outline} keyboardType="decimal-pad" value={p} onChangeText={t => setP(t.replace(/[^\d.]/g, ''))} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Carbs g"   placeholderTextColor={colors.outline} keyboardType="decimal-pad" value={c} onChangeText={t => setC(t.replace(/[^\d.]/g, ''))} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Fats g"    placeholderTextColor={colors.outline} keyboardType="decimal-pad" value={f} onChangeText={t => setF(t.replace(/[^\d.]/g, ''))} />
              </View>

              <Text style={styles.field}>NOTES</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor={colors.outline}
                value={notes}
                onChangeText={setNotes}
              />

              <Text style={styles.field}>QUICK ADD</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {QUICK_ADD.map((q, i) => (
                  <TouchableOpacity key={i} style={styles.quickChip} onPress={() => useQuick(q)}>
                    <Text style={styles.quickChipLabel}>{q.name} · {q.calories}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <Button label="Cancel" variant="text" onPress={() => { onDismiss(); }} style={{ flex: 1 }} />
                <Button
                  label="Save meal"
                  onPress={() => {
                    const calories = parseInt(cal, 10);
                    if (!name.trim() || !calories) return Alert.alert('Missing info', 'Food and calories are required');
                    onSave({
                      meal_type: meal, food_name: name.trim(), calories,
                      protein: p ? parseFloat(p) : null,
                      carbs:   c ? parseFloat(c) : null,
                      fats:    f ? parseFloat(f) : null,
                      notes:   notes.trim() || null,
                    });
                    reset();
                  }}
                  icon={<Ionicons name="checkmark" size={18} color={colors.onPrimary} />}
                  style={{ flex: 2 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 28, fontWeight: '700' },
  date:  { color: colors.onSurfaceVar, fontSize: 12, marginTop: 2, marginBottom: 14 },

  summary: {
    backgroundColor: colors.surfaceVar, borderRadius: radius.lg, padding: 18,
  },
  calBig:    { color: colors.primary, fontSize: 40, fontWeight: '800' },
  calUnit:   { color: colors.onSurfaceVar, fontSize: 15 },
  calTarget: { color: colors.onSurfaceVar, fontSize: 11 },
  calPct:    { color: colors.onSurface, fontSize: 20, fontWeight: '700' },

  macroCard: {
    flex: 1, padding: 10, borderRadius: radius.sm, backgroundColor: colors.surface,
  },
  macroLabel:  { color: colors.onSurfaceVar, fontSize: 10, fontWeight: '700' },
  macroValue:  { color: colors.onSurface, fontSize: 18, fontWeight: '700' },
  macroUnit:   { color: colors.onSurfaceVar, fontSize: 11 },
  macroTarget: { color: colors.onSurfaceVar, fontSize: 10, marginLeft: 'auto' },

  meal: {
    marginTop: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surfaceVar,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealLabel:  { color: colors.onSurface, fontWeight: '700', fontSize: 14 },
  mealKcal:   { color: colors.onSurfaceVar, fontSize: 12, marginLeft: 'auto' },
  mealEmpty:  { color: colors.onSurfaceVar, fontSize: 12, marginTop: 6 },
  entry: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderRadius: radius.sm, backgroundColor: colors.surface, marginTop: 8,
  },
  entryName: { color: colors.onSurface, fontWeight: '600', fontSize: 13 },

  fab: {
    position: 'absolute', bottom: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: radius.md,
    backgroundColor: colors.primaryContainer,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 6,
  },
  fabLabel: { color: colors.onPrimaryContainer, fontWeight: '700', fontSize: 14 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modal: {
    backgroundColor: colors.surfaceHi,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: 20, maxHeight: '90%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.outline,
    alignSelf: 'center', marginBottom: 12,
  },
  modalTitle: { color: colors.onSurface, fontSize: 20, fontWeight: '700', marginBottom: 14 },

  field: { color: colors.onSurfaceVar, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  mealChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outlineVar,
  },
  mealChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  mealChipLabel:  { color: colors.onSurfaceVar, fontWeight: '600', fontSize: 12 },

  quickChip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.full,
    backgroundColor: 'rgba(59,130,246,0.10)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.20)',
  },
  quickChipLabel: { color: colors.primary, fontSize: 11, fontWeight: '600' },
});
