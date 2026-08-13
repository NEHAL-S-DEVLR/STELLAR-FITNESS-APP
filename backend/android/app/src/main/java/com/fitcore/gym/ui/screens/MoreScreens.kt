package com.fitcore.gym.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.fitcore.gym.data.Notification
import com.fitcore.gym.data.Photo
import com.fitcore.gym.data.User

@Composable
fun NotificationsScreen(notifications: List<Notification>) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Notifications", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(14.dp))
        if (notifications.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.NotificationsOff, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(8.dp))
                    Text("No notifications yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            return
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(notifications) { NotificationCard(it) }
        }
    }
}

@Composable
private fun NotificationCard(n: Notification) {
    val icon = when (n.type) { "offer" -> Icons.Rounded.LocalOffer; "expiry" -> Icons.Rounded.Schedule; else -> Icons.Rounded.Campaign }
    val tint = when (n.type) { "offer" -> Color(0xFF7CDBA5); "expiry" -> Color(0xFFFFCC7A); else -> Color(0xFFA8C8FF) }
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = if (!n.read) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.20f) else MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp)) {
            Box(
                modifier = Modifier.size(40.dp).clip(CircleShape).background(tint.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) { Icon(icon, null, tint = tint) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(n.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(n.body, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
                Text(n.sent.take(19).replace('T', ' '), fontSize = 10.sp, color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

@Composable
fun AccountScreen(user: User, onSave: (com.fitcore.gym.data.UpdateMeRequest) -> Unit, onLogout: () -> Unit, saving: Boolean, error: String?) {
    var name by remember(user) { mutableStateOf(user.name) }
    var email by remember(user) { mutableStateOf(user.email) }
    var phone by remember(user) { mutableStateOf(user.phone ?: "") }
    var goal by remember(user) { mutableStateOf(user.goal ?: "") }
    var height by remember(user) { mutableStateOf(user.height?.toInt()?.toString() ?: "") }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Text("Account", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.SemiBold)
        Text("Update your profile — every change is logged in the audit trail.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Spacer(Modifier.height(18.dp))

        // Avatar + role
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(56.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Text(user.name.split(' ').mapNotNull { it.firstOrNull() }.take(2).joinToString(""), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(user.name, fontWeight = FontWeight.SemiBold)
                Text("Member since ${user.joined}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            }
        }
        Spacer(Modifier.height(20.dp))

        OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(phone, { phone = it }, label = { Text("Phone (WhatsApp)") }, singleLine = true, placeholder = { Text("+91 …") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(goal, { goal = it }, label = { Text("Goal") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(height, { height = it.filter(Char::isDigit) }, label = { Text("Height (cm)") }, singleLine = true, modifier = Modifier.fillMaxWidth())

        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                onSave(com.fitcore.gym.data.UpdateMeRequest(
                    name = name.trim(),
                    email = email.trim(),
                    phone = phone.trim(),
                    goal = goal.trim(),
                    height = height.trim().takeIf { it.isNotEmpty() },
                ))
            },
            enabled = !saving,
            modifier = Modifier.fillMaxWidth(),
            shape = CircleShape,
        ) {
            if (saving) CircularProgressIndicator(Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
            else { Icon(Icons.Rounded.Save, null); Spacer(Modifier.width(6.dp)); Text("Save changes") }
        }

        Spacer(Modifier.height(28.dp))
        HorizontalDivider()
        Spacer(Modifier.height(20.dp))

        if (user.photos.isNotEmpty()) {
            Text("Progress Photos", fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(10.dp))
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.heightIn(max = 320.dp),
            ) {
                items(user.photos) { photo -> PhotoRow(photo) }
            }
            Spacer(Modifier.height(20.dp))
        }

        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Rounded.Logout, null); Spacer(Modifier.width(6.dp)); Text("Sign out")
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun PhotoRow(photo: Photo) {
    Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
        Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(
                model = photo.url,
                contentDescription = photo.caption,
                modifier = Modifier.size(80.dp).clip(RoundedCornerShape(10.dp)),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(photo.caption ?: "Progress", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Text(photo.date, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
            }
        }
    }
}

