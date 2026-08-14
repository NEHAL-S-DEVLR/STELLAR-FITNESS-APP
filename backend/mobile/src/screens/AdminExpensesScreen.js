import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, RefreshControl, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Chip, Empty, Button } from '../components/Common';
import { colors, radius, spacing } from '../theme';
import { api } from '../api';

const CATEGORIES = ['Rent', 'Electricity', 'Salary', 'Maintenance', 'Cleaning', 'Marketing', 'Miscellaneous'];
const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function AdminExpensesScreen() {
  const [expenses, setExpenses] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [rows, sum] = await Promise.all([api('/api/admin/expenses'), api('/api/admin/expenses/summary')]);
      setExpenses(rows);
      setSummary(sum);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addExpense() {
    if (!amount) return Alert.alert('Missing amount', 'Enter an amount.');
    setAdding(true);
    try {
      await api('/api/admin/expenses', { method: 'POST', body: { category, amount, description: description.trim() || null } });
      setAmount(''); setDescription('');
      await load();
    } catch (e) { Alert.alert('Could not add expense', e.message); } finally { setAdding(false); }
  }

  async function remove(exp) {
    Alert.alert('Delete expense?', null, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/admin/expenses/${exp.id}`, { method: 'DELETE' }); load(); }
        catch (e) { Alert.alert('Failed', e.message); }
      }},
    ]);
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
      data={expenses || []}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>Expenses</Text>
          {summary && <Text style={styles.summary}>This month: {money(summary.total)}</Text>}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: 10 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} onPress={() => setCategory(c)} activeOpacity={0.7}>
                <Chip label={c} tone={category === c ? 'primary' : 'default'} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.input, { width: 90 }]}
              placeholder="₹ Amount"
              placeholderTextColor={colors.outline}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.outline}
              value={description}
              onChangeText={setDescription}
            />
            <Button
              label=""
              onPress={addExpense}
              disabled={adding}
              icon={adding ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="add" size={20} color={colors.onPrimary} />}
              style={{ paddingHorizontal: 14 }}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        error
          ? <Empty icon={<Ionicons name="alert-circle" size={30} color={colors.error} />} text={error} />
          : <Empty icon={<Ionicons name="receipt-outline" size={30} color={colors.outline} />} text="No expenses recorded yet." />
      }
      renderItem={({ item }) => (
        <Card style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.expCategory}>{item.category}</Text>
            {item.description ? <Text style={styles.sub}>{item.description}</Text> : null}
            <Text style={styles.sub}>{item.expense_date}</Text>
          </View>
          <Text style={styles.expAmount}>{money(item.amount)}</Text>
          <TouchableOpacity onPress={() => remove(item)} style={{ marginLeft: 12 }}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 24, fontWeight: '800' },
  summary: { color: colors.onSurfaceVar, fontSize: 13, marginTop: 4 },
  input: {
    backgroundColor: colors.surfaceHi, borderColor: colors.outlineVar, borderWidth: 1,
    borderRadius: radius.xs, color: colors.onSurface, fontSize: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  expCategory: { color: colors.onSurface, fontSize: 14, fontWeight: '700' },
  sub: { color: colors.onSurfaceVar, fontSize: 11, marginTop: 2 },
  expAmount: { color: colors.onSurface, fontSize: 14, fontWeight: '700', fontFamily: 'Menlo' },
});
