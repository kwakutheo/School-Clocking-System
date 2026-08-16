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
    final prevController = _controller;
    
    final newController = CameraController(
      camera,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );

    _controller = newController;

    try {
      await newController.initialize();
      await newController.setFlashMode(_flashMode);
    } catch (e) {
      debugPrint('Error initializing camera controller: $e');
    }

    if (mounted) {
      setState(() {
        _isInitializing = false;
      });
    }

    if (prevController != null) {
      await prevController.dispose();
    }
  }

  Future<void> _toggleCamera() async {
    if (_cameras.length < 2 || _isCapturing) return;

    setState(() {
      _isInitializing = true;
      _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;
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
        Navigator.pop(context, photo);
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

    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Camera Preview ────────────────────────────────────────────────
          Center(
            child: AspectRatio(
              aspectRatio: 3 / 4,
              child: CameraPreview(_controller!),
            ),
          ),

          // ── Alignment Overlay Mask ─────────────────────────────────────────
          ColorFiltered(
            colorFilter: ColorFilter.mode(
              Colors.black.withValues(alpha: 0.6),
              BlendMode.srcOut,
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  decoration: const BoxDecoration(
                    color: Colors.black,
                    backgroundBlendMode: BlendMode.dstOut,
                  ),
                ),
                Align(
                  alignment: const Alignment(0, -0.3),
                  child: Container(
                    width: size.width * 0.75,
                    height: size.width * 0.95,
                    decoration: BoxDecoration(
                      color: Colors.white, // This part becomes transparent
                      borderRadius: BorderRadius.circular(size.width),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Guide Outline & Text ───────────────────────────────────────────
          Align(
            alignment: const Alignment(0, -0.3),
            child: Container(
              width: size.width * 0.75,
              height: size.width * 0.95,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white54, width: 2),
                borderRadius: BorderRadius.circular(size.width),
              ),
            ),
          ),
          const Positioned(
            top: 80,
            left: 0,
            right: 0,
            child: Text(
              'Position your face within the frame',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
                shadows: [
                  Shadow(
                    offset: Offset(0, 1),
                    blurRadius: 4,
                    color: Colors.black,
                  ),
                ],
              ),
            ),
          ),

          // ── UI Controls ───────────────────────────────────────────────────
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
