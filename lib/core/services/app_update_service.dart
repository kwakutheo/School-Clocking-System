import 'package:dio/dio.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/core/network/api_endpoints.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/core/utils/app_version_utils.dart';

class AppUpdateInfo {
  const AppUpdateInfo({
    required this.versionName,
    required this.versionCode,
    required this.download,
    required this.downloads,
    required this.required,
    required this.releaseNotes,
  });

  final String versionName;
  final int versionCode;
  final AppUpdateDownload download;
  final Map<String, AppUpdateDownload> downloads;
  final bool required;
  final String releaseNotes;

  factory AppUpdateInfo.fromJson(
    Map<String, dynamic> json, {
    required AppUpdateDownload selectedDownload,
    required Map<String, AppUpdateDownload> downloads,
  }) {
    final versionCodeRaw = json['versionCode'];

    final parsedVersionCode = versionCodeRaw is int
        ? versionCodeRaw
        : int.tryParse(versionCodeRaw?.toString() ?? '') ?? 0;

    return AppUpdateInfo(
      versionName: json['versionName']?.toString() ?? 'Unknown',
      versionCode: normalizeAndroidVersionCode(parsedVersionCode),
      download: selectedDownload,
      downloads: downloads,
      required: json['required'] == true || json['required'] == 'true',
      releaseNotes: json['releaseNotes']?.toString() ?? '',
    );
  }
}

class AppUpdateDownload {
  const AppUpdateDownload({
    required this.key,
    required this.label,
    required this.abi,
    required this.apkUrl,
    required this.apkFileName,
    required this.sizeBytes,
  });

  final String key;
  final String label;
  final String abi;
  final String apkUrl;
  final String apkFileName;
  final int sizeBytes;

  factory AppUpdateDownload.fromJson(String key, Map<String, dynamic> json) {
    final sizeRaw = json['sizeBytes'];

    return AppUpdateDownload(
      key: key,
      label: json['label']?.toString() ?? 'Android APK',
      abi: json['abi']?.toString() ?? key,
      apkUrl: json['apkUrl']?.toString() ?? '',
      apkFileName: json['apkFileName']?.toString() ?? 'tk_clocking.apk',
      sizeBytes: sizeRaw is int
          ? sizeRaw
          : int.tryParse(sizeRaw?.toString() ?? '') ?? 0,
    );
  }
}

class InstallPermissionRequiredException implements Exception {
  const InstallPermissionRequiredException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AppUpdateService {
  AppUpdateService({
    required ApiClient apiClient,
    required StorageService storage,
  })  : _api = apiClient,
        _storage = storage;

  final ApiClient _api;
  final StorageService _storage;
  static const MethodChannel _installerChannel =
      MethodChannel('tk_clocking_system/apk_installer');

  Future<AppUpdateInfo?> checkForUpdate() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return null;
    }

    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersionCode = normalizeAndroidVersionCode(
        int.tryParse(packageInfo.buildNumber) ?? 0,
      );
      final response = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.latestMobileApp,
      );
      final data = response.data;
      if (data == null) return null;

      final downloads = _parseDownloads(data);
      final selectedDownload = await _selectBestDownload(downloads);
      final latest = AppUpdateInfo.fromJson(
        data,
        selectedDownload: selectedDownload,
        downloads: downloads,
      );
      if (latest.download.apkUrl.isEmpty ||
          latest.versionCode <= currentVersionCode ||
          (!latest.required &&
              _storage.isAppUpdateSnoozed(latest.versionCode))) {
        return null;
      }

      return latest;
    } catch (e) {
      debugPrint('[AppUpdate] Version check skipped: $e');
      return null;
    }
  }

  Future<void> snooze(AppUpdateInfo update) {
    return _storage.snoozeAppUpdate(
      versionCode: update.versionCode,
      until: DateTime.now().add(const Duration(days: 1)),
    );
  }

  Future<void> downloadAndOpenInstaller(
    AppUpdateInfo update, {
    void Function(int received, int total)? onReceiveProgress,
  }) async {
    final dir = await getTemporaryDirectory();
    final safeFileName = update.download.apkFileName.replaceAll(
      RegExp(r'[^A-Za-z0-9._-]'),
      '_',
    );
    final savePath = '${dir.path}/$safeFileName';
    final apkUri = _resolveApkUri(update.download.apkUrl);

    await _api.dio.downloadUri(
      apkUri,
      savePath,
      onReceiveProgress: onReceiveProgress,
      options: Options(responseType: ResponseType.bytes),
    );

    try {
      await _installerChannel.invokeMethod<void>('installApk', {
        'path': savePath,
      });
    } on PlatformException catch (e) {
      if (e.code == 'INSTALL_PERMISSION_REQUIRED') {
        throw InstallPermissionRequiredException(
          e.message ??
              'Allow TK Clocking System to install unknown apps, then try again.',
        );
      }
      rethrow;
    }
  }

  Uri _resolveApkUri(String rawUrl) {
    final parsed = Uri.parse(rawUrl);
    if (parsed.hasScheme) return parsed;

    return Uri.parse(AppConstants.appDownloadBaseUrl).resolve(rawUrl);
  }

  Map<String, AppUpdateDownload> _parseDownloads(Map<String, dynamic> json) {
    final rawDownloads = json['downloads'];
    if (rawDownloads is Map) {
      final parsed = <String, AppUpdateDownload>{};
      for (final entry in rawDownloads.entries) {
        final value = entry.value;
        if (value is Map) {
          parsed[entry.key.toString()] = AppUpdateDownload.fromJson(
            entry.key.toString(),
            Map<String, dynamic>.from(value),
          );
        }
      }
      if (parsed.isNotEmpty) return parsed;
    }

    return {
      'universal': AppUpdateDownload.fromJson('universal', {
        'label': 'Universal Android',
        'abi': 'universal',
        'apkUrl': json['apkUrl'],
        'apkFileName': json['apkFileName'],
        'sizeBytes': json['sizeBytes'],
      }),
    };
  }

  Future<AppUpdateDownload> _selectBestDownload(
    Map<String, AppUpdateDownload> downloads,
  ) async {
    try {
      final androidInfo = await DeviceInfoPlugin().androidInfo;
      final supportedAbis = androidInfo.supportedAbis
          .map((abi) => abi.toLowerCase())
          .toList(growable: false);

      if (supportedAbis.contains('arm64-v8a') &&
          downloads['arm64']?.apkUrl.isNotEmpty == true) {
        return downloads['arm64']!;
      }
      if (supportedAbis.contains('armeabi-v7a') &&
          downloads['arm32']?.apkUrl.isNotEmpty == true) {
        return downloads['arm32']!;
      }
    } catch (e) {
      debugPrint('[AppUpdate] ABI detection failed: $e');
    }

    return downloads['universal'] ?? downloads.values.first;
  }
}
