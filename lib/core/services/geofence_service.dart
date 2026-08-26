import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/services/location_service.dart';
import 'package:tk_clocking_system/features/dashboard/data/models/home_data_model.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';

class GeofenceService extends ChangeNotifier {
  final LocationService _locationService;

  GeofenceService(this._locationService);

  bool _checkingLocation = false;
  bool get checkingLocation => _checkingLocation;

  bool? _isInWorkZone;
  bool? get isInWorkZone => _isInWorkZone;

  String? _locationError;
  String? get locationError => _locationError;

  HomeDataEntity? _data;
  HomeDataEntity? get data => _data;

  void initData() {
    if (_data != null) return;

    final box = Hive.box<Map>(AppConstants.userBox);
    final cached = box.get('home_data_cache');
    if (cached != null) {
      try {
        _data = HomeDataModel.fromJson(deepCastMap(cached));
        checkGeofence();
      } catch (_) {
        // Cache corrupted
      }
    }
  }
  
  void updateData(HomeDataEntity data) {
    _data = data;
    checkGeofence();
  }

  Future<void> checkGeofence({bool silent = false}) async {
    if (_data == null ||
        _data!.branchLat == null ||
        _data!.branchLng == null ||
        _data!.branchRadius == null) {
      return;
    }

    if (!silent) {
      _checkingLocation = true;
      _locationError = null;
      notifyListeners();
    }

    try {
      final position = await _locationService.getCurrentPosition();
      final isInside = _locationService.isWithinGeofence(
        deviceLat: position.latitude,
        deviceLng: position.longitude,
        branchLat: _data!.branchLat!,
        branchLng: _data!.branchLng!,
        radiusMeters: _data!.branchRadius!.toInt(),
      );

      if (!isInside && position.accuracy > 40) {
        _isInWorkZone = null;
        _locationError = 'Poor GPS Signal';
      } else {
        _isInWorkZone = isInside;
        _locationError = null;
      }
      _checkingLocation = false;
      notifyListeners();
    } catch (_) {
      _isInWorkZone = null;
      _locationError = 'GPS Error';
      _checkingLocation = false;
      notifyListeners();
    }
  }
}
