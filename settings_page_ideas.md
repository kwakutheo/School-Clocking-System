# Mobile App Settings Page Proposals

This document outlines the proposed features for the new Settings page in the TK Clocking mobile application.

## 1. App Theme Configuration
* **Options:** Light Mode, Dark Mode, or System Default.
* **Details:** Currently, `StorageService` has `saveTheme` and `getTheme` placeholders, but they are not hooked up to change the app’s `ThemeMode` dynamically. We can implement a simple theme controller or Bloc to handle this.

## 2. Biometric Authentication Settings
* **Options:** Toggle "Biometric Login" on or off.
* **Details:** We can check if the device supports biometrics (`BiometricService`) and let users toggle it. Turning it on will register their secure credentials via `StorageService.saveSecureIdentifier`/`saveSecurePassword`. Turning it off will clear those secure credentials.

## 3. Offline Sync & Database Status
* **Options:** View unsynced records + Manual Sync button.
* **Details:** Since the app is offline-first (uses Hive), we can display how many offline attendance logs are pending synchronization and offer a "Sync Now" button to force a manual sync.

## 4. Device & System Info
* **Details:** 
  * Show the registered **Device ID** (useful for administrators troubleshooting clocking issues).
  * Show the current active **School Portal URL**.
  * Show the current **App Version** (e.g., `1.0.1+24`) with a manual "Check for Updates" button that triggers `AppUpdateService`.

## 5. Notification Toggles
* **Options:** Toggle clocking reminders or push notifications.

## 6. GPS & Location Diagnostics
* **What it is:** A troubleshooting section for location issues.
* **Why it's useful:** Sometimes staff struggle to clock in because their phone's GPS accuracy is poor or they are standing slightly outside the geofence. We can add a "Test Location" button that shows their current GPS accuracy (e.g., "Good", "Poor") and their current distance from the school's geofence in meters.

## 7. Device Time Integrity (Tamper Check)
* **What it is:** A status indicator showing if the device's clock is properly synced.
* **Why it's useful:** The app already tracks time offsets (`lastKnownTimeOffsetKey`) to prevent employees from changing their phone's time to clock in late. We can show a simple "Device Time: Valid" or "Device Time: Out of Sync" indicator to help them fix their phone settings if they are blocked from clocking.

## 8. App Reset & Cache Clearing
* **What it is:** An option to wipe local data.
* **Why it's useful:** If the app gets into a weird state, a "Clear App Cache" or "Reset App" button gives users a safe way to wipe their offline databases, clear their cached biometric tokens, and return the app to a fresh installed state without needing to uninstall it.

---

## Integration Plan
We can create a new folder `lib/features/settings` with a clean `SettingsPage`. It can be added as the **6th option** in the `_showMoreMenu` on the Dashboard (inside `lib/features/dashboard/presentation/pages/home_page.dart`), alongside Profile and Calendar.
