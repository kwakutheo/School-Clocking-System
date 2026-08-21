export const androidAppManifest = {
  platform: 'android',
  versionName: '1.0.1',
  versionCode: 6,
  apkUrl: 'https://tkclocking.online/apps/school-clocking-universal.apk',
  apkFileName: 'school-clocking-universal.apk',
  required: true,
  releaseNotes: 'text shown in the app update prompt',
  updatedAt: '2026-08-21T21:40:35.000Z',
  downloads: {
    arm64: {
      label: 'Android 64-bit',
      abi: 'arm64-v8a',
      apkUrl: 'https://tkclocking.online/apps/school-clocking-arm64.apk',
      apkFileName: 'school-clocking-arm64.apk',
      sizeBytes: 31780508,
    },
    arm32: {
      label: 'Android 32-bit',
      abi: 'armeabi-v7a',
      apkUrl: 'https://tkclocking.online/apps/school-clocking-arm32.apk',
      apkFileName: 'school-clocking-arm32.apk',
      sizeBytes: 28010762,
    },
    universal: {
      label: 'Universal Android',
      abi: 'universal',
      apkUrl: 'https://tkclocking.online/apps/school-clocking-universal.apk',
      apkFileName: 'school-clocking-universal.apk',
      sizeBytes: 83211001,
    },
  },
};
