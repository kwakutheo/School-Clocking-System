import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { androidAppManifest } from './mobile-app.manifest';

@Injectable()
export class MobileAppService {
  constructor(private readonly config: ConfigService) {}

  getLatestAndroidVersion() {
    const baseUrl = this.config
      .get<string>('APP_DOWNLOAD_BASE_URL', 'https://tkclocking.online')
      .replace(/\/$/, '');
    const required =
      this.config.get<string>('APP_ANDROID_UPDATE_REQUIRED') === 'true' ||
      androidAppManifest.required;
    const releaseNotes =
      this.config.get<string>('APP_ANDROID_RELEASE_NOTES') ??
      androidAppManifest.releaseNotes;
    const downloads = {
      arm64: {
        ...androidAppManifest.downloads.arm64,
        apkUrl: `${baseUrl}/apps/school-clocking-arm64.apk`,
      },
      arm32: {
        ...androidAppManifest.downloads.arm32,
        apkUrl: `${baseUrl}/apps/school-clocking-arm32.apk`,
      },
      universal: {
        ...androidAppManifest.downloads.universal,
        apkUrl:
          this.config.get<string>('APP_ANDROID_APK_URL') ??
          `${baseUrl}/apps/school-clocking-universal.apk`,
      },
    };

    return {
      ...androidAppManifest,
      versionName: androidAppManifest.versionName,
      versionCode: androidAppManifest.versionCode,
      apkUrl: downloads.universal.apkUrl,
      apkFileName: downloads.universal.apkFileName,
      required,
      releaseNotes,
      downloads,
    };
  }
}
