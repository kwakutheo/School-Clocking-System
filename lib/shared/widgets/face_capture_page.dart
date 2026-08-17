import 'dart:io';
import 'dart:typed_data';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

class FaceCapturePage extends StatefulWidget {
  const FaceCapturePage({super.key});

  @override
  State<FaceCapturePage> createState() => _FaceCapturePageState();
}

class _FaceCapturePageState extends State<FaceCapturePage> {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  int _selectedCameraIndex = 0;
  bool _isInitializing = true;
  bool _isCapturing = false;
  XFile? _capturedPhoto;
  FlashMode _flashMode = FlashMode.off;

  @override
  void initState() {
    super.initState();
    _initCameras();
  }

  Future<void> _initCameras() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        setState(() => _isInitializing = false);
        return;
      }

      // Try to find the front-facing camera first
      _selectedCameraIndex = _cameras.indexWhere(
          (c) => c.lensDirection == CameraLensDirection.front);
      
      // If no front camera is found, default to the first available (usually back)
      if (_selectedCameraIndex == -1) {
        _selectedCameraIndex = 0;
      }

      await _initCameraController(_cameras[_selectedCameraIndex]);
    } catch (e) {
      debugPrint('Error initializing cameras: $e');
      setState(() => _isInitializing = false);
    }
  }

  Future<void> _initCameraController(CameraDescription camera) async {
    // 1. Dispose old controller first to release hardware lock
    if (_controller != null) {
      await _controller!.dispose();
    }
    
    // 2. Create and initialize new controller
    final newController = CameraController(
      camera,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );

    try {
      await newController.initialize();
      // Safely apply flash mode (some lenses don't support flash)
      try {
        await newController.setFlashMode(_flashMode);
      } catch (_) {}
    } catch (e) {
      debugPrint('Error initializing camera controller: $e');
    }

    if (mounted) {
      setState(() {
        _controller = newController;
        _isInitializing = false;
      });
    }
  }

  Future<void> _toggleCamera() async {
    if (_cameras.length < 2 || _isCapturing) return;

    final currentDirection = _cameras[_selectedCameraIndex].lensDirection;
    final nextIndex = _cameras.indexWhere((c) => c.lensDirection != currentDirection);
    
    if (nextIndex == -1) return;

    setState(() {
      _isInitializing = true;
      _selectedCameraIndex = nextIndex;
    });

    await _initCameraController(_cameras[_selectedCameraIndex]);
  }

  Future<void> _toggleFlash() async {
    if (_controller == null || !_controller!.value.isInitialized) return;

    final newMode =
        _flashMode == FlashMode.off ? FlashMode.torch : FlashMode.off;

    try {
      await _controller!.setFlashMode(newMode);
      setState(() => _flashMode = newMode);
    } catch (e) {
      debugPrint('Error toggling flash: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Flashlight not supported on this camera.')),
        );
      }
    }
  }

  Future<void> _capturePhoto() async {
    if (_controller == null || !_controller!.value.isInitialized || _isCapturing) {
      return;
    }

    setState(() => _isCapturing = true);

    try {
      // 1. Capture raw photo from sensor (native ratio, e.g. 9:16 or 4:3)
      final XFile rawPhoto = await _controller!.takePicture();

      // 2. Crop the raw bytes to a true 1:1 square (center crop)
      final XFile squarePhoto = await _cropToSquare(rawPhoto);

      if (mounted) {
        setState(() {
          _capturedPhoto = squarePhoto;
          _isCapturing = false;
        });
      }
    } catch (e) {
      debugPrint('Error capturing photo: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to capture photo: $e')),
        );
        setState(() => _isCapturing = false);
      }
    }
  }

  /// Reads the raw captured image, center-crops it to a square at the
  /// pixel level, and returns a new [XFile] pointing to the cropped file.
  Future<XFile> _cropToSquare(XFile rawFile) async {
    final Uint8List bytes = await rawFile.readAsBytes();
    final img.Image? original = img.decodeImage(bytes);
    if (original == null) return rawFile; // fallback: return original

    final int w = original.width;
    final int h = original.height;
    final int size = w < h ? w : h; // shortest side becomes the square edge
    final int x = (w - size) ~/ 2;  // center horizontally
    final int y = (h - size) ~/ 2;  // center vertically

    final img.Image cropped = img.copyCrop(
      original,
      x: x,
      y: y,
      width: size,
      height: size,
    );

    // Save to a temp file
    final Directory tmpDir = await getTemporaryDirectory();
    final String outPath = '${tmpDir.path}/profile_square_${DateTime.now().millisecondsSinceEpoch}.jpg';
    final File outFile = File(outPath);
    await outFile.writeAsBytes(img.encodeJpg(cropped, quality: 90));

    return XFile(outPath);
  }

  void _retakePhoto() {
    setState(() {
      _capturedPhoto = null;
    });
  }

  void _confirmPhoto() {
    if (_capturedPhoto != null) {
      Navigator.pop(context, _capturedPhoto);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isInitializing) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }

    if (_controller == null || !_controller!.value.isInitialized) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          iconTheme: const IconThemeData(color: Colors.white),
        ),
        body: const Center(
          child: Text(
            'No camera available.',
            style: TextStyle(color: Colors.white, fontSize: 18),
          ),
        ),
      );
    }

    if (_capturedPhoto != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          fit: StackFit.expand,
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: 3 / 4,
                child: Image.file(
                  File(_capturedPhoto!.path),
                  fit: BoxFit.cover,
                ),
              ),
            ),
            // Retake Button
            Positioned(
              bottom: 40,
              left: 20,
              child: GestureDetector(
                onTap: _retakePhoto,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: Colors.white24, width: 1),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.refresh, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Retake',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            
            // Use Photo Button
            Positioned(
              bottom: 40,
              right: 20,
              child: GestureDetector(
                onTap: _confirmPhoto,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.blue,
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Use Photo',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Full Screen Camera Preview (no artificial crop) ───────────────
          Center(
            child: CameraPreview(_controller!),
          ),

          // ── Top Bar Controls ──────────────────────────────────────────────
          Positioned(
            top: 40,
            left: 10,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 30),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          
          Positioned(
            top: 40,
            right: 10,
            child: IconButton(
              icon: Icon(
                _flashMode == FlashMode.off
                    ? Icons.flash_off_rounded
                    : Icons.flash_on_rounded,
                color: _flashMode == FlashMode.off ? Colors.white : Colors.amber,
                size: 30,
              ),
              onPressed: _toggleFlash,
            ),
          ),

          // ── Bottom Controls ───────────────────────────────────────────────
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // Empty placeholder to balance the row
                const SizedBox(width: 60),

                // Capture Button
                GestureDetector(
                  onTap: _capturePhoto,
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                    ),
                    child: Center(
                      child: Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _isCapturing ? Colors.grey : Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),

                // Toggle Camera Button
                if (_cameras.length > 1)
                  IconButton(
                    icon: const Icon(
                      Icons.flip_camera_android_rounded,
                      color: Colors.white,
                      size: 36,
                    ),
                    onPressed: _toggleCamera,
                  )
                else
                  const SizedBox(width: 60),
              ],
            ),
          ),
          
          if (_isCapturing)
            const Center(
              child: CircularProgressIndicator(color: Colors.white),
            ),
        ],
      ),
    );
  }
}
