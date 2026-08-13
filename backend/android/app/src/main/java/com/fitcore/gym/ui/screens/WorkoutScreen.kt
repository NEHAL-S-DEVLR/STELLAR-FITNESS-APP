package com.fitcore.gym.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fitcore.gym.data.User
import com.fitcore.gym.data.WorkoutDay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun WorkoutScreen(user: User) {
    val plan = user.workoutPlan
    val today = SimpleDateFormat("EEEE", Locale.getDefault()).format(Date())

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp)) {
        if (plan == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No workout plan assigned yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            return
        }
        Text(plan.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text("Assigned by ${plan.assignedBy}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Spacer(Modifier.height(14.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(plan.days) { day: WorkoutDay -> DayCard(day, isToday = day.day == today) }
        }
    }
}

@Composable
private fun DayCard(day: WorkoutDay, isToday: Boolean) {
    val bg = if (isToday) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f) else MaterialTheme.colorScheme.surfaceVariant
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = bg,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(day.day, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                day.focus?.let { Text(it, color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) }
            }
            if (day.items.isEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text("Rest day", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            } else {
                Spacer(Modifier.height(8.dp))
                day.items.forEach {
                    ExerciseRow(it)
                    Spacer(Modifier.height(4.dp))
                }
            }
        }
    }
}
