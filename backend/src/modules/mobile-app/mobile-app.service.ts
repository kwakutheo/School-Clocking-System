import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { androidAppManifest } from './mobile-app.manifest';

@Injectable()
export class MobileAppService {
  constructor(private readonly config: ConfigService) {}

  getLatestAndroidVersion() {
    const required =
      this.config.get<string>('APP_ANDROID_UPDATE_REQUIRED') === 'true' ||
      androidAppManifest.required;
    const releaseNotes = this.getReleaseNotes(
      this.config.get<string>('APP_ANDROID_RELEASE_NOTES') ??
        androidAppManifest.releaseNotes,
    );

    // APK URLs come from the manifest (set by CI to GitHub Releases URLs).
    // APP_ANDROID_APK_URL is an optional env var override for the universal APK.
    const universalApkUrl =
      this.config.get<string>('APP_ANDROID_APK_URL') ??
      androidAppManifest.downloads.universal.apkUrl;

    const downloads = {
      arm64: { ...androidAppManifest.downloads.arm64 },
      arm32: { ...androidAppManifest.downloads.arm32 },
      universal: {
        ...androidAppManifest.downloads.universal,
        apkUrl: universalApkUrl,
      },
    };

    return {
      ...androidAppManifest,
      versionName: androidAppManifest.versionName,
      versionCode: this.getLegacyComparableVersionCode(
        androidAppManifest.versionCode,
      ),
      apkUrl: universalApkUrl,
      apkFileName: downloads.universal.apkFileName,
      required,
      releaseNotes,
      downloads,
    };
  }

  private getLegacyComparableVersionCode(versionCode: number) {
    return versionCode > 0 && versionCode < 1000
      ? versionCode + 2000
      : versionCode;
  }

  private getReleaseNotes(value: string) {
    if (!value || value === 'text shown in the app update prompt') {
      return 'A new version of TK Clocking System is ready. Update now to get the latest fixes and improvements.';
    }

    return value;
  }
}
