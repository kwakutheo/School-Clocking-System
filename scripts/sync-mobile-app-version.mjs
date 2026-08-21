import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const pubspecPath = path.join(rootDir, 'pubspec.yaml');
const dashboardManifestPath = path.join(
  rootDir,
  'dashboard/public/apps/app-version.json',
);
const backendManifestPath = path.join(
  rootDir,
  'backend/src/modules/mobile-app/mobile-app.manifest.ts',
);

const apkFiles = {
  arm64: 'dashboard/public/apps/school-clocking-arm64.apk',
  arm32: 'dashboard/public/apps/school-clocking-arm32.apk',
  universal: 'dashboard/public/apps/school-clocking-universal.apk',
};

function readPubspecVersion() {
  const pubspec = fs.readFileSync(pubspecPath, 'utf8');
  const match = pubspec.match(/^version:\s*([^\s#]+)/m);
  if (!match) {
    throw new Error('pubspec.yaml does not contain a version line.');
  }

  const [versionName, versionCodeRaw] = match[1].split('+');
  const versionCode = Number(versionCodeRaw);
  if (!versionName || !Number.isInteger(versionCode) || versionCode <= 0) {
    throw new Error(
      `Invalid Flutter version "${match[1]}". Use a value like 1.0.1+6.`,
    );
  }

  return { versionLine: match[1], versionName, versionCode };
}

function readExistingManifest() {
  try {
    return JSON.parse(fs.readFileSync(dashboardManifestPath, 'utf8'));
  } catch {
    return {};
  }
}

function envBoolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value === 'true';
}

function envString(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function fileSize(fileName, fallback = 0) {
  const fullPath = path.join(rootDir, fileName);
  if (!fs.existsSync(fullPath)) return fallback;
  return fs.statSync(fullPath).size;
}

function escapeTs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildDownloadBlock(downloads) {
  return Object.entries(downloads)
    .map(
      ([key, download]) =>
        `    ${key}: {\n` +
        `      label: '${escapeTs(download.label)}',\n` +
        `      abi: '${escapeTs(download.abi)}',\n` +
        `      apkUrl: '${escapeTs(download.apkUrl)}',\n` +
        `      apkFileName: '${escapeTs(download.apkFileName)}',\n` +
        `      sizeBytes: ${download.sizeBytes},\n` +
        `    },`,
    )
    .join('\n');
}

const { versionLine, versionName, versionCode } = readPubspecVersion();
const existing = readExistingManifest();
const existingDownloads = existing.downloads ?? {};
const baseUrl = envString(
  'APP_DOWNLOAD_BASE_URL',
  'https://tkclocking.online',
).replace(/\/$/, '');
const required = envBoolean('APP_ANDROID_UPDATE_REQUIRED', existing.required ?? false);
const releaseNotes = envString(
  'APP_ANDROID_RELEASE_NOTES',
  existing.releaseNotes ?? 'Bug fixes and improvements.',
);
const updatedAt = envString('APP_ANDROID_UPDATED_AT', new Date().toISOString());

const manifest = {
  platform: 'android',
  versionName,
  versionCode,
  apkUrl: '/apps/school-clocking-universal.apk',
  apkFileName: 'school-clocking-universal.apk',
  required,
  releaseNotes,
  updatedAt,
  downloads: {
    arm64: {
      label: 'Android 64-bit',
      abi: 'arm64-v8a',
      apkUrl: '/apps/school-clocking-arm64.apk',
      apkFileName: 'school-clocking-arm64.apk',
      sizeBytes: fileSize(
        apkFiles.arm64,
        existingDownloads.arm64?.sizeBytes ?? 0,
      ),
    },
    arm32: {
      label: 'Android 32-bit',
      abi: 'armeabi-v7a',
      apkUrl: '/apps/school-clocking-arm32.apk',
      apkFileName: 'school-clocking-arm32.apk',
      sizeBytes: fileSize(
        apkFiles.arm32,
        existingDownloads.arm32?.sizeBytes ?? 0,
      ),
    },
    universal: {
      label: 'Universal Android',
      abi: 'universal',
      apkUrl: '/apps/school-clocking-universal.apk',
      apkFileName: 'school-clocking-universal.apk',
      sizeBytes: fileSize(
        apkFiles.universal,
        existingDownloads.universal?.sizeBytes ?? 0,
      ),
    },
  },
};

fs.mkdirSync(path.dirname(dashboardManifestPath), { recursive: true });
fs.writeFileSync(dashboardManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const backendManifest = {
  ...manifest,
  apkUrl: `${baseUrl}/apps/school-clocking-universal.apk`,
  downloads: Object.fromEntries(
    Object.entries(manifest.downloads).map(([key, download]) => [
      key,
      {
        ...download,
        apkUrl: `${baseUrl}${download.apkUrl}`,
      },
    ]),
  ),
};

fs.writeFileSync(
  backendManifestPath,
  `export const androidAppManifest = {\n` +
    `  platform: 'android',\n` +
    `  versionName: '${escapeTs(backendManifest.versionName)}',\n` +
    `  versionCode: ${backendManifest.versionCode},\n` +
    `  apkUrl: '${escapeTs(backendManifest.apkUrl)}',\n` +
    `  apkFileName: 'school-clocking-universal.apk',\n` +
    `  required: ${backendManifest.required},\n` +
    `  releaseNotes: '${escapeTs(backendManifest.releaseNotes)}',\n` +
    `  updatedAt: '${escapeTs(backendManifest.updatedAt)}',\n` +
    `  downloads: {\n${buildDownloadBlock(backendManifest.downloads)}\n  },\n` +
    `};\n`,
);

console.log(`Synced Android app manifests from pubspec.yaml version ${versionLine}.`);
