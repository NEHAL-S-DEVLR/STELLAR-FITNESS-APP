package com.fitcore.gym.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fitcore.gym.data.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
fun HomeScreen(user: User, foodToday: FoodDay?, onCheckIn: () -> Unit) {
    val today = SimpleDateFormat("EEEE", Locale.getDefault()).format(Date())
    val dateFormatted = SimpleDateFormat("EEEE, MMM d", Locale.getDefault()).format(Date())
    val todayISO = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    val checkedIn = user.attendance.contains(todayISO)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        Text("Hey, ${user.name.substringBefore(' ')}", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.SemiBold)
        Text(dateFormatted, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)

        Spacer(Modifier.height(18.dp))

        // Check-in FAB-style button
        FilledTonalButton(
            onClick = onCheckIn,
            enabled = !checkedIn,
            shape = CircleShape,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Icon(if (checkedIn) Icons.Rounded.CheckCircle else Icons.Rounded.FitnessCenter, null)
            Spacer(Modifier.width(8.dp))
            Text(if (checkedIn) "Checked in today ✓" else "Check in for today")
        }

        Spacer(Modifier.height(18.dp))

        // Stat cards row
        val latestWeight = user.weightLog.lastOrNull()?.kg
        val bmi = if (latestWeight != null && user.height != null) latestWeight / ((user.height / 100.0) * (user.height / 100.0)) else null
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard(
                label = "Weight",
                value = latestWeight?.let { "${"%.1f".format(it)} kg" } ?: "—",
                modifier = Modifier.weight(1f),
            )
            StatCard(
                label = "BMI",
                value = bmi?.let { "%.1f".format(it) } ?: "—",
                sub = bmi?.let { bmiCategory(it) },
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard(
                label = "Calories today",
                value = "${foodToday?.total?.calories ?: 0}",
                sub = foodToday?.target?.calories?.let { "of $it kcal" },
                modifier = Modifier.weight(1f),
            )
            StatCard(
                label = "Check-ins (30d)",
                value = "${last30Attendance(user.attendance)}",
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(18.dp))

        // Subscription card
        user.subscription?.let { sub ->
            SubscriptionCard(sub)
            Spacer(Modifier.height(18.dp))
        }

        // Today's workout
        SectionHeader("Today's Workout")
        TodaysWorkoutCard(user.workoutPlan, today)

        Spacer(Modifier.height(18.dp))

        // Today's meals summary (linked to Food tab)
        SectionHeader("Nutrition — Today")
        TodaysNutritionCard(foodToday)

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun StatCard(label: String, value: String, sub: String? = null, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = modifier,
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(label.uppercase(), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(value, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            sub?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp) }
        }
    }
}

@Composable
private fun SubscriptionCard(sub: Subscription) {
    val days = daysUntil(sub.expiryDate)
    val label = when {
        days == null -> "—"
        days < 0     -> "Expired ${abs(days)}d ago"
        days == 0    -> "Expires today"
        days == 1    -> "Expires tomorrow"
        else         -> "$days days left"
    }
    Surface(
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFF7C2E10), Color(0xFF4B1C00)),
                    )
                )
                .padding(18.dp),
        ) {
            Column {
                Text("SUBSCRIPTION", color = Color(0xCCFFDBCA), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
                Text(sub.plan, color = Color(0xFFFFDBCA), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text(label, color = Color(0xFFFFDBCA), fontSize = 24.sp, fontWeight = FontWeight.Bold)
                Text("${sub.startDate} → ${sub.expiryDate}", color = Color(0xB3FFDBCA), fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun TodaysWorkoutCard(plan: WorkoutPlan?, today: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            if (plan == null) {
                EmptyRow(Icons.Rounded.FitnessCenter, "No workout plan assigned yet.")
                return@Column
            }
            val day = plan.days.find { it.day == today }
            if (day == null || day.items.isEmpty()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Rest day", fontWeight = FontWeight.SemiBold)
                }
                Text("Recover well.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            } else {
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text(day.focus ?: "Focus", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                    Text("${day.items.size} exercises", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(8.dp))
                day.items.take(4).forEach { it ->
                    ExerciseRow(it)
                    Spacer(Modifier.height(4.dp))
                }
                if (day.items.size > 4) {
                    Text("+ ${day.items.size - 4} more — see Workout tab", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
fun ExerciseRow(item: WorkoutItem) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(10.dp)) {
            Text(item.exercise, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Row {
                item.muscleGroup?.let { Chip(it, MaterialTheme.colorScheme.primary) }
                item.machine?.let { Spacer(Modifier.width(4.dp)); Chip(it, Color(0xFFA8C8FF)) }
                Spacer(Modifier.weight(1f))
                item.sets?.let { Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
    }
}

@Composable
fun Chip(text: String, tint: Color) {
    Surface(
        shape = RoundedCornerShape(6.dp),
        color = tint.copy(alpha = 0.15f),
    ) {
        Text(
            text,
            color = tint,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun TodaysNutritionCard(day: FoodDay?) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            if (day == null || day.entries.isEmpty()) {
                EmptyRow(Icons.Rounded.Restaurant, "Nothing logged today — tap Food to add a meal.")
                return@Column
            }
            Row {
                MacroBadge("Cal", day.total.calories.toString(), day.target?.calories?.toString(), Modifier.weight(1f))
                MacroBadge("P", "${day.total.protein.roundToInt()}g", day.target?.protein?.roundToInt()?.let { "${it}g" }, Modifier.weight(1f))
                MacroBadge("C", "${day.total.carbs.roundToInt()}g",   day.target?.carbs?.roundToInt()?.let { "${it}g" },   Modifier.weight(1f))
                MacroBadge("F", "${day.total.fats.roundToInt()}g",    day.target?.fats?.roundToInt()?.let { "${it}g" },    Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
            day.target?.calories?.let { target ->
                val pct = if (target > 0) (day.total.calories.toDouble() / target).coerceAtMost(1.5) else 0.0
                LinearProgressIndicator(
                    progress = { pct.toFloat().coerceAtMost(1f) },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                    color = if (pct > 1.1) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                )
                Text("${(pct * 100).roundToInt()}% of daily target", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
            }
            Spacer(Modifier.height(6.dp))
            Text("${day.entries.size} entries logged today", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun MacroBadge(label: String, value: String, target: String?, modifier: Modifier = Modifier) {
    Column(modifier = modifier.padding(2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
        target?.let { Text("/ $it", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp) }
    }
}

@Composable
fun SectionHeader(text: String) {
    Text(
        text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 8.dp),
    )
}

@Composable
fun EmptyRow(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(10.dp))
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
    }
}

private fun last30Attendance(dates: List<String>): Int {
    val cutoff = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -30) }.time
    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    return dates.count { d -> fmt.parse(d)?.let { it >= cutoff } ?: false }
}

fun daysUntil(iso: String?): Int? {
    if (iso == null) return null
    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    val target = fmt.parse(iso) ?: return null
    val cal = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
    val diffMs = target.time - cal.timeInMillis
    return (diffMs / (1000.0 * 60 * 60 * 24)).roundToInt()
}

private fun bmiCategory(v: Double): String = when {
    v < 18.5 -> "Underweight"
    v < 25   -> "Healthy"
    v < 30   -> "Overweight"
    else     -> "Obese"
}
