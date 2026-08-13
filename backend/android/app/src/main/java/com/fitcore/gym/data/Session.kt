package com.fitcore.gym.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.fitcore.gym.BuildConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "fitcore_session")

class Session(private val ctx: Context) {
    private val TOKEN   = stringPreferencesKey("token")
    private val API_URL = stringPreferencesKey("api_url")

    val tokenFlow: Flow<String?> = ctx.dataStore.data.map { it[TOKEN] }
    val baseUrlFlow: Flow<String> = ctx.dataStore.data.map { it[API_URL] ?: BuildConfig.DEFAULT_API_BASE }

    suspend fun setToken(v: String?) = ctx.dataStore.edit { prefs ->
        if (v == null) prefs.remove(TOKEN) else prefs[TOKEN] = v
    }
    suspend fun setBaseUrl(v: String) = ctx.dataStore.edit { it[API_URL] = v.trimEnd('/') }
}
