import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:tk_clocking_system/core/errors/exceptions.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/core/services/location_service.dart';
import 'package:tk_clocking_system/features/attendance/domain/usecases/get_attendance_history_usecase.dart';
import 'package:tk_clocking_system/features/attendance/domain/usecases/qr_clock_usecase.dart';
import 'package:tk_clocking_system/features/attendance/domain/usecases/record_attendance_usecase.dart';
import 'package:tk_clocking_system/features/attendance/domain/usecases/sync_pending_attendance_usecase.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_state.dart';

/// Manages attendance recording, history loading, and offline sync.
class AttendanceBloc extends Bloc<AttendanceEvent, AttendanceState> {
  AttendanceBloc({
    required RecordAttendanceUseCase recordAttendance,
    required GetAttendanceHistoryUseCase getHistory,
    required SyncPendingAttendanceUseCase syncPending,
    required QrClockUseCase qrClock,
    required LocationService locationService,
  })  : _record = recordAttendance,
        _history = getHistory,
        _sync = syncPending,
        _qrClock = qrClock,
        _location = locationService,
        super(const AttendanceInitial()) {
    on<AttendanceRecordEvent>(_onRecord);
    on<AttendanceLoadHistoryEvent>(_onLoadHistory);
    on<AttendanceSyncEvent>(_onSync);
    on<AttendanceQrRecordEvent>(_onQrRecord);
  }

  final RecordAttendanceUseCase _record;
  final GetAttendanceHistoryUseCase _history;
  final SyncPendingAttendanceUseCase _sync;
  final QrClockUseCase _qrClock;
  final LocationService _location;

  // ── Record attendance ─────────────────────────────────────────────────────
  Future<void> _onRecord(
    AttendanceRecordEvent event,
    Emitter<AttendanceState> emit,
  ) async {
    emit(const AttendanceLoading());

    // 1. Acquire GPS position first.
    late double lat;
    late double lng;
    try {
      final position = await _location.getCurrentPosition();
      lat = position.latitude;
      lng = position.longitude;
    } on LocationException catch (e) {
      emit(AttendanceFailure(e.message));
      return;
    } catch (_) {
      emit(const AttendanceFailure(
        'Could not get your location. Please try again.',
      ));
      return;
    }

    // 2. Record the attendance event.
    final result = await _record(
      employeeId: event.employeeId,
      type: event.type,
      latitude: lat,
      longitude: lng,
      branchId: event.branchId,
      deviceId: event.deviceId,
      forceEarlyOut: event.forceEarlyOut,
    );

    result.fold(
      (failure) {
        if (failure is EarlyClockOutFailure) {
          emit(AttendanceEarlyClockOutWarning(
            message: failure.message,
            remainingMinutes: failure.remainingMinutes,
            pendingEmployeeId: event.employeeId,
            pendingType: event.type,
            pendingBranchId: event.branchId,
            pendingDeviceId: event.deviceId,
            pendingLat: lat,
            pendingLng: lng,
          ));
        } else {
          emit(AttendanceFailure(_mapFailure(failure)));
        }
      },
      (record) => emit(AttendanceRecorded(record)),
    );
  }

  // ── Load history ──────────────────────────────────────────────────────────
  Future<void> _onLoadHistory(
    AttendanceLoadHistoryEvent event,
    Emitter<AttendanceState> emit,
  ) async {
    emit(const AttendanceLoading());

    final result = await _history(
      employeeId: event.employeeId,
      page: event.page,
    );

    result.fold(
      (failure) => emit(AttendanceFailure(_mapFailure(failure))),
      (records) => emit(AttendanceHistoryLoaded(records)),
    );
  }

  // ── Sync ──────────────────────────────────────────────────────────────────
  Future<void> _onSync(
    AttendanceSyncEvent event,
    Emitter<AttendanceState> emit,
  ) async {
    final result = await _sync();
    result.fold(
      (failure) => emit(AttendanceSyncFailure(_mapFailure(failure))),
      (count) => emit(AttendanceSynced(count)),
    );
  }

  Future<void> _onQrRecord(
    AttendanceQrRecordEvent event,
    Emitter<AttendanceState> emit,
  ) async {
    emit(const AttendanceLoading());

    // 1. Acquire GPS position first.
    late double lat;
    late double lng;
    try {
      final position = await _location.getCurrentPosition();
      lat = position.latitude;
      lng = position.longitude;
    } on LocationException catch (e) {
      emit(AttendanceFailure(e.message));
      return;
    } catch (_) {
      emit(const AttendanceFailure(
        'Could not get your location. Please try again.',
      ));
      return;
    }

    try {
      final result = await _qrClock(
        qrCode: event.qrCode,
        type: event.type,
        latitude: lat,
        longitude: lng,
        forceEarlyOut: event.forceEarlyOut,
      );

      result.fold(
        (failure) {
          if (failure is EarlyClockOutFailure) {
            emit(AttendanceEarlyClockOutWarning(
              message: failure.message,
              remainingMinutes: failure.remainingMinutes,
              pendingEmployeeId: '', // Resolved server-side
              pendingType: event.type,
              pendingLat: lat,
              pendingLng: lng,
              pendingQrCode: event.qrCode,
            ));
          } else {
            emit(AttendanceFailure(_mapFailure(failure)));
          }
        },
        (record) => emit(AttendanceRecorded(record)),
      );
    } catch (e) {
      emit(AttendanceFailure('QR clock failed: ${e.toString()}'));
    }
  }

  String _mapFailure(Failure failure) => failure.message;
}
