package com.fitcore.gym.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class SignupRequest(val name: String, val email: String, val password: String)

@Serializable
data class AuthResponse(val user: User, val token: String)

@Serializable
data class User(
    val id: Int,
    val name: String,
    val email: String,
    val role: String,
    val joined: String,
    val height: Double? = null,
    val goal: String? = null,
    val phone: String? = null,
    val subscription: Subscription? = null,
    val workoutPlan: WorkoutPlan? = null,
    val nutritionPlan: NutritionPlan? = null,
    val weightLog: List<WeightEntry> = emptyList(),
    val photos: List<Photo> = emptyList(),
    val attendance: List<String> = emptyList(),
    val notifications: List<Notification> = emptyList(),
)

@Serializable
data class Subscription(val plan: String, val startDate: String, val expiryDate: String)

@Serializable
data class WorkoutPlan(val name: String, val assignedBy: String, val days: List<WorkoutDay>)

@Serializable
data class WorkoutDay(val day: String, val focus: String? = null, val items: List<WorkoutItem> = emptyList())

@Serializable
data class WorkoutItem(
    val muscleGroup: String? = null,
    val exercise: String,
    val machine: String? = null,
    val sets: String? = null,
)

@Serializable
data class NutritionPlan(
    val calories: Int, val protein: Int, val carbs: Int, val fats: Int,
    val meals: List<Meal>,
)

@Serializable
data class Meal(val name: String, val items: String)

@Serializable
data class WeightEntry(val date: String, val kg: Double)

@Serializable
data class Photo(val id: Int, val date: String, val url: String, val caption: String? = null)

@Serializable
data class Notification(
    val id: Int, val type: String, val title: String, val body: String,
    val sent: String, val read: Boolean,
)

@Serializable
data class ErrorBody(val error: String? = null)

// -------- Food log --------
@Serializable
data class FoodEntry(
    val id: Int,
    @SerialName("entry_date") val entryDate: String? = null,
    @SerialName("meal_type") val mealType: String,
    @SerialName("food_name") val foodName: String,
    val calories: Int,
    val protein: Double? = null,
    val carbs: Double? = null,
    val fats: Double? = null,
    val notes: String? = null,
    val source: String? = null,
    @SerialName("logged_at") val loggedAt: String? = null,
)

@Serializable
data class FoodDay(
    val date: String,
    val entries: List<FoodEntry>,
    val total: FoodTotals,
    val target: FoodTotals? = null,
)

@Serializable
data class FoodTotals(
    val calories: Int = 0,
    val protein: Double = 0.0,
    val carbs: Double = 0.0,
    val fats: Double = 0.0,
    val entries: Int = 0,
)

@Serializable
data class FoodLogRequest(
    @SerialName("meal_type") val mealType: String,
    @SerialName("food_name") val foodName: String,
    val calories: Int,
    val protein: Double? = null,
    val carbs: Double? = null,
    val fats: Double? = null,
    val notes: String? = null,
    val source: String = "android",
)

@Serializable
data class OkResp(val ok: Boolean? = null)

@Serializable
data class CheckinReq(val date: String? = null)

@Serializable
data class UpdateMeRequest(
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val goal: String? = null,
    val height: String? = null,
)
