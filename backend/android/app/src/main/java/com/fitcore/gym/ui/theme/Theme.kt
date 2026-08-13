package com.fitcore.gym.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Matches the web M3 dark palette exactly
private val DarkColors = darkColorScheme(
    primary            = Color(0xFFFFB59A),
    onPrimary          = Color(0xFF5B1B00),
    primaryContainer   = Color(0xFF7C2E10),
    onPrimaryContainer = Color(0xFFFFDBCA),
    secondary          = Color(0xFFE7BEAB),
    onSecondary        = Color(0xFF442B1E),
    secondaryContainer = Color(0xFF5D4132),
    onSecondaryContainer = Color(0xFFFFDBCA),
    tertiary           = Color(0xFFB7CCA1),
    onTertiary         = Color(0xFF233419),
    error              = Color(0xFFFFB4AB),
    onError            = Color(0xFF690005),
    background         = Color(0xFF191113),
    onBackground       = Color(0xFFF1DFDD),
    surface            = Color(0xFF191113),
    onSurface          = Color(0xFFF1DFDD),
    surfaceVariant     = Color(0xFF261E1F),
    onSurfaceVariant   = Color(0xFFD8C2BE),
    outline            = Color(0xFFA18C89),
    outlineVariant     = Color(0xFF524341),
)

// Light theme kept minimal — the app targets dark by default
private val LightColors = lightColorScheme(
    primary            = Color(0xFF974311),
    onPrimary          = Color.White,
    primaryContainer   = Color(0xFFFFDBCA),
    onPrimaryContainer = Color(0xFF351000),
)

val Success = Color(0xFF7CDBA5)
val Warning = Color(0xFFFFCC7A)
val Info    = Color(0xFFA8C8FF)

private val AppTypography = Typography(
    displayLarge  = TextStyle(fontSize = 40.sp, fontWeight = FontWeight.SemiBold),
    headlineLarge = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.SemiBold),
    titleLarge    = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.SemiBold),
    titleMedium   = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge     = TextStyle(fontSize = 16.sp),
    bodyMedium    = TextStyle(fontSize = 14.sp),
    labelSmall    = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
)

@Composable
fun FitCoreTheme(
    darkTheme: Boolean = true, // default dark, matches web
    content: @Composable () -> Unit,
) {
    val scheme = if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = scheme,
        typography = AppTypography,
        content = content,
    )
}
