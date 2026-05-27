import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

/// Wraps [Connectivity] and exposes clean online/offline streams.
///
/// Consumed by [App] to trigger background sync and by the
/// [ConnectivityBanner] to show the user their current status.
class ConnectivityService {
  ConnectivityService(this._connectivity) {
    _init();
  }

  final Connectivity _connectivity;

  // ── Internals ─────────────────────────────────────────────────────────────
  final _controller = StreamController<bool>.broadcast();
  bool _isOnline = false;
  late final StreamSubscription<List<ConnectivityResult>> _sub;

  // ── Public API ────────────────────────────────────────────────────────────
  /// Emits `true` when connectivity is gained, `false` when lost.
  Stream<bool> get onConnectivityChanged => _controller.stream;

  /// Current connectivity status (synchronous snapshot).
  bool get isOnline => _isOnline;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  void _init() {
    _sub = _connectivity.onConnectivityChanged.listen(_onResults);
    // Seed with current state.
    _connectivity.checkConnectivity().then(_onResults);
  }

  void _onResults(List<ConnectivityResult> results) {
    final wasOnline = _isOnline;
    _isOnline = results.isNotEmpty && !results.contains(ConnectivityResult.none);

    // Only emit when the status actually changed.
    if (_isOnline != wasOnline) {
      _controller.add(_isOnline);
    }
  }

  /// Must be called when the service is no longer needed.
  Future<void> dispose() async {
    await _sub.cancel();
    await _controller.close();
  }
}
