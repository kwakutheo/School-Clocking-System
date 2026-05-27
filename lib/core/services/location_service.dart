import 'dart:async';

import 'package:geolocator/geolocator.dart';
import 'package:tk_clocking_system/core/errors/exceptions.dart';

/// Handles GPS location acquisition and geofence validation.
class LocationService {
  /// Maximum acceptable accuracy in meters before we retry.
  static const double _maxAcceptableAccuracy = 35.0;

  /// How many position samples to take when accuracy is poor.
  static const int _maxSamples = 3;

  /// Returns the device's current [Position] with the best possible accuracy.
  ///
  /// Uses [LocationAccuracy.best] and takes up to [_maxSamples] readings,
  /// returning the one with the lowest (best) accuracy.
  ///
  /// Throws [LocationException] if permissions are denied, the service
  /// is disabled, or the GPS fix times out.
  Future<Position> getCurrentPosition() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw const LocationException(
          'Location services are disabled. Please turn on your location.');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw const LocationException('Location permission denied.');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw const LocationException(
        'Location permission permanently denied. Enable it in settings.',
      );
    }

    try {
      // Try to get the best possible fix.
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          timeLimit: Duration(seconds: 20),
        ),
      );

      if (position.isMocked) {
        throw const LocationException(
          'Mock location detected. Please disable fake GPS applications and try again.',
        );
      }

      // If accuracy is already excellent, return immediately.
      if (position.accuracy <= _maxAcceptableAccuracy) {
        return position;
      }

      // Accuracy is mediocre — take a few more samples and pick the best.
      return await _sampleBestPosition(position);
    } on TimeoutException {
      // Live fix timed out — try the last known position as a fallback.
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) {
        return lastKnown;
      }
      throw const LocationException(
        'GPS fix timed out. Try moving to an open area with a clear view of the sky.',
      );
    }
  }

  /// Takes up to [_maxSamples] additional readings and returns the most
  /// accurate one.
  Future<Position> _sampleBestPosition(Position first) async {
    Position best = first;

    for (var i = 1; i < _maxSamples; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 800));
      try {
        final sample = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.best,
            timeLimit: Duration(seconds: 10),
          ),
        );
        
        if (sample.isMocked) {
          throw const LocationException(
            'Mock location detected. Please disable fake GPS applications and try again.',
          );
        }

        if (sample.accuracy < best.accuracy) {
          best = sample;
        }
        if (best.accuracy <= _maxAcceptableAccuracy) break;
      } on TimeoutException {
        // Skip this sample and continue with what we have.
        continue;
      }
    }

    return best;
  }

  /// Returns a user-friendly description of the GPS accuracy.
  static String accuracyLabel(double accuracyMeters) {
    if (accuracyMeters <= 10) return 'Excellent';
    if (accuracyMeters <= 30) return 'Good';
    if (accuracyMeters <= 100) return 'Fair';
    return 'Poor — move to an open area';
  }

  /// Returns the distance in **meters** between the device and a branch.
  double distanceToMeters({
    required double deviceLat,
    required double deviceLng,
    required double branchLat,
    required double branchLng,
  }) =>
      Geolocator.distanceBetween(deviceLat, deviceLng, branchLat, branchLng);

  /// Returns `true` when the device is within [radiusMeters] of the branch.
  bool isWithinGeofence({
    required double deviceLat,
    required double deviceLng,
    required double branchLat,
    required double branchLng,
    required int radiusMeters,
  }) {
    final distance = distanceToMeters(
      deviceLat: deviceLat,
      deviceLng: deviceLng,
      branchLat: branchLat,
      branchLng: branchLng,
    );
    return distance <= radiusMeters;
  }
}
