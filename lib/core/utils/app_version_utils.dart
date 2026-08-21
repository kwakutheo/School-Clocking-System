int normalizeAndroidVersionCode(int versionCode) {
  // Flutter split-per-ABI APKs prefix the Flutter build number with an ABI
  // bucket: arm32 = 1000 + build, arm64 = 2000 + build, x64 = 3000 + build.
  if (versionCode > 1000 && versionCode < 4000) {
    final normalized = versionCode % 1000;
    if (normalized > 0) return normalized;
  }

  return versionCode;
}

String formatAppVersionLabel({
  required String versionName,
  required String buildNumber,
}) {
  final parsedBuildNumber = int.tryParse(buildNumber.trim());
  if (parsedBuildNumber == null) {
    return buildNumber.trim().isEmpty
        ? versionName
        : '$versionName+${buildNumber.trim()}';
  }

  return '$versionName+${normalizeAndroidVersionCode(parsedBuildNumber)}';
}
