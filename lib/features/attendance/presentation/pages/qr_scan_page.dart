import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

/// QR code scanning screen for clocking in without GPS.
class QrScanPage extends StatefulWidget {
  const QrScanPage({super.key});

  @override
  State<QrScanPage> createState() => _QrScanPageState();
}

class _QrScanPageState extends State<QrScanPage> {
  bool _hasPermission = false;
  bool _checkedPermission = false;
  bool _hasDetected = false;

  @override
  void initState() {
    super.initState();
    _checkCameraPermission();
  }

  Future<void> _checkCameraPermission() async {
    final status = await Permission.camera.status;
    setState(() {
      _hasPermission = status.isGranted;
      _checkedPermission = true;
    });
    if (status.isDenied) {
      final result = await Permission.camera.request();
      setState(() => _hasPermission = result.isGranted);
    }
  }

  bool _isValidBranchQr(String value) {
    // Branch QR codes are 32-character hex strings (MD5 hashes).
    return RegExp(r'^[a-f0-9]{32}$').hasMatch(value);
  }

  void _onDetect(BarcodeCapture capture) {
    if (_hasDetected) return;

    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    final rawValue = barcode.rawValue!;

    if (!_isValidBranchQr(rawValue)) {
      // Show a brief warning and ignore non-branch QR codes.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Invalid QR code. Please scan a branch QR code.'),
          backgroundColor: Colors.deepOrange,
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    _hasDetected = true;
    Navigator.of(context).pop(rawValue);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan QR Code'),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: !_checkedPermission
          ? const Center(child: CircularProgressIndicator())
          : !_hasPermission
              ? _buildPermissionDenied(colorScheme)
              : _buildScanner(colorScheme),
    );
  }

  Widget _buildPermissionDenied(ColorScheme colorScheme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.camera_alt_outlined,
              size: 64,
              color: colorScheme.error,
            ),
            const SizedBox(height: 24),
            Text(
              'Camera permission required',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'Please allow camera access in your device settings to scan QR codes.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: () => openAppSettings(),
              icon: const Icon(Icons.settings_rounded),
              label: const Text('Open Settings'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScanner(ColorScheme colorScheme) {
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(
          onDetect: _onDetect,
        ),
        // Dark overlay with cutout
        CustomPaint(
          size: Size.infinite,
          painter: _ScannerOverlayPainter(
            cutoutSize: MediaQuery.of(context).size.width * 0.7,
          ),
        ),
        // Instructions
        SafeArea(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Point camera at the branch QR code',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Scanner overlay with square cutout ──────────────────────────────────────
class _ScannerOverlayPainter extends CustomPainter {
  _ScannerOverlayPainter({required this.cutoutSize});

  final double cutoutSize;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withValues(alpha: 0.5)
      ..style = PaintingStyle.fill;

    final cutoutRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2.5),
      width: cutoutSize,
      height: cutoutSize,
    );

    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(
        RRect.fromRectAndRadius(
          cutoutRect,
          const Radius.circular(16),
        ),
      )
      ..fillType = PathFillType.evenOdd;

    canvas.drawPath(path, paint);

    // Draw corner markers
    final markerPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4;

    final markerLength = cutoutSize * 0.15;
    final cornerRadius = 16.0;
    final cx = size.width / 2;
    final cy = size.height / 2.5;
    final half = cutoutSize / 2;

    // Top-left
    canvas.drawPath(
      _cornerPath(cx - half, cy - half, markerLength, cornerRadius, true, true),
      markerPaint,
    );
    // Top-right
    canvas.drawPath(
      _cornerPath(
          cx + half, cy - half, markerLength, cornerRadius, false, true),
      markerPaint,
    );
    // Bottom-left
    canvas.drawPath(
      _cornerPath(
          cx - half, cy + half, markerLength, cornerRadius, true, false),
      markerPaint,
    );
    // Bottom-right
    canvas.drawPath(
      _cornerPath(
          cx + half, cy + half, markerLength, cornerRadius, false, false),
      markerPaint,
    );
  }

  Path _cornerPath(
    double x,
    double y,
    double length,
    double radius,
    bool left,
    bool top,
  ) {
    final path = Path();
    final dx = left ? 1 : -1;
    final dy = top ? 1 : -1;

    path.moveTo(x + (left ? 0 : dx * radius), y);
    path.lineTo(x + (left ? length : dx * (length + radius)), y);
    path.moveTo(x, y + (top ? 0 : dy * radius));
    path.lineTo(x, y + (top ? length : dy * (length + radius)));

    return path;
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
