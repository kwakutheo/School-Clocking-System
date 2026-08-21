# Instruction: Automated, Optimized APK Build and Smart Distribution Flow

We want to automate our Flutter Android APK build pipeline and optimize the APK file sizes using split-architecture builds (split-per-abi), while keeping the distribution process seamless for our users.

## Current Setup
*   **Flutter Mobile App:** Located in the root directory.
*   **Next.js Web Dashboard:** Located in the `/dashboard` directory.
*   **APK Storage:** APKs are served statically from the `dashboard/public/apps/` folder.

---

## Technical Specifications & Tasks:

### Step 1: Update the GitHub Actions Build Pipeline
Locate our GitHub Actions deployment workflow (usually in `.github/workflows/`). Update it so that on a successful code push:
1. It builds the Android APKs using the split command:
   ```bash
   flutter build apk --split-per-abi
   ```
2. It renames and copies the generated APKs from the build output directory to the dashboard's static asset folder:
   * Rename the `arm64-v8a` APK to `school-clocking-arm64.apk`
   * Rename the `armeabi-v7a` APK to `school-clocking-arm32.apk`
   * Keep a fallback universal build (built via `flutter build apk` without split options) named `school-clocking-universal.apk`.
3. It automatically commits and pushes these updated APK files to the GitHub repository so Vercel/Render redeploys the dashboard with the new files.

### Step 2: Make the Dashboard Download Page Smart
Modify the App Download page in the Next.js dashboard (located in `dashboard/src/`):
1. Write a client-side detection script (using `navigator.userAgent` or `navigator.userAgentData`) to identify the visiting user's Android architecture.
2. Update the "Download APK" button behavior:
   * If a modern 64-bit Android device is detected, automatically download the optimized `school-clocking-arm64.apk`.
   * If a 32-bit Android device is detected, automatically download `school-clocking-arm32.apk`.
   * Otherwise, default to the universal APK download.
3. Clearly display the file sizes next to the options so users know they are downloading a lightweight version.

### Step 3: Implement In-App Update Checker
In the Flutter mobile app:
1. Ensure the app checks a backend endpoint on startup to compare its current version (using a package like `package_info_plus`) with the latest release version on the server.
2. If a new update is available, prompt the user with a clean, user-friendly update dialog.
3. If they accept, trigger the download. Point the download URL to the architecture-specific APK matching their device (using `device_info_plus` in Flutter to read their native ABI).
