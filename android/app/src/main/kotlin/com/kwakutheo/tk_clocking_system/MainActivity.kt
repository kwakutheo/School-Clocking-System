package com.kwakutheo.tk_clocking_system

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity: FlutterFragmentActivity() {
    private val UPTIME_CHANNEL = "tk_clocking_system/uptime"
    private val INSTALLER_CHANNEL = "tk_clocking_system/apk_installer"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, UPTIME_CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "getUptime") {
                result.success(SystemClock.elapsedRealtime())
            } else {
                result.notImplemented()
            }
        }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, INSTALLER_CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "canRequestPackageInstalls") {
                result.success(
                    Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                        packageManager.canRequestPackageInstalls()
                )
                return@setMethodCallHandler
            }

            if (call.method == "startApkDownload") {
                val url = call.argument<String>("url")
                val fileName = call.argument<String>("fileName") ?: "tk_clocking.apk"
                if (url.isNullOrBlank()) {
                    result.error("INVALID_APK_URL", "The APK download URL was empty.", null)
                    return@setMethodCallHandler
                }

                try {
                    val download = startApkDownload(url, fileName)
                    result.success(download)
                } catch (e: Exception) {
                    result.error("DOWNLOAD_START_FAILED", e.message, null)
                }
                return@setMethodCallHandler
            }

            if (call.method == "getApkDownloadStatus") {
                val id = call.argument<Number>("id")?.toLong()
                if (id == null) {
                    result.error("INVALID_DOWNLOAD_ID", "The APK download ID was empty.", null)
                    return@setMethodCallHandler
                }

                try {
                    result.success(getApkDownloadStatus(id))
                } catch (e: Exception) {
                    result.error("DOWNLOAD_STATUS_FAILED", e.message, null)
                }
                return@setMethodCallHandler
            }

            if (call.method != "installApk") {
                result.notImplemented()
                return@setMethodCallHandler
            }

            val path = call.argument<String>("path")
            if (path.isNullOrBlank()) {
                result.error("INVALID_APK_PATH", "The APK file path was empty.", null)
                return@setMethodCallHandler
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
                val settingsIntent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:$packageName")
                )
                startActivity(settingsIntent)
                result.error(
                    "INSTALL_PERMISSION_REQUIRED",
                    "Allow TK Clocking System to install unknown apps, then return to continue.",
                    null
                )
                return@setMethodCallHandler
            }

            val apkFile = File(path)
            if (!apkFile.exists()) {
                result.error("APK_NOT_FOUND", "The downloaded APK could not be found.", null)
                return@setMethodCallHandler
            }

            val uri = FileProvider.getUriForFile(
                this,
                "$packageName.fileprovider",
                apkFile
            )
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(installIntent)
            result.success(null)
        }
    }

    private fun startApkDownload(url: String, fileName: String): Map<String, Any> {
        val safeFileName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val downloadsDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: cacheDir
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }

        val apkFile = File(downloadsDir, safeFileName)
        if (apkFile.exists()) {
            apkFile.delete()
        }

        val request = DownloadManager.Request(Uri.parse(url)).apply {
            setTitle("TK Clocking System update")
            setDescription("Downloading app update")
            setMimeType("application/vnd.android.package-archive")
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            setDestinationUri(Uri.fromFile(apkFile))
        }

        val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val id = downloadManager.enqueue(request)
        return mapOf(
            "id" to id,
            "path" to apkFile.absolutePath
        )
    }

    private fun getApkDownloadStatus(id: Long): Map<String, Any?> {
        val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val query = DownloadManager.Query().setFilterById(id)
        val cursor = downloadManager.query(query)
            ?: return mapOf("status" to "failed", "reason" to "Download status was unavailable.")

        cursor.use {
            if (!it.moveToFirst()) {
                return mapOf("status" to "failed", "reason" to "Download was not found.")
            }

            val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val reason = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
            val downloadedBytes = it.getLong(
                it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
            )
            val totalBytes = it.getLong(
                it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
            )
            val localUri = it.getString(it.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))
            val path = localUri?.let { uri -> Uri.parse(uri).path }
            val statusText = when (status) {
                DownloadManager.STATUS_PENDING -> "pending"
                DownloadManager.STATUS_RUNNING -> "running"
                DownloadManager.STATUS_PAUSED -> "paused"
                DownloadManager.STATUS_SUCCESSFUL -> "successful"
                DownloadManager.STATUS_FAILED -> "failed"
                else -> "unknown"
            }

            return mapOf(
                "status" to statusText,
                "reason" to reason,
                "downloadedBytes" to downloadedBytes,
                "totalBytes" to totalBytes,
                "path" to path
            )
        }
    }
}
