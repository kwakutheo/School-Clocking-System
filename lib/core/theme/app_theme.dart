import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Centralized application theme.
///
/// Defines both light and dark themes using Material 3 with a consistent
/// color palette, typography, and component styles.
abstract final class AppTheme {
  // ── Seed colors ──────────────────────────────────────────────────────────
  static const Color _seedColor = Color(0xFF1565C0); // Deep Blue
  static const Color _accentColor = Color(0xFFFFA000); // Amber

  // ── Light Theme ──────────────────────────────────────────────────────────
  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _seedColor,
          brightness: Brightness.light,
          secondary: _accentColor,
        ),
        textTheme: _textTheme(Brightness.light),
        appBarTheme: _appBarTheme(Brightness.light),
        elevatedButtonTheme: _elevatedButtonTheme(),
        outlinedButtonTheme: _outlinedButtonTheme(),
        inputDecorationTheme: _inputDecorationTheme(Brightness.light),
        cardTheme: _cardTheme(Brightness.light),
        chipTheme: _chipTheme(),
        scaffoldBackgroundColor: const Color(0xFFF5F7FA),
      );

  // ── Dark Theme ───────────────────────────────────────────────────────────
  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _seedColor,
          brightness: Brightness.dark,
          secondary: _accentColor,
        ),
        textTheme: _textTheme(Brightness.dark),
        appBarTheme: _appBarTheme(Brightness.dark),
        elevatedButtonTheme: _elevatedButtonTheme(),
        outlinedButtonTheme: _outlinedButtonTheme(),
        inputDecorationTheme: _inputDecorationTheme(Brightness.dark),
        cardTheme: _cardTheme(Brightness.dark),
        chipTheme: _chipTheme(),
        scaffoldBackgroundColor: const Color(0xFF0D1117),
      );

  // ── Typography ───────────────────────────────────────────────────────────
  static TextTheme _textTheme(Brightness brightness) {
    final Color textColor =
        brightness == Brightness.light ? const Color(0xFF0D1117) : Colors.white;

    return GoogleFonts.interTextTheme(
      TextTheme(
        displayLarge: TextStyle(
          fontSize: 57,
          fontWeight: FontWeight.w700,
          color: textColor,
          letterSpacing: -1.5,
        ),
        displayMedium: TextStyle(
          fontSize: 45,
          fontWeight: FontWeight.w700,
          color: textColor,
        ),
        headlineLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: textColor,
        ),
        headlineMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
        titleLarge: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: textColor,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: textColor,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: textColor,
          height: 1.4,
        ),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
        labelSmall: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: textColor.withValues(alpha: 0.6),
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  // ── AppBar ────────────────────────────────────────────────────────────────
  static AppBarTheme _appBarTheme(Brightness brightness) => AppBarTheme(
        elevation: 0,
        centerTitle: false,
        backgroundColor: brightness == Brightness.light
            ? Colors.white
            : const Color(0xFF161B22),
        foregroundColor: brightness == Brightness.light
            ? const Color(0xFF0D1117)
            : Colors.white,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.black.withValues(alpha: 0.08),
      );

  // ── Elevated Button ───────────────────────────────────────────────────────
  static ElevatedButtonThemeData _elevatedButtonTheme() =>
      ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _seedColor,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 0,
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      );

  // ── Outlined Button ───────────────────────────────────────────────────────
  static OutlinedButtonThemeData _outlinedButtonTheme() =>
      OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: _seedColor,
          minimumSize: const Size(double.infinity, 52),
          side: const BorderSide(color: _seedColor, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      );

  // ── Input Decoration ──────────────────────────────────────────────────────
  static InputDecorationTheme _inputDecorationTheme(Brightness brightness) {
    final Color borderColor = brightness == Brightness.light
        ? const Color(0xFFE0E0E0)
        : const Color(0xFF30363D);
    return InputDecorationTheme(
      filled: true,
      fillColor: brightness == Brightness.light
          ? Colors.white
          : const Color(0xFF21262D),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: borderColor),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: borderColor),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: _seedColor, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.redAccent, width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.redAccent, width: 2),
      ),
      hintStyle: TextStyle(
        color: brightness == Brightness.light
            ? const Color(0xFF9E9E9E)
            : const Color(0xFF6E7681),
        fontSize: 14,
      ),
    );
  }

  // ── Card ──────────────────────────────────────────────────────────────────
  static CardThemeData _cardTheme(Brightness brightness) => CardThemeData(
        elevation: 0,
        color: brightness == Brightness.light
            ? Colors.white
            : const Color(0xFF161B22),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: brightness == Brightness.light
                ? const Color(0xFFE8ECF0)
                : const Color(0xFF30363D),
            width: 1,
          ),
        ),
        margin: EdgeInsets.zero,
      );

  // ── Chip ──────────────────────────────────────────────────────────────────
  static ChipThemeData _chipTheme() => ChipThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        side: BorderSide.none,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      );
}
