import 'package:flutter/material.dart';
import 'package:tk_clocking_system/core/services/connectivity_service.dart';

/// An animated top banner that shows the current online/offline status.
///
/// Slides down when offline, slides away when back online — stays out
/// of the way of normal app usage.
class ConnectivityBanner extends StatefulWidget {
  const ConnectivityBanner({
    super.key,
    required this.connectivityService,
    required this.child,
  });

  final ConnectivityService connectivityService;
  final Widget child;

  @override
  State<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends State<ConnectivityBanner> {
  bool _isOnline = true;

  @override
  void initState() {
    super.initState();
    _isOnline = widget.connectivityService.isOnline;

    widget.connectivityService.onConnectivityChanged.listen((isOnline) {
      if (!mounted) return;
      setState(() => _isOnline = isOnline);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _BannerBar(isOnline: _isOnline),
        Expanded(child: widget.child),
      ],
    );
  }
}

class _BannerBar extends StatelessWidget {
  const _BannerBar({required this.isOnline});

  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: double.infinity,
      color: isOnline ? Colors.green.shade600 : Colors.orange.shade800,
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 4,
        bottom: 8,
        left: 16,
        right: 16,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (!isOnline) ...[
            const Icon(
              Icons.wifi_off_rounded,
              color: Colors.white,
              size: 16,
            ),
            const SizedBox(width: 8),
            const Text(
              'No internet connection — working offline',
              style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ] else ...[
            const SizedBox(height: 16), // Maintains the same height
          ],
        ],
      ),
    );
  }
}
