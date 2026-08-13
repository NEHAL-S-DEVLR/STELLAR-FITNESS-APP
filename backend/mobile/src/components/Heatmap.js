import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme';

// GitHub-style contribution heatmap — mirrors the web version's layout
// (weeks as columns, 7 day-of-week rows) so the app and admin dashboard
// show attendance the same way.
export default function Heatmap({ dateStrings, weeks = 20 }) {
  const present = new Set(dateStrings || []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - totalDays + 1 - today.getDay());

  const cols = [];
  for (let w = 0; w < weeks + 1; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(day.getDate() + w * 7 + d);
      if (day > today) { col.push(null); continue; }
      const iso = day.toISOString().slice(0, 10);
      col.push({ iso, present: present.has(iso) });
    }
    cols.push(col);
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {cols.map((col, i) => (
          <View key={i} style={{ gap: 3 }}>
            {col.map((c, j) => (
              <View
                key={j}
                style={[
                  styles.cell,
                  { backgroundColor: c ? (c.present ? colors.primary : colors.surfaceHi) : 'transparent' },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cell: { width: 12, height: 12, borderRadius: 3 },
});
