# Mobile App Update Automation

This project now supports automated Android APK publishing and in-app update prompts.

## What Is Included

- GitHub Actions builds split APKs plus a universal fallback when Flutter/Android code changes.
- The generated APKs are copied to:
  - `dashboard/public/apps/school-clocking-arm64.apk`
  - `dashboard/public/apps/school-clocking-arm32.apk`
  - `dashboard/public/apps/school-clocking-universal.apk`
- Version manifests are updated from `pubspec.yaml`.
- The backend exposes `GET /api/v1/mobile-app/latest`.
- The dashboard download pages choose the smallest compatible APK when the browser exposes enough device information.
- The Flutter app checks the backend endpoint on startup, chooses the right APK from the device ABI list, and prompts users when a newer APK is available.

## Required GitHub Secrets

Create a real Android upload keystore once, then store it in GitHub secrets.

```powershell
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks")) | Set-Clipboard
```

Add these repository secrets:

- `ANDROID_KEYSTORE_BASE64`: base64 value copied from the command above.
- `ANDROID_KEYSTORE_PASSWORD`: password used when creating the keystore.
- `ANDROID_KEY_ALIAS`: usually `upload`.
- `ANDROID_KEY_PASSWORD`: key password used when creating the keystore.
- `GOOGLE_SERVICES_JSON_BASE64`: base64 value of `android/app/google-services.json`.

Keep the original `upload-keystore.jks` somewhere private and backed up. If it is lost, future APKs cannot update apps installed with the old key.

Create the Firebase Android secret from the existing local file:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android/app/google-services.json")) | Set-Clipboard
```

## Optional GitHub Variables

- `API_BASE_URL`: defaults to `https://school-clocking-system.onrender.com/api/v1`.
- `APP_DOWNLOAD_BASE_URL`: defaults to `https://tkclocking.online`.
- `APP_ANDROID_UPDATE_REQUIRED`: set to `true` for mandatory updates.
- `APP_ANDROID_RELEASE_NOTES`: text shown in the app update prompt.

## Releasing A New App Version

1. Update `version:` in `pubspec.yaml`, for example `version: 1.0.1+2`.
2. Push to `main` or `master`.
3. GitHub Actions builds the split APKs and commits the generated APK/manifest files.
4. Users see the update prompt the next time they open the Android app.

Android still requires the user to tap **Install** on the system installer screen.
