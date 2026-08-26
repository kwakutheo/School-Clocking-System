import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';

/// Manages the app-wide [ThemeMode] and persists it to [StorageService].
///
/// Default is [ThemeMode.light] — overridden by whatever the user saved.
class ThemeCubit extends Cubit<ThemeMode> {
  ThemeCubit(this._storage) : super(_load(_storage));

  final StorageService _storage;

  static const _light = 'light';
  static const _dark = 'dark';
  static const _system = 'system';

  /// Load the persisted theme; fall back to light.
  static ThemeMode _load(StorageService storage) {
    switch (storage.getTheme()) {
      case _dark:
        return ThemeMode.dark;
      case _system:
        return ThemeMode.system;
      default:
        return ThemeMode.light; // default → light
    }
  }

  Future<void> setTheme(ThemeMode mode) async {
    final String value;
    switch (mode) {
      case ThemeMode.dark:
        value = _dark;
      case ThemeMode.system:
        value = _system;
      default:
        value = _light;
    }
    await _storage.saveTheme(value);
    emit(mode);
  }
}
