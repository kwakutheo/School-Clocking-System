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

// APKs are built to the Flutter output dir. In CI, APK_BUILD_DIR points there.
// Locally (ALLOW_LOCAL_MOBILE_APP_PUBLISH=true), you must build APKs first.
const apkBuildDir = process.env.APK_BUILD_DIR
  ? path.join(rootDir, process.env.APK_BUILD_DIR)
  : path.join(rootDir, 'build/app/outputs/flutter-apk');

const apkFiles = {
  arm64: path.join(apkBuildDir, 'school-clocking-arm64.apk'),
  arm32: path.join(apkBuildDir, 'school-clocking-arm32.apk'),
  universal: path.join(apkBuildDir, 'school-clocking-universal.apk'),
};
const defaultReleaseNotes =
  'A new version of TK Clocking System is ready. Update now to get the latest fixes and improvements.';
const releaseNotesPlaceholder = 'text shown in the app update prompt';
const canPublishManifests =
  process.argv.includes('--publish') ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.ALLOW_LOCAL_MOBILE_APP_PUBLISH === 'true';

if (!canPublishManifests) {
  console.error(
    'Refusing to update public mobile app manifests from a local command.',
  );
  console.error(
    'GitHub Actions updates these files only after the matching APK build succeeds.',
  );
  console.error(
    'If you intentionally built the APKs locally, rerun with ALLOW_LOCAL_MOBILE_APP_PUBLISH=true.',
  );
  process.exit(1);
}

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

function normalizeReleaseNotes(value) {
  if (!value || value === releaseNotesPlaceholder) return defaultReleaseNotes;
  return value;
}

function fileSize(filePath, fallback = 0) {
  if (!fs.existsSync(filePath)) return fallback;
  return fs.statSync(filePath).size;
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
  'APK_BASE_URL',
  'https://github.com/kwakutheo/School-Clocking-System/releases/download',
).replace(/\/$/, '');
const required = envBoolean('APP_ANDROID_UPDATE_REQUIRED', existing.required ?? false);
const releaseNotes = normalizeReleaseNotes(
  envString('APP_ANDROID_RELEASE_NOTES', existing.releaseNotes),
);
const updatedAt = envString(
  'APP_ANDROID_UPDATED_AT',
  existing.updatedAt ?? new Date().toISOString(),
);

const manifest = {
  platform: 'android',
  versionName,
  versionCode,
  apkUrl: `${baseUrl}/v${versionLine}/school-clocking-universal.apk`,
  apkFileName: 'school-clocking-universal.apk',
  required,
  releaseNotes,
  updatedAt,
  downloads: {
    arm64: {
      label: 'Android 64-bit',
      abi: 'arm64-v8a',
      apkUrl: `${baseUrl}/v${versionLine}/school-clocking-arm64.apk`,
      apkFileName: 'school-clocking-arm64.apk',
      sizeBytes: fileSize(
        apkFiles.arm64,
        existingDownloads.arm64?.sizeBytes ?? 0,
      ),
    },
    arm32: {
      label: 'Android 32-bit',
      abi: 'armeabi-v7a',
      apkUrl: `${baseUrl}/v${versionLine}/school-clocking-arm32.apk`,
      apkFileName: 'school-clocking-arm32.apk',
      sizeBytes: fileSize(
        apkFiles.arm32,
        existingDownloads.arm32?.sizeBytes ?? 0,
      ),
    },
    universal: {
      label: 'Universal Android',
      abi: 'universal',
      apkUrl: `${baseUrl}/v${versionLine}/school-clocking-universal.apk`,
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

const backendManifest = manifest;

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
