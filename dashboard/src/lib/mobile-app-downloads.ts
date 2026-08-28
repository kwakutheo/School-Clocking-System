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

export type FriendlyApkDownloadOption = {
  key: ApkDownloadKey;
  title: string;
  description: string;
  download: ApkDownload;
  isRecommended: boolean;
};

const friendlyDownloadCopy: Record<
  ApkDownloadKey,
  { title: string; description: string }
> = {
  arm64: {
    title: 'Best for newer Android phones',
    description:
      'Use this for most recent and high performing devices especially for devices with arm64-v8a (64-bit) architecture.',
  },
  arm32: {
    title: 'For older Android phones',
    description:
      'Use this for older devices or low-end devices especially devices with armeabi-v7a (32-bit) architecture.',
  },
  universal: {
    title: 'Universal compatibility download',
    description:
      'Largest file, but most likely to work on all devices especially when the other downloads do not install.',
  },
};

export const fallbackMobileAppManifest: MobileAppManifest = {
  platform: 'android',
  versionName: '1.0.1',
  versionCode: 36,
  apkUrl: 'https://github.com/kwakutheo/School-Clocking-System/releases/download/v1.0.1+36/school-clocking-universal.apk',
  apkFileName: 'school-clocking-universal.apk',
  required: false,
  releaseNotes: 'Initial Android release.',
  updatedAt: '2026-08-26T00:00:00.000Z',
  downloads: {
    arm64: {
      label: 'Android 64-bit',
      abi: 'arm64-v8a',
      apkUrl: 'https://github.com/kwakutheo/School-Clocking-System/releases/download/v1.0.1+36/school-clocking-arm64.apk',
      apkFileName: 'school-clocking-arm64.apk',
      sizeBytes: 0,
    },
    arm32: {
      label: 'Android 32-bit',
      abi: 'armeabi-v7a',
      apkUrl: 'https://github.com/kwakutheo/School-Clocking-System/releases/download/v1.0.1+36/school-clocking-arm32.apk',
      apkFileName: 'school-clocking-arm32.apk',
      sizeBytes: 0,
    },
    universal: {
      label: 'Universal Android',
      abi: 'universal',
      apkUrl: 'https://github.com/kwakutheo/School-Clocking-System/releases/download/v1.0.1+36/school-clocking-universal.apk',
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

type UserAgentDataLike = {
  platform?: string;
  architecture?: string;
  bitness?: string;
  getHighEntropyValues?: (
    hints: string[],
  ) => Promise<{
    platform?: string;
    architecture?: string;
    bitness?: string;
  }>;
};

export async function detectPreferredDownload(
  manifest: MobileAppManifest,
  nav: Navigator,
): Promise<{ key: ApkDownloadKey; download: ApkDownload }> {
  const uaData = (nav as Navigator & { userAgentData?: UserAgentDataLike })
    .userAgentData;
  const highEntropy = await uaData
    ?.getHighEntropyValues?.(['platform', 'architecture', 'bitness'])
    .catch(() => undefined);
  const ua = nav.userAgent.toLowerCase();
  const platform = (
    highEntropy?.platform ??
    uaData?.platform ??
    ''
  ).toLowerCase();
  const architecture = (
    highEntropy?.architecture ??
    uaData?.architecture ??
    ''
  ).toLowerCase();
  const bitness = (
    highEntropy?.bitness ??
    uaData?.bitness ??
    ''
  ).toLowerCase();
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

export function getFriendlyDownloadOptions(
  manifest: MobileAppManifest,
  preferredKey: ApkDownloadKey,
): FriendlyApkDownloadOption[] {
  return (['arm64', 'arm32', 'universal'] as const).map((key) => ({
    key,
    ...friendlyDownloadCopy[key],
    download: manifest.downloads[key],
    isRecommended: key === preferredKey,
  }));
}

export function formatApkSize(sizeBytes: number): string {
  if (!sizeBytes) return 'Size available after next build';
  const sizeMb = sizeBytes / 1024 / 1024;
  return `${sizeMb.toFixed(sizeMb >= 100 ? 0 : 1)} MB`;
}
