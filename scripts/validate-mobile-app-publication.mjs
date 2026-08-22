import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const rootDir = process.cwd();
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

function fail(message) {
  console.error(`Mobile app publication validation failed: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${path.relative(rootDir, filePath)} is not valid JSON: ${error.message}`);
  }
}

function readBackendManifest() {
  const source = fs.readFileSync(backendManifestPath, 'utf8');
  const versionName = source.match(/versionName:\s*'([^']+)'/)?.[1];
  const versionCode = Number(source.match(/versionCode:\s*(\d+)/)?.[1]);
  if (!versionName || !Number.isInteger(versionCode)) {
    fail('backend mobile-app.manifest.ts does not contain a readable versionName/versionCode.');
  }

  return { versionName, versionCode };
}

function candidateAaptPaths() {
  const names = process.platform === 'win32' ? ['aapt.exe'] : ['aapt'];
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData/Local/Android/Sdk')
      : path.join(os.homedir(), 'Android/Sdk'),
  ].filter(Boolean);

  const candidates = [];
  for (const sdkRoot of sdkRoots) {
    const buildToolsDir = path.join(sdkRoot, 'build-tools');
    if (!fs.existsSync(buildToolsDir)) continue;

    for (const version of fs.readdirSync(buildToolsDir)) {
      for (const name of names) {
        candidates.push(path.join(buildToolsDir, version, name));
      }
    }
  }

  return candidates
    .filter((candidate) => fs.existsSync(candidate))
    .sort()
    .reverse();
}

function getApkVersion(apkPath) {
  const aapt = candidateAaptPaths()[0];
  if (!aapt) {
    fail('Android SDK aapt was not found. Install Android SDK build-tools to validate APK versions.');
  }

  const output = execFileSync(aapt, ['dump', 'badging', apkPath], {
    encoding: 'utf8',
  });
  const match = output.match(/package:.*versionCode='(\d+)'.*versionName='([^']+)'/);
  if (!match) {
    fail(`Could not read APK version from ${path.relative(rootDir, apkPath)}.`);
  }

  return {
    versionCode: Number(match[1]),
    versionName: match[2],
  };
}

function expectedSplitVersionCode(key, versionCode) {
  if (key === 'arm64') return versionCode + 2000;
  if (key === 'arm32') return versionCode + 1000;
  return versionCode;
}

const dashboardManifest = readJson(dashboardManifestPath);
const backendManifest = readBackendManifest();

if (dashboardManifest.versionName !== backendManifest.versionName) {
  fail(
    `dashboard versionName ${dashboardManifest.versionName} does not match backend ${backendManifest.versionName}.`,
  );
}

if (dashboardManifest.versionCode !== backendManifest.versionCode) {
  fail(
    `dashboard versionCode ${dashboardManifest.versionCode} does not match backend ${backendManifest.versionCode}.`,
  );
}

for (const [key, relativePath] of Object.entries(apkFiles)) {
  const apkPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(apkPath)) {
    fail(`${relativePath} does not exist.`);
  }

  const apkVersion = getApkVersion(apkPath);
  const expectedVersionCode = expectedSplitVersionCode(
    key,
    dashboardManifest.versionCode,
  );

  if (apkVersion.versionName !== dashboardManifest.versionName) {
    fail(
      `${relativePath} versionName ${apkVersion.versionName} does not match manifest ${dashboardManifest.versionName}.`,
    );
  }

  if (apkVersion.versionCode !== expectedVersionCode) {
    fail(
      `${relativePath} versionCode ${apkVersion.versionCode} does not match expected ${expectedVersionCode}.`,
    );
  }

  const manifestSize = dashboardManifest.downloads?.[key]?.sizeBytes;
  const actualSize = fs.statSync(apkPath).size;
  if (manifestSize !== actualSize) {
    fail(
      `${relativePath} size ${actualSize} does not match manifest size ${manifestSize}.`,
    );
  }
}

console.log(
  `Mobile app publication metadata matches APK version ${dashboardManifest.versionName}+${dashboardManifest.versionCode}.`,
);
