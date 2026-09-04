Viewed settings_page.dart:1-250
Viewed settings_page.dart:251-500
Viewed settings_page.dart:501-750
Viewed settings_page.dart:751-920
Ran command: `flutter analyze lib/features/settings/presentation/pages/settings_page.dart`
Listed directory features
Listed directory services
Searched for "AuthLogoutEvent"
Viewed profile_page.dart:1210-1250
Edited settings_page.dart

Here are thoughtful, high-value additions you could consider for the **Settings** page, categorized by user benefit:

---

### 1. 📳 Haptics & Feedback (Quick Win)
* **Haptic Feedback on Clock In / Out**:
  * A toggle: *"Vibrate on Clock In & Clock Out"*.
  * When teachers/staff tap to clock in or out, their device gives an immediate tactile vibration or buzz to confirm success without them needing to scrutinize the screen.

---

### 2. 📡 Network & Server Connectivity Test
* **Server Health / Ping Test**:
  * You already have *Device Time Integrity* and *GPS Location Diagnostics*.
  * Adding a **"Server Connection Status"** tile with a *"Test Connection"* button lets teachers immediately distinguish whether the school portal backend is reachable or if their cellular data / Wi-Fi is failing.

---

### 3. 🛡️ System Permissions & Troubleshooting
* **App Permissions Overview**:
  * A tile showing whether **Location** (Precise), **Biometrics**, and **Notifications** are granted in Android system settings.
  * An **"Open System Settings"** button (`openAppSettings()`) so staff who accidentally tapped *"Deny"* on location or camera can jump straight to Android's app permissions screen to fix it without getting lost.
* **Battery Optimization Alert / Guide**:
  * On Android (especially Samsung, Xiaomi, Transsion devices), aggressive battery managers can kill background sync or freeze GPS location acquisition. A short tip or diagnostic tile helps prevent clocking issues.

---

### 4. 👤 Account & Session Card (Top of Settings)
* Currently, the Settings page begins immediately with *Appearance*.
* Adding a compact **Profile Banner** at the very top:
  * Teacher/Staff Name & Staff ID
  * School / Branch Name
  * Current Role (e.g., *Teacher / Staff*)
  * A standard **"Sign Out"** button (separate from the destructive *"Clear App Cache"* option at the bottom).

---

### 5. ℹ️ Help, Support & Compliance
* **Clocking FAQ / Quick Guide**:
  * A short expandable dialog addressing the most common teacher issues:
    * *"What if I'm at school but it says Outside Work Zone?"*
    * *"How does offline clocking work?"*
    * *"What does Device Clock Out of Sync mean?"*
* **Contact School Admin / IT Support**:
  * Quick link to dial or email the school's admin or IT desk for assistance with geofence radius or device resets.
* **Privacy Policy & Location Notice**:
  * Since the app collects precise GPS and biometric status, having a **"Privacy Policy & Data Usage"** dialog is essential for staff transparency and Google Play / store compliance.

---

### 6. 🕒 Preferences
* **Time Display Format**:
  * Toggle between **12-hour (AM/PM)** and **24-hour** clock format for timestamps across the Home and Report pages.

---