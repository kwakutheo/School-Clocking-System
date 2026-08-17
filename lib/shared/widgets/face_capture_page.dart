import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

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
      final XFile photo = await _controller!.takePicture();
      if (mounted) {
        setState(() {
          _capturedPhoto = photo;
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
            Image.file(
              File(_capturedPhoto!.path),
              fit: BoxFit.contain,
            ),
            Positioned(
              bottom: 40,
              left: 20,
              right: 20,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton.icon(
                    onPressed: _retakePhoto,
                    icon: const Icon(Icons.refresh, color: Colors.white),
                    label: const Text(
                      'Retake',
                      style: TextStyle(color: Colors.white, fontSize: 16),
                    ),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      backgroundColor: Colors.black54,
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: _confirmPhoto,
                    icon: const Icon(Icons.check),
                    label: const Text(
                      'Use Photo',
                      style: TextStyle(fontSize: 16),
                    ),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                  ),
                ],
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
          // ── Full Screen Camera Preview ────────────────────────────────────
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
