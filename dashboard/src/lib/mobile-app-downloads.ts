export type ApkDownloadKey = 'arm64' | 'arm32' | 'universal';

export type ApkDownload = {
  label: string;
  abi: string;
  apkUrl: string;
  apkFileName: string;
  sizeBytes: number;
};

export type MobileAppManifest = {
  platform: string;
  versionName: string;
  versionCode: number;
  apkUrl: string;
  apkFileName: string;
  required: boolean;
  releaseNotes: string;
  updatedAt: string;
  downloads: Record<ApkDownloadKey, ApkDownload>;
};

export const fallbackMobileAppManifest: MobileAppManifest = {
  platform: 'android',
  versionName: '1.0.0',
  versionCode: 1,
  apkUrl: '/apps/school-clocking-universal.apk',
  apkFileName: 'school-clocking-universal.apk',
  required: false,
  releaseNotes: 'Initial Android release.',
  updatedAt: '2026-08-19T00:00:00.000Z',
  downloads: {
    arm64: {
      label: 'Android 64-bit',
      abi: 'arm64-v8a',
      apkUrl: '/apps/school-clocking-arm64.apk',
      apkFileName: 'school-clocking-arm64.apk',
      sizeBytes: 0,
    },
    arm32: {
      label: 'Android 32-bit',
      abi: 'armeabi-v7a',
      apkUrl: '/apps/school-clocking-arm32.apk',
      apkFileName: 'school-clocking-arm32.apk',
      sizeBytes: 0,
    },
    universal: {
      label: 'Universal Android',
      abi: 'universal',
      apkUrl: '/apps/school-clocking-universal.apk',
      apkFileName: 'school-clocking-universal.apk',
      sizeBytes: 0,
    },
  },
};

export async function fetchMobileAppManifest(): Promise<MobileAppManifest> {
  try {
    const response = await fetch('/apps/app-version.json', {
      cache: 'no-store',
    });
    if (!response.ok) return fallbackMobileAppManifest;

    const data = (await response.json()) as MobileAppManifest;
    return {
      ...fallbackMobileAppManifest,
      ...data,
      downloads: {
        ...fallbackMobileAppManifest.downloads,
        ...(data.downloads ?? {}),
      },
    };
  } catch {
    return fallbackMobileAppManifest;
  }
}

export function detectPreferredDownload(
  manifest: MobileAppManifest,
  nav: Navigator,
): { key: ApkDownloadKey; download: ApkDownload } {
  const uaData = nav as Navigator & {
    userAgentData?: {
      platform?: string;
      architecture?: string;
      bitness?: string;
    };
  };
  const ua = nav.userAgent.toLowerCase();
  const platform = uaData.userAgentData?.platform?.toLowerCase() ?? '';
  const architecture = uaData.userAgentData?.architecture?.toLowerCase() ?? '';
  const bitness = uaData.userAgentData?.bitness?.toLowerCase() ?? '';
  const isAndroid = ua.includes('android') || platform.includes('android');

  if (isAndroid) {
    if (
      bitness === '64' ||
      architecture.includes('arm64') ||
      architecture.includes('aarch64') ||
      ua.includes('arm64') ||
      ua.includes('aarch64')
    ) {
      return { key: 'arm64', download: manifest.downloads.arm64 };
    }

    if (
      architecture === 'arm' ||
      architecture.includes('armv7') ||
      ua.includes('armeabi-v7a') ||
      ua.includes('armv7')
    ) {
      return { key: 'arm32', download: manifest.downloads.arm32 };
    }
  }

  return { key: 'universal', download: manifest.downloads.universal };
}

export function formatApkSize(sizeBytes: number): string {
  if (!sizeBytes) return 'Size available after next build';
  const sizeMb = sizeBytes / 1024 / 1024;
  return `${sizeMb.toFixed(sizeMb >= 100 ? 0 : 1)} MB`;
}
