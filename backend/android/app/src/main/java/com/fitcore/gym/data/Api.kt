package com.fitcore.gym.data

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

interface FitCoreApi {
    @POST("/api/auth/login")   suspend fun login(@Body body: LoginRequest): AuthResponse
    @POST("/api/auth/signup")  suspend fun signup(@Body body: SignupRequest): AuthResponse
    @GET("/api/me")            suspend fun me(): User

    @POST("/api/me/attendance") suspend fun checkIn(@Body body: CheckinReq = CheckinReq()): OkResp

    @GET("/api/me/food")           suspend fun foodDay(@Query("date") date: String? = null): FoodDay
    @POST("/api/me/food")          suspend fun logFood(@Body body: FoodLogRequest): FoodEntry
    @DELETE("/api/me/food/{id}")   suspend fun deleteFood(@Path("id") id: Int): OkResp

    @POST("/api/me/notifications/read-all") suspend fun markAllRead(): OkResp

    @PATCH("/api/me") suspend fun updateMe(@Body body: UpdateMeRequest): User
}

object ApiClient {
    @Volatile private var cachedBaseUrl: String? = null
    @Volatile private var cached: FitCoreApi? = null
    @Volatile private var session: Session? = null

    fun init(session: Session) { this.session = session }

    // Ideally these would be Flow-driven but Retrofit's baseUrl is immutable per client.
    // We rebuild the client if the base URL changes (rare — only on manual settings edit).
    fun get(): FitCoreApi {
        val s = session ?: error("ApiClient.init(session) not called")
        val base = runBlocking { s.baseUrlFlow.first() }
        val existing = cached
        if (existing != null && cachedBaseUrl == base) return existing

        val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor(s))
            .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(base)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

        val api = retrofit.create(FitCoreApi::class.java)
        cached = api
        cachedBaseUrl = base
        return api
    }
}

private class AuthInterceptor(private val session: Session) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): okhttp3.Response {
        val token = runBlocking { session.tokenFlow.first() }
        val req: Request = if (token != null) {
            chain.request().newBuilder().addHeader("Authorization", "Bearer $token").build()
        } else chain.request()
        return chain.proceed(req)
    }
}
