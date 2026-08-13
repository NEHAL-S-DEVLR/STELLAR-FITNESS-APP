package com.fitcore.gym

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fitcore.gym.data.*
import com.fitcore.gym.ui.screens.*
import com.fitcore.gym.ui.theme.FitCoreTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val session = Session(applicationContext)
        ApiClient.init(session)

        setContent {
            FitCoreTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    val token by session.tokenFlow.collectAsState(initial = null)
                    var loggedIn by remember { mutableStateOf(false) }

                    LaunchedEffect(token) { loggedIn = token != null }

                    if (loggedIn) {
                        MainShell(session = session, onLogout = { loggedIn = false })
                    } else {
                        LoginScreen(session = session, onSignedIn = { loggedIn = true })
                    }
                }
            }
        }
    }
}

private enum class Tab(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Home("Home", Icons.Rounded.Home),
    Workout("Workout", Icons.Rounded.FitnessCenter),
    Food("Food", Icons.Rounded.Restaurant),
    Notifications("Alerts", Icons.Rounded.Notifications),
    Account("Account", Icons.Rounded.Person),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainShell(session: Session, onLogout: () -> Unit) {
    val scope = rememberCoroutineScope()
    val snackbarHost = remember { SnackbarHostState() }

    var user by remember { mutableStateOf<User?>(null) }
    var foodDay by remember { mutableStateOf<FoodDay?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var current by remember { mutableStateOf(Tab.Home) }
    var accountSaving by remember { mutableStateOf(false) }
    var accountError by remember { mutableStateOf<String?>(null) }

    suspend fun refresh() {
        try {
            loading = true
            user = ApiClient.get().me()
            foodDay = try { ApiClient.get().foodDay() } catch (_: Exception) { null }
            loadError = null
        } catch (e: Exception) {
            loadError = friendlyError(e)
            if ((e.message ?: "").contains("401")) {
                session.setToken(null); onLogout()
            }
        } finally { loading = false }
    }

    LaunchedEffect(Unit) { refresh() }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHost) },
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(androidx.compose.foundation.shape.RoundedCornerShape(9.dp))
                                .background(MaterialTheme.colorScheme.primaryContainer),
                            contentAlignment = Alignment.Center,
                        ) { Text("FC", fontSize = 11.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onPrimaryContainer) }
                        Spacer(Modifier.width(8.dp))
                        Text("FitCore", fontWeight = FontWeight.Bold)
                    }
                },
                actions = {
                    // Bell with unread count
                    val unread = user?.notifications?.count { !it.read } ?: 0
                    BadgedBox(
                        badge = { if (unread > 0) Badge { Text("$unread") } },
                        modifier = Modifier.padding(end = 8.dp),
                    ) {
                        IconButton(onClick = {
                            current = Tab.Notifications
                            if (unread > 0) scope.launch {
                                try { ApiClient.get().markAllRead(); refresh() } catch (_: Exception) {}
                            }
                        }) { Icon(Icons.Rounded.Notifications, "Notifications") }
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Tab.values().forEach { t ->
                    NavigationBarItem(
                        selected = current == t,
                        onClick = { current = t },
                        icon = { Icon(t.icon, t.label) },
                        label = { Text(t.label, fontSize = 11.sp) },
                    )
                }
            }
        },
    ) { pv ->
        Box(Modifier.padding(pv)) {
            when {
                loading && user == null -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
                loadError != null && user == null -> {
                    Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Text("Couldn't reach the server", fontWeight = FontWeight.SemiBold)
                        Text(loadError ?: "", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = { scope.launch { refresh() } }) { Text("Retry") }
                    }
                }
                user != null -> {
                    val u = user!!
                    when (current) {
                        Tab.Home -> HomeScreen(
                            user = u,
                            foodToday = foodDay,
                            onCheckIn = {
                                scope.launch {
                                    try { ApiClient.get().checkIn(); snackbarHost.showSnackbar("Checked in for today"); refresh() }
                                    catch (e: Exception) { snackbarHost.showSnackbar(friendlyError(e)) }
                                }
                            },
                        )
                        Tab.Workout -> WorkoutScreen(u)
                        Tab.Food -> FoodScreen(
                            day = foodDay,
                            onLog = { req ->
                                scope.launch {
                                    try { ApiClient.get().logFood(req); snackbarHost.showSnackbar("Meal logged"); refresh() }
                                    catch (e: Exception) { snackbarHost.showSnackbar(friendlyError(e)) }
                                }
                            },
                            onDelete = { id ->
                                scope.launch {
                                    try { ApiClient.get().deleteFood(id); refresh() } catch (_: Exception) {}
                                }
                            },
                        )
                        Tab.Notifications -> NotificationsScreen(u.notifications)
                        Tab.Account -> AccountScreen(
                            user = u,
                            saving = accountSaving,
                            error = accountError,
                            onSave = { body ->
                                accountError = null; accountSaving = true
                                scope.launch {
                                    try {
                                        ApiClient.get().updateMe(body)
                                        snackbarHost.showSnackbar("Profile updated")
                                        refresh()
                                    } catch (e: Exception) { accountError = friendlyError(e) }
                                    finally { accountSaving = false }
                                }
                            },
                            onLogout = {
                                scope.launch { session.setToken(null); onLogout() }
                            },
                        )
                    }
                }
            }
        }
    }
}
