package com.fitcore.gym.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Login
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fitcore.gym.data.ApiClient
import com.fitcore.gym.data.LoginRequest
import com.fitcore.gym.data.Session
import com.fitcore.gym.data.SignupRequest
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(session: Session, onSignedIn: () -> Unit) {
    val scope = rememberCoroutineScope()
    var isSignup by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var showPw by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var showSettings by remember { mutableStateOf(false) }

    val currentBase by session.baseUrlFlow.collectAsState(initial = "…")
    var baseInput by remember { mutableStateOf("") }
    LaunchedEffect(currentBase) { if (baseInput.isEmpty()) baseInput = currentBase }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(40.dp))

        // Logo
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) { Text("FC", fontSize = 26.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onPrimaryContainer) }

        Spacer(Modifier.height(16.dp))
        Text("FitCore Gym", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(
            "Track workouts, food and progress",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(28.dp))

        // Segmented toggle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(4.dp),
        ) {
            SegBtn("Sign in", !isSignup) { isSignup = false; error = null }
            SegBtn("Create account", isSignup) { isSignup = true; error = null }
        }

        Spacer(Modifier.height(20.dp))

        if (isSignup) {
            OutlinedTextField(
                value = name, onValueChange = { name = it },
                label = { Text("Full name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
        }
        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = if (showPw) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { showPw = !showPw }) {
                    Icon(if (showPw) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility, null)
                }
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        error?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, textAlign = TextAlign.Center)
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                error = null; busy = true
                scope.launch {
                    try {
                        val res = if (isSignup)
                            ApiClient.get().signup(SignupRequest(name.trim(), email.trim(), password))
                        else
                            ApiClient.get().login(LoginRequest(email.trim(), password))
                        session.setToken(res.token)
                        onSignedIn()
                    } catch (e: Exception) {
                        error = friendlyError(e)
                    } finally { busy = false }
                }
            },
            enabled = !busy && email.isNotBlank() && password.isNotBlank() && (!isSignup || name.isNotBlank()),
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = CircleShape,
        ) {
            if (busy) CircularProgressIndicator(Modifier.size(22.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
            else {
                Icon(if (isSignup) Icons.Rounded.PersonAdd else Icons.Rounded.Login, null)
                Spacer(Modifier.width(8.dp))
                Text(if (isSignup) "Create account" else "Sign in", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(Modifier.height(20.dp))
        DemoAccountsCard(session = session, onSignedIn = onSignedIn, onError = { error = it })

        Spacer(Modifier.height(16.dp))
        TextButton(onClick = { showSettings = !showSettings }) {
            Text(if (showSettings) "Hide server URL" else "Server: $currentBase")
        }
        if (showSettings) {
            OutlinedTextField(
                value = baseInput, onValueChange = { baseInput = it },
                label = { Text("Backend URL") },
                supportingText = { Text("Emulator: http://10.0.2.2:3000  ·  Physical device: http://<LAN-IP>:3000") },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            Button(onClick = { scope.launch { session.setBaseUrl(baseInput) } }) {
                Text("Save")
            }
        }
        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun RowScope.SegBtn(label: String, active: Boolean, onClick: () -> Unit) {
    val bg = if (active) MaterialTheme.colorScheme.primary else androidx.compose.ui.graphics.Color.Transparent
    val fg = if (active) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
    Box(
        modifier = Modifier
            .weight(1f)
            .clip(CircleShape)
            .background(bg)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
            Text(label, color = fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        }
    }
}

@Composable
private fun DemoAccountsCard(session: Session, onSignedIn: () -> Unit, onError: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val accounts = listOf(
        "Sanjay Khadka"  to "sanjay.khadka@skyboxindia.in",
        "Kavya Reddy"    to "kavya@example.com",
        "Priya Sharma"   to "priya@example.com",
    )
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text("Try a demo account", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Text("Password: demo1234", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            Spacer(Modifier.height(10.dp))
            accounts.forEach { (name, email) ->
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            try {
                                val res = ApiClient.get().login(LoginRequest(email, "demo1234"))
                                session.setToken(res.token)
                                onSignedIn()
                            } catch (e: Exception) { onError(friendlyError(e)) }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(name, fontSize = 13.sp)
                }
                Spacer(Modifier.height(4.dp))
            }
        }
    }
}

fun friendlyError(e: Throwable): String {
    val msg = e.message ?: return "Something went wrong"
    if (msg.contains("Failed to connect") || msg.contains("Connection refused")) return "Can't reach server — check the URL"
    if (msg.contains("401")) return "Incorrect email or password"
    if (msg.contains("409")) return "That email is already in use"
    return msg.take(140)
}
