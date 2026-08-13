package com.fitcore.gym.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fitcore.gym.data.*
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private val meals = listOf(
    "breakfast" to (Icons.Rounded.Egg     to "Breakfast"),
    "lunch"     to (Icons.Rounded.LunchDining to "Lunch"),
    "snack"     to (Icons.Rounded.Cookie  to "Snack"),
    "dinner"    to (Icons.Rounded.DinnerDining to "Dinner"),
)

@Composable
fun FoodScreen(day: FoodDay?, onLog: (FoodLogRequest) -> Unit, onDelete: (Int) -> Unit) {
    var showAdd by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
            Text("Food Log", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.SemiBold)
            Text(day?.date ?: "Today", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)

            Spacer(Modifier.height(16.dp))

            // Big calorie ring / bar
            MacroSummary(day)

            Spacer(Modifier.height(18.dp))

            meals.forEach { (key, meta) ->
                val (icon, label) = meta
                val entries = day?.entries?.filter { it.mealType == key }.orEmpty()
                MealSection(label, icon, entries, onDelete)
                Spacer(Modifier.height(10.dp))
            }

            Spacer(Modifier.height(80.dp))
        }
        ExtendedFloatingActionButton(
            onClick = { showAdd = true },
            icon = { Icon(Icons.Rounded.Add, null) },
            text = { Text("Log meal") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }

    if (showAdd) {
        AddFoodSheet(
            onDismiss = { showAdd = false },
            onSave = {
                onLog(it)
                showAdd = false
            },
        )
    }
}

@Composable
private fun MacroSummary(day: FoodDay?) {
    val total = day?.total ?: FoodTotals()
    val target = day?.target
    val calPct = if (target != null && target.calories > 0)
        (total.calories.toDouble() / target.calories).coerceAtMost(1.5f.toDouble()) else 0.0

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text("${total.calories}", fontSize = 40.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text(" kcal", fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 6.dp))
                Spacer(Modifier.weight(1f))
                target?.let {
                    Column(horizontalAlignment = Alignment.End) {
                        Text("of ${it.calories} kcal", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("${(calPct * 100).roundToInt()}%", fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            if (target != null) {
                Spacer(Modifier.height(10.dp))
                LinearProgressIndicator(
                    progress = { calPct.toFloat().coerceAtMost(1f) },
                    modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                    color = if (calPct > 1.1) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                )
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MacroChip("Protein", total.protein.roundToInt(), target?.protein?.roundToInt(), Modifier.weight(1f))
                MacroChip("Carbs",   total.carbs.roundToInt(),   target?.carbs?.roundToInt(),   Modifier.weight(1f))
                MacroChip("Fats",    total.fats.roundToInt(),    target?.fats?.roundToInt(),    Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun MacroChip(label: String, grams: Int, target: Int?, modifier: Modifier = Modifier) {
    val pct = if (target != null && target > 0) grams.toDouble() / target else null
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(10.dp),
    ) {
        Text(label.uppercase(), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Row(verticalAlignment = Alignment.Bottom) {
            Text("${grams}", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text("g", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 2.dp))
            Spacer(Modifier.weight(1f))
            target?.let { Text("/${it}g", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        pct?.let {
            Spacer(Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { it.toFloat().coerceAtMost(1f) },
                modifier = Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)),
                color = MaterialTheme.colorScheme.primary,
                trackColor = Color.White.copy(alpha = 0.08f),
            )
        }
    }
}

@Composable
private fun MealSection(label: String, icon: ImageVector, entries: List<FoodEntry>, onDelete: (Int) -> Unit) {
    val kcal = entries.sumOf { it.calories }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Spacer(Modifier.weight(1f))
                Text("$kcal kcal", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            }
            if (entries.isEmpty()) {
                Text("Nothing logged", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            } else {
                Spacer(Modifier.height(8.dp))
                entries.forEach { e ->
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = MaterialTheme.colorScheme.surface,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    ) {
                        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(e.foodName, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Row(Modifier.padding(top = 3.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Chip("${e.calories} kcal", MaterialTheme.colorScheme.primary)
                                    e.protein?.let { if (it > 0) Chip("${it.roundToInt()}p", Color(0xFFA8C8FF)) }
                                    e.carbs?.let   { if (it > 0) Chip("${it.roundToInt()}c", Color(0xFFA8C8FF)) }
                                    e.fats?.let    { if (it > 0) Chip("${it.roundToInt()}f", Color(0xFFA8C8FF)) }
                                }
                            }
                            IconButton(onClick = { onDelete(e.id) }) {
                                Icon(Icons.Rounded.Close, "Delete", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddFoodSheet(onDismiss: () -> Unit, onSave: (FoodLogRequest) -> Unit) {
    var selectedMeal by remember { mutableStateOf("breakfast") }
    var foodName by remember { mutableStateOf("") }
    var calories by remember { mutableStateOf("") }
    var protein by remember { mutableStateOf("") }
    var carbs by remember { mutableStateOf("") }
    var fats by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState())) {
            Text("Log a meal", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(14.dp))

            // Meal type chips
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                meals.forEach { (key, meta) ->
                    FilterChip(
                        selected = selectedMeal == key,
                        onClick = { selectedMeal = key },
                        label = { Text(meta.second) },
                        leadingIcon = { Icon(meta.first, null, modifier = Modifier.size(16.dp)) },
                    )
                }
            }
            Spacer(Modifier.height(14.dp))

            OutlinedTextField(
                value = foodName, onValueChange = { foodName = it },
                label = { Text("Food") },
                singleLine = true,
                placeholder = { Text("e.g. Grilled chicken with rice") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = calories, onValueChange = { calories = it.filter(Char::isDigit) },
                label = { Text("Calories (kcal)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            Text("Macros — optional", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(protein, { protein = it.filter { c -> c.isDigit() || c == '.' } }, Modifier.weight(1f), label = { Text("Protein (g)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                OutlinedTextField(carbs,   { carbs = it.filter { c -> c.isDigit() || c == '.' } },   Modifier.weight(1f), label = { Text("Carbs (g)") },   singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                OutlinedTextField(fats,    { fats = it.filter { c -> c.isDigit() || c == '.' } },    Modifier.weight(1f), label = { Text("Fats (g)") },    singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
            }
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = notes, onValueChange = { notes = it },
                label = { Text("Notes (optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(20.dp))

            // Quick-add common foods
            Text("Quick add", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            val quicks = listOf(
                Quadruple("2 eggs + toast", 320, 18, 20, 15),
                Quadruple("Protein shake", 180, 26, 6, 3),
                Quadruple("Banana", 105, 1, 27, 0),
                Quadruple("Chicken (100g)", 165, 31, 0, 4),
                Quadruple("Rice (150g cooked)", 195, 4, 42, 0),
                Quadruple("Almonds (30g)", 175, 6, 6, 15),
            )
            FlowRowLite(quicks) { q ->
                AssistChip(
                    onClick = {
                        foodName = q.first; calories = q.a.toString()
                        protein = q.b.toString(); carbs = q.c.toString(); fats = q.d.toString()
                    },
                    label = { Text("${q.first} · ${q.a}", fontSize = 11.sp) },
                )
            }

            Spacer(Modifier.height(20.dp))
            Row {
                TextButton(onClick = onDismiss) { Text("Cancel") }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = {
                        val kcal = calories.toIntOrNull() ?: return@Button
                        if (foodName.isBlank()) return@Button
                        onSave(FoodLogRequest(
                            mealType = selectedMeal,
                            foodName = foodName.trim(),
                            calories = kcal,
                            protein = protein.toDoubleOrNull(),
                            carbs = carbs.toDoubleOrNull(),
                            fats = fats.toDoubleOrNull(),
                            notes = notes.ifBlank { null },
                        ))
                    },
                    enabled = foodName.isNotBlank() && calories.isNotBlank(),
                ) {
                    Icon(Icons.Rounded.Check, null)
                    Spacer(Modifier.width(6.dp))
                    Text("Save meal")
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

// Tiny wrap layout so quick-add chips flow naturally.
@Composable
private fun <T> FlowRowLite(items: List<T>, item: @Composable (T) -> Unit) {
    Column {
        items.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                row.forEach { item(it) }
            }
        }
    }
}

private data class Quadruple(
    val first: String,
    val a: Int, val b: Int, val c: Int, val d: Int,
)
