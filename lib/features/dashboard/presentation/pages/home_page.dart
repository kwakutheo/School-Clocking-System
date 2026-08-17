import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:intl/intl.dart';
import 'package:tk_clocking_system/core/errors/failures.dart';
import 'package:tk_clocking_system/features/calendar/domain/repositories/calendar_repository.dart';
import 'package:tk_clocking_system/core/constants/app_constants.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_state.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_event.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_state.dart';
import 'package:tk_clocking_system/features/dashboard/domain/entities/home_data_entity.dart';
import 'package:tk_clocking_system/features/dashboard/data/models/home_data_model.dart';
import 'package:tk_clocking_system/features/profile/presentation/pages/profile_page.dart';
import 'package:tk_clocking_system/features/attendance/presentation/pages/history_page.dart';
import 'package:tk_clocking_system/features/attendance/presentation/pages/my_report_page.dart';
import 'package:tk_clocking_system/features/leaves/presentation/pages/leaves_page.dart';
import 'package:tk_clocking_system/features/calendar/presentation/pages/calendar_page.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';
import 'package:tk_clocking_system/shared/enums/sync_status.dart';
import 'package:tk_clocking_system/core/services/geofence_service.dart';
import 'package:tk_clocking_system/core/services/notification_service.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/core/utils/offline_state_engine.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => HomePageState();
}

class HomePageState extends State<HomePage> {
  int _selectedIndex = 0;

  void setTab(int index) {
    setState(() => _selectedIndex = index);
  }

  void _showMoreMenu() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              ListTile(
                title: const Text('Profile', textAlign: TextAlign.right),
                trailing: const Icon(Icons.person_rounded),
                onTap: () {
                  Navigator.pop(context);
                  setState(() => _selectedIndex = 3);
                },
              ),
              ListTile(
                title: const Text('Permissions & Leaves',
                    textAlign: TextAlign.right),
                trailing: const Icon(Icons.calendar_month_rounded),
                onTap: () {
                  Navigator.pop(context);
                  setState(() => _selectedIndex = 4);
                },
              ),
              ListTile(
                title: const Text('Calendar', textAlign: TextAlign.right),
                trailing: const Icon(Icons.event_note_rounded),
                onTap: () {
                  Navigator.pop(context);
                  setState(() => _selectedIndex = 5);
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: const [
          _DashboardTab(),
          HistoryPage(),
          MyReportPage(),
          ProfilePage(),
          LeavesPage(),
          CalendarPage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex > 3 ? 3 : _selectedIndex,
        onDestinationSelected: (index) {
          if (index == 3) {
            _showMoreMenu();
          } else {
            setState(() => _selectedIndex = index);
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history_rounded),
            label: 'History',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart_rounded),
            label: 'Report',
          ),
          NavigationDestination(
            icon: Icon(Icons.more_vert_rounded),
            selectedIcon: Icon(Icons.more_vert_rounded),
            label: 'More',
          ),
        ],
      ),
    );
  }
}

DateTime? _shiftStartForToday(String rawTime, DateTime now) {
  final parts = rawTime.split(':');
  if (parts.length < 2) return null;

  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return DateTime.utc(now.year, now.month, now.day, hour, minute);
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────
class _DashboardTab extends StatefulWidget {
  const _DashboardTab();

  @override
  State<_DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<_DashboardTab> {
  HomeDataModel? _serverBaseline;
  HomeDataEntity? _data;
  bool _isLoading = true;
  int _pendingCount = 0;
  Timer? _autoRefreshTimer;
  int _fetchVersion = 0;
  StreamSubscription? _syncSubscription;

  @override
  void initState() {
    super.initState();
    _initData();
    _checkPending();

    // Auto-refresh every 30 s
    _autoRefreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _loadData(silent: true);
    });

    // Listen for real-time silent sync events from Firebase Cloud Messaging
    _syncSubscription = sl<NotificationService>().onSyncEvent.listen((_) {
      if (mounted) {
        debugPrint('Received silent sync event, refreshing dashboard...');
        _loadData(silent: true);
      }
    });

    // Update FCM Token on login
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final token = await sl<NotificationService>().getFcmToken();
      if (token != null && mounted) {
        context.read<AuthBloc>().add(AuthUpdateFcmTokenEvent(token: token));
      }

      // Also listen for token refreshes
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        if (mounted) {
          context
              .read<AuthBloc>()
              .add(AuthUpdateFcmTokenEvent(token: newToken));
        }
      });
    });
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    _syncSubscription?.cancel();
    super.dispose();
  }

  Future<void> _initData() async {
    // 1. Try to load from cache immediately for "Instant-On"
    final box = Hive.box<Map>(AppConstants.userBox);
    final cached = box.get('home_data_cache');
    if (cached != null) {
      try {
        final cachedData =
            HomeDataModel.fromJson(Map<String, dynamic>.from(cached));

        _serverBaseline = cachedData;
        final now = sl<TimeService>().currentGhanaTime;

        // Always pass through the offline engine so that any pending
        // local records created after the cache snapshot are overlaid.
        final effectiveData =
            OfflineStateEngine.recomputeForOfflineDay(cachedData, now);

        setState(() {
          _data = effectiveData;
          _isLoading = false;
        });
        sl<GeofenceService>().initData();
        // Schedule reminders from cache immediately. If the network call
        // succeeds later, scheduleShiftReminders will be called again
        // (it cancels and re-schedules, so this is safe / idempotent).
        sl<NotificationService>().scheduleShiftReminders(effectiveData);
      } catch (e) {
        debugPrint('Cache corrupted: $e');
        // Cache corrupted, just move on to network load
      }
    }

    // 2. Load from network
    await _loadData();
  }

  Future<void> _loadData({bool silent = false}) async {
    _fetchVersion++;
    final currentFetchVersion = _fetchVersion;

    if (!silent && _data == null) {
      setState(() => _isLoading = true);
    }

    try {
      final res = await sl<AttendanceRepository>().getHomeData();

      if (mounted && currentFetchVersion == _fetchVersion) {
        res.fold(
          (f) {
            if (!silent) {
              // Optional: show error snackbar
            }
            if (_serverBaseline != null && f is NetworkFailure) {
              final now = sl<TimeService>().currentGhanaTime;
              setState(() {
                _data = OfflineStateEngine.recomputeForOfflineDay(
                    _serverBaseline!, now);
              });
            }
            setState(() => _isLoading = false);
          },
          (data) {
            setState(() {
              if (data is HomeDataModel) {
                _serverBaseline = data;
              }
              _data = data;
              _isLoading = false;
            });
            sl<GeofenceService>().updateData(data);
            sl<GeofenceService>().checkGeofence(silent: silent);

            // Fetch holidays quietly to ensure offline state engine has them cached
            sl<CalendarRepository>().getHolidays().then((_) {});

            // Re-schedule OS-level local notifications to mirror the banners.
            // This is idempotent — safe to call on every refresh.
            sl<NotificationService>().scheduleShiftReminders(data);

            // Update cache safely
            if (data is HomeDataModel) {
              try {
                final box = Hive.box<Map>(AppConstants.userBox);
                final trustedNow = sl<TimeService>().currentGhanaTime;
                box.put('home_data_cache', data.toJson(now: trustedNow));
              } catch (e) {
                debugPrint('Failed to save cache: $e');
              }
            }
          },
        );
      }
    } catch (e) {
      debugPrint('Error loading home data: $e');
    }
  }

  void _checkPending() {
    final box = Hive.box<Map>(AppConstants.attendanceBox);
    setState(() {
      _pendingCount = box.values
          .where((e) => e['sync_status'] == SyncStatus.pending.value)
          .length;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;

    return BlocListener<AttendanceBloc, AttendanceState>(
      listener: (context, state) {
        if (state is AttendanceRecorded) {
          _checkPending();

          // Optimistically update the UI immediately with the local record
          if (_serverBaseline != null) {
            final now = sl<TimeService>().currentGhanaTime;
            setState(() {
              _data = OfflineStateEngine.recomputeForOfflineDay(
                  _serverBaseline!, now);
            });
          }

          _loadData(silent: true);

          // Cancel shift reminders that are no longer relevant based on
          // what action was just recorded.
          final notifService = sl<NotificationService>();
          final type =
              state.record.type; // AttendanceType from the recorded entity
          if (type == AttendanceType.clockIn) {
            // Clocked in — cancel only the pre-shift / late warnings (IDs 200-203).
            // Do NOT cancel ID 204; _loadData will schedule it correctly with fresh data.
            notifService.cancelPreShiftReminders();
          } else if (type == AttendanceType.clockOut) {
            // Clocked out — cancel the "forgot to clock out" reminder.
            notifService.cancelClockOutReminder();
          }
        } else if (state is AttendanceSynced) {
          _checkPending();
          _loadData(silent: true);
          if (state.count > 0) {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Row(
                  children: [
                    Icon(Icons.check_circle_rounded, color: Colors.green),
                    SizedBox(width: 8),
                    Text('Sync Successful'),
                  ],
                ),
                content: Text(
                    'Successfully synced ${state.count} offline record(s).'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: const Text('OK'),
                  ),
                ],
              ),
            );
          }
        } else if (state is AttendanceSyncFailure) {
          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Row(
                children: [
                  Icon(Icons.error_outline_rounded, color: Colors.red),
                  SizedBox(width: 8),
                  Text('Sync Failed'),
                ],
              ),
              content:
                  Text('Failed to sync offline records:\n\n${state.message}'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Close'),
                ),
              ],
            ),
          );
        }
      },
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.surface,
              theme.colorScheme.primaryContainer.withValues(alpha: 0.1),
              theme.colorScheme.surface,
            ],
          ),
        ),
        child: VisibilityDetector(
          key: const Key('dashboard-tab'),
          onVisibilityChanged: (info) {
            if (info.visibleFraction > 0.5) {
              _loadData(silent: true);
              _checkPending();
              context.read<AuthBloc>().add(const AuthSyncProfileEvent());
            }
          },
          child: SafeArea(
            top: false,
            child: RefreshIndicator(
              edgeOffset: 40,
              onRefresh: () async {
                final authBloc = context.read<AuthBloc>();
                await _loadData(silent: true);
                if (mounted) {
                  authBloc.add(const AuthSyncProfileEvent());
                }
              },
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverAppBar(
                    floating: true,
                    snap: true,
                    elevation: 2,
                    scrolledUnderElevation: 2,
                    toolbarHeight: 80,
                    title: StreamBuilder<DateTime>(
                      stream: sl<TimeService>().trueTimeStream,
                      initialData: sl<TimeService>().currentGhanaTime,
                      builder: (context, snapshot) {
                        final now =
                            snapshot.data ?? sl<TimeService>().currentGhanaTime;
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize
                              .min, // Shrinks to fit content, perfectly centering it
                          children: [
                            Text(
                              [
                                DateFormat('EEE, d MMM').format(now),
                                _greeting(now),
                              ].join(' • Good ').toUpperCase(),
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: colorScheme.primary,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              user?.fullName ?? 'Employee',
                              style: theme.textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: colorScheme.onSurface,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              [
                                if (user?.schoolName != null) user!.schoolName!,
                              ].join(' • ').toUpperCase(),
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: colorScheme.primary,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    actions: [
                      GestureDetector(
                        onTap: () {
                          final homeState =
                              context.findAncestorStateOfType<HomePageState>();
                          homeState?.setTab(3);
                        },
                        child: Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: colorScheme.outlineVariant
                                  .withValues(alpha: 0.5),
                              width: 2,
                            ),
                          ),
                          child: CircleAvatar(
                            radius: 25,
                            backgroundColor: colorScheme.primaryContainer,
                            foregroundImage: user?.photoUrl != null
                                ? NetworkImage(user!.photoUrl!)
                                : const AssetImage(
                                        'assets/images/default_profile_photo.jpg')
                                    as ImageProvider,
                            onForegroundImageError: (_, __) {},
                            child: ClipOval(
                              child: Image.asset(
                                'assets/images/default_profile_photo.jpg',
                                fit: BoxFit.cover,
                                width: 50,
                                height: 50,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                    bottom: PreferredSize(
                      preferredSize:
                          const Size.fromHeight(36), // Increased from 32
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Align(
                          alignment: Alignment.center,
                          child: _buildWorkZoneBadge(),
                        ),
                      ),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.all(10),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        if (_pendingCount > 0) ...[
                          _OfflineWarningBanner(
                            count: _pendingCount,
                            onSync: () {
                              context
                                  .read<AttendanceBloc>()
                                  .add(const AttendanceSyncEvent());
                            },
                          ),
                          const SizedBox(height: 16),
                        ],
                        if (_isLoading && _data == null)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.only(top: 40),
                              child: CircularProgressIndicator(),
                            ),
                          )
                        else if (_data == null)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.only(top: 40),
                              child:
                                  Text('Failed to load data. Pull to retry.'),
                            ),
                          )
                        else
                          StreamBuilder<DateTime>(
                            stream: sl<TimeService>().trueTimeStream,
                            initialData: sl<TimeService>().currentGhanaTime,
                            builder: (context, snapshot) {
                              return _buildHomeContent(
                                  context,
                                  _data!,
                                  snapshot.data ??
                                      sl<TimeService>().currentGhanaTime);
                            },
                          ),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHomeContent(
      BuildContext context, HomeDataEntity data, DateTime now) {
    // ── Local Time Override ──────────────────────────────────────────────────
    // Use the phone's own clock to decide if the shift has started.
    // This removes the dependency on server timing for the Late banner.
    bool isPastStartTime = false;
    LateStatus effectiveLateStatus = data.lateStatus;
    DateTime? shiftStart;
    bool isWithinTwoHours = false;

    if (data.shiftStartTime != null) {
      shiftStart = _shiftStartForToday(data.shiftStartTime!, now);
      if (shiftStart != null) {
        // Compute whether shift start is within the 2-hour pre-shift window.
        final diff = shiftStart.difference(now);
        isWithinTwoHours =
            diff.inSeconds > 0 && diff <= const Duration(hours: 2);

        isPastStartTime = now.isAfter(shiftStart);

        // If the server hasn't caught up yet (still says 'none') but the
        // phone clock says the shift has started, compute it locally.
        // Use `hasClockedInToday` (server-provided) rather than `isClockedIn`.
        // `isClockedIn` reflects the *current* state (last action), so after an
        // early clock-out it would be false even though the user DID clock in.
        if (isPastStartTime &&
            !data.hasClockedInToday &&
            !data.forgotToClockOut &&
            !data.isWeekend &&
            !data.isHoliday &&
            !data.isVacation &&
            effectiveLateStatus == LateStatus.none) {
          final minutesLate = now.difference(shiftStart).inMinutes;
          effectiveLateStatus =
              minutesLate > 120 ? LateStatus.persistentLate : LateStatus.late;
        }
      }
    }

    // Show countdown banner only in the 2-hour pre-shift window
    // and only when the employee hasn't clocked in / it's a working day.
    final showCountdown = data.shiftStartTime != null &&
        isWithinTwoHours &&
        !isPastStartTime &&
        !data.isClockedIn &&
        !data.forgotToClockOut &&
        !data.isWeekend &&
        !data.isHoliday &&
        !data.isVacation &&
        !data.noShiftAssigned &&
        effectiveLateStatus == LateStatus.none;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showCountdown) ...[
          _ShiftCountdownBanner(
            shiftStartTime: data.shiftStartTime!,
            onFinished: () async {
              // Wait 2s for the server clock to catch up before syncing.
              await Future.delayed(const Duration(seconds: 2));
              _loadData(silent: true);
            },
          ),
          const SizedBox(height: 16),
        ],
        // Show admin override banner when today's clock-in was done by an admin
        if (data.adminOverrideName != null) ...[
          _AdminOverrideBanner(
            adminName: data.adminOverrideName!,
            note: data.adminOverrideNote,
          ),
          const SizedBox(height: 16),
        ],
        _LiveStatusBanner(
          data: data,
          lateStatusOverride: effectiveLateStatus,
          hideUpcomingShift: showCountdown,
        ),
        const SizedBox(height: 16),
        _QuickActionsCard(),
        const SizedBox(height: 16),
        if (data.nextShiftStartTime != null ||
            data.upcomingHolidayName != null) ...[
          _UpcomingScheduleCard(data: data),
          const SizedBox(height: 16),
        ],
        _ShiftProgressCard(data: data),
        const SizedBox(height: 16),
        _WeeklyGoalCard(data: data),
        const SizedBox(height: 16),
        _StatsRow(
            todayHours: data.todayHours, daysWorked: data.daysWorkedThisWeek),
        const SizedBox(height: 16),
        if (data.lastActivityType != null && data.lastActivityTime != null)
          _LastActivitySnippet(
              type: data.lastActivityType!, time: data.lastActivityTime!),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildWorkZoneBadge() {
    return ListenableBuilder(
        listenable: sl<GeofenceService>(),
        builder: (context, _) {
          final service = sl<GeofenceService>();

          if (service.checkingLocation) {
            return const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                SizedBox(width: 6),
                Text('Checking location...',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            );
          }

          if (service.data?.branchLat == null ||
              service.data?.branchLng == null ||
              service.data?.branchRadius == null) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.location_disabled_rounded,
                      size: 14, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    'No Work Zone Assigned',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
            );
          }

          if (service.locationError != null && service.isInWorkZone == null) {
            return GestureDetector(
              onTap: () => service.checkGeofence(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border:
                      Border.all(color: Colors.orange.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.gps_off_rounded,
                        size: 14, color: Colors.orange),
                    const SizedBox(width: 4),
                    Text(
                      '${service.locationError}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.orange.shade800,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          if (service.isInWorkZone == null) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.help_outline_rounded,
                      size: 14, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    'Location Unknown',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
            );
          }

          final isInside = service.isInWorkZone!;
          return GestureDetector(
            onTap: () => service.checkGeofence(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isInside
                    ? Colors.green.withValues(alpha: 0.1)
                    : Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: isInside
                        ? Colors.green.withValues(alpha: 0.3)
                        : Colors.red.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isInside
                        ? Icons.location_on_rounded
                        : Icons.location_off_rounded,
                    size: 14,
                    color: isInside ? Colors.green : Colors.red,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    isInside
                        ? 'Inside Work Zone'
                        : (service.locationError ?? 'Outside Work Zone'),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isInside
                          ? Colors.green.shade700
                          : Colors.red.shade700,
                    ),
                  ),
                  if (!isInside) ...[
                    const SizedBox(width: 4),
                    Icon(Icons.refresh_rounded,
                        size: 12, color: Colors.red.shade700),
                  ]
                ],
              ),
            ),
          );
        });
  }

  String _greeting(DateTime now) {
    final hour = now.hour;
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  }
}

class _OfflineWarningBanner extends StatelessWidget {
  final int count;
  final VoidCallback onSync;

  const _OfflineWarningBanner({required this.count, required this.onSync});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onSync,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.orange.withValues(alpha: 0.1),
          border: Border.all(color: Colors.orange.withValues(alpha: 0.5)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Colors.orange),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'You have $count pending offline record(s). Tap to sync.',
                style: const TextStyle(
                    color: Colors.deepOrange, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Pre-shift countdown banner ─────────────────────────────────────────────────
/// Shows a live countdown when the employee's shift starts within 2 hours.
/// Automatically disappears the moment the shift starts.
class _ShiftCountdownBanner extends StatefulWidget {
  final String shiftStartTime; // "HH:mm" or "HH:mm:ss" 24-hour backend time
  final VoidCallback? onFinished;

  const _ShiftCountdownBanner({
    required this.shiftStartTime,
    this.onFinished,
  });

  @override
  State<_ShiftCountdownBanner> createState() => _ShiftCountdownBannerState();
}

class _ShiftCountdownBannerState extends State<_ShiftCountdownBanner> {
  Timer? _timer;
  Duration _remaining = Duration.zero;
  bool _active = false;

  @override
  void initState() {
    super.initState();
    _compute();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _compute());
  }

  Future<void> _compute() async {
    final now = await sl<TimeService>().getGhanaTimeAsync();
    if (!mounted) return;

    final shiftStart = _shiftStartForToday(widget.shiftStartTime, now);
    if (shiftStart == null) return;
    final diff = shiftStart.difference(now);
    // Active only while shift is 0–2 hours away and hasn't started yet.
    final isActive = diff.inSeconds > 0 && diff <= const Duration(hours: 2);

    if (mounted) {
      setState(() {
        _remaining = diff.isNegative ? Duration.zero : diff;
        _active = isActive;
      });
    }

    if (diff.isNegative || diff.inSeconds <= 0) {
      _timer?.cancel();
      widget.onFinished?.call();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_active) return const SizedBox.shrink();

    final h = _remaining.inHours;
    final m = _remaining.inMinutes % 60;
    final s = _remaining.inSeconds % 60;

    final timeStr = h > 0
        ? '${h}h ${m.toString().padLeft(2, '0')}m ${s.toString().padLeft(2, '0')}s'
        : '${m}m ${s.toString().padLeft(2, '0')}s';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.blue.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.access_alarm_rounded, color: Colors.blue, size: 32),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Shift Starting Soon',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: Colors.blue.shade700,
                      ),
                ),
                Text(
                  'Work starts in $timeStr',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.blue.shade600,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveStatusBanner extends StatelessWidget {
  final HomeDataEntity data;

  /// Local override for the late status — used when the phone clock says the
  /// shift has started but the server hasn't caught up yet.
  final LateStatus? lateStatusOverride;

  /// Whether to hide the "Upcoming Shift Today" banner (true when countdown is active)
  final bool hideUpcomingShift;

  const _LiveStatusBanner({
    required this.data,
    this.lateStatusOverride,
    this.hideUpcomingShift = false,
  });

  @override
  Widget build(BuildContext context) {
    final lateStatus = lateStatusOverride ?? data.lateStatus;
    // ── Forgot to clock out (shift ended > 10 min ago, still clocked in) ──────
    if (data.noShiftAssigned) {
      return _buildBanner(
        context,
        color: Colors.amber,
        icon: Icons.assignment_late_rounded,
        title: 'Missing Shift Assignment',
        subtitle: 'Contact HR to assign your work schedule',
      );
    }

    if (data.forgotToClockOut) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.red.shade50.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.red.withValues(alpha: 0.5)),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded,
                color: Colors.red, size: 32),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Forgot to Clock Out?',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: Colors.red.shade800,
                        ),
                  ),
                  Text(
                    'It looks like you never clocked out. Please do so immediately.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.red.shade900,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // ── Absent today: shift is over and employee never clocked in ────────────
    // This MUST be checked before the lateStatus blocks because an absent
    // employee will still have lateStatus == persistentLate when the shift ends,
    // which would otherwise block this banner from ever showing.
    if (data.isAbsentToday) {
      return _buildBanner(
        context,
        color: Colors.grey,
        icon: Icons.history_toggle_off_rounded,
        title: 'Shift Ended',
        subtitle: 'You did not clock in today.',
      );
    }

    // ── Late banners — only shown while the shift is still active and user hasn't clocked in
    if (!data.hasClockedInToday && lateStatus == LateStatus.persistentLate) {
      // > 3 hours late: escalated, deep-orange urgent alert
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.deepOrange.shade50.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.deepOrange.withValues(alpha: 0.6)),
        ),
        child: Row(
          children: [
            const Icon(Icons.running_with_errors_rounded,
                color: Colors.deepOrange, size: 32),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Still Not Clocked In',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: Colors.deepOrange.shade800,
                        ),
                  ),
                  Text(
                    'Please make sure you clock in — your attendance is at risk.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.deepOrange.shade900,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (!data.hasClockedInToday && lateStatus == LateStatus.late) {
      // < 3 hours late: standard orange warning
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.orange.shade50.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.orange.withValues(alpha: 0.5)),
        ),
        child: Row(
          children: [
            const Icon(Icons.access_time_filled_rounded,
                color: Colors.orange, size: 32),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Your shift has started',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: Colors.orange.shade800,
                        ),
                  ),
                  Text(
                    'Please clock in as soon as possible.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.orange.shade900,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final isClockedIn = data.isClockedIn;

    if (isClockedIn) {
      if (data.isOnBreak) {
        return _buildBanner(
          context,
          color: Colors.orange,
          icon: Icons.pause_circle_filled_rounded,
          title: 'Currently on Break',
          subtitle: 'End your break to resume work',
        );
      }

      String subtitle = 'Start your shift when you arrive';
      if (data.clockedInTime != null) {
        final hours = data.todayHours.floor();
        final mins = ((data.todayHours - hours) * 60).round();
        subtitle = 'Shift duration: ${hours}h ${mins}m';
      }
      return _buildBanner(
        context,
        color: Colors.green,
        icon: Icons.check_circle_rounded,
        title: 'Currently Clocked In',
        subtitle: subtitle,
      );
    }

    if (data.todayHours > 0) {
      return _buildBanner(
        context,
        color: Colors.blueGrey,
        icon: Icons.done_all_rounded,
        title: 'Shift Completed',
        subtitle: 'You worked ${data.todayHours.toStringAsFixed(1)}h today.',
      );
    }

    if (data.isVacation) {
      final name = data.vacationName ?? 'Vacation';
      final isErrand = name.toLowerCase().contains('errand');
      final isPermission = name.toLowerCase().contains('permission');

      return _buildBanner(
        context,
        color: isErrand
            ? Colors.green
            : (isPermission ? Colors.amber.shade700 : Colors.teal),
        icon: isErrand
            ? Icons.directions_run_rounded
            : (isPermission
                ? Icons.assignment_ind_rounded
                : Icons.beach_access_rounded),
        title: name,
        subtitle: isErrand
            ? 'On official assignment'
            : (isPermission ? 'Authorized absence' : 'Enjoy your break!'),
      );
    }

    if (data.isHoliday) {
      return _buildBanner(
        context,
        color: Colors.blue,
        icon: Icons.celebration_rounded,
        title: data.holidayName ?? 'Public Holiday',
        subtitle: 'Enjoy your day off!',
      );
    }

    if (data.isWeekend) {
      return _buildBanner(
        context,
        color: Colors.indigo,
        icon: Icons.weekend_rounded,
        title: 'Weekend',
        subtitle: 'Have a great weekend!',
      );
    }

    // Shift is not yet over — employee hasn't arrived yet
    // Hide this banner when countdown is active (within 2 hours of shift start)
    if (hideUpcomingShift) {
      return const SizedBox.shrink();
    }

    return _buildBanner(
      context,
      color: Colors.blue,
      icon: Icons.schedule_rounded,
      title: 'Upcoming Shift Today',
      subtitle: 'Have a great day ahead! Clock in when you arrive.',
    );
  }

  Widget _buildBanner(BuildContext context,
      {required Color color,
      required IconData icon,
      required String title,
      required String subtitle}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                ),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: color.withValues(alpha: 0.8),
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LastActivitySnippet extends StatelessWidget {
  final AttendanceType type;
  final DateTime time;

  const _LastActivitySnippet({required this.type, required this.time});

  @override
  Widget build(BuildContext context) {
    String label = 'Clocked In';
    if (type == AttendanceType.clockOut) {
      label = 'Clocked Out';
    } else if (type == AttendanceType.breakIn) {
      label = 'Started Break';
    } else if (type == AttendanceType.breakOut) {
      label = 'Ended Break';
    }

    final formatter = DateFormat('EEE, d MMM • h:mm a');

    return Center(
      child: Text(
        'Last Action: $label at ${formatter.format(time)}',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
      ),
    );
  }
}

// ── Quick actions card ────────────────────────────────────────────────────────
class _QuickActionsCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = Colors.green;

    return Material(
      elevation: 3,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => context.go('/home/clock-in'),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.access_time_rounded, color: color, size: 36),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Time Clock',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: color,
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Tap here to record your attendance',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: color,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Stats row ─────────────────────────────────────────────────────────────────
class _StatsRow extends StatelessWidget {
  final double todayHours;
  final int daysWorked;

  const _StatsRow({required this.todayHours, required this.daysWorked});

  @override
  Widget build(BuildContext context) {
    final tHours = todayHours.floor();
    final tMins = ((todayHours - tHours) * 60).round();
    final todayStr = tMins > 0 ? '${tHours}h ${tMins}m' : '${tHours}h';

    return Row(
      children: [
        Expanded(
          child: _StatCard(
            label: 'Today',
            value: todayStr,
            icon: Icons.timer_outlined,
            color: Colors.blue,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            label: 'This Week',
            value: '$daysWorked ${daysWorked == 1 ? 'Day' : 'Days'}',
            icon: Icons.calendar_view_week_outlined,
            color: Colors.purple,
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 8),
              Text(
                label.toUpperCase(),
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: theme.colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Admin Override Banner ────────────────────────────────────────────────────
/// Shown on the mobile home screen when an admin manually clocked in
/// the employee today. Displays the admin's name and their reason note.
class _AdminOverrideBanner extends StatefulWidget {
  final String adminName;
  final String? note;

  const _AdminOverrideBanner({
    required this.adminName,
    this.note,
  });

  @override
  State<_AdminOverrideBanner> createState() => _AdminOverrideBannerState();
}

class _AdminOverrideBannerState extends State<_AdminOverrideBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _dismiss() {
    _ctrl.reverse().then((_) {
      if (mounted) setState(() => _dismissed = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_dismissed) return const SizedBox.shrink();

    final theme = Theme.of(context);

    return FadeTransition(
      opacity: _fade,
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF1D4ED8), Color(0xFF3B82F6)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.admin_panel_settings_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),

            // Text block
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Clocked in by Administrator',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.75),
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    widget.adminName,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                  if (widget.note != null && widget.note!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        widget.note!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.9),
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Dismiss button
            GestureDetector(
              onTap: _dismiss,
              child: Icon(
                Icons.close_rounded,
                color: Colors.white.withValues(alpha: 0.7),
                size: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Dashboard Feature Cards ──────────────────────────────────────────────────

class _ShiftProgressCard extends StatelessWidget {
  final HomeDataEntity data;

  const _ShiftProgressCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final progress = data.targetDailyHours > 0
        ? (data.todayHours / data.targetDailyHours).clamp(0.0, 1.0)
        : 0.0;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            SizedBox(
              width: 60,
              height: 60,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 6,
                    backgroundColor: colorScheme.surfaceContainerHighest,
                    color: Colors.green,
                  ),
                  Center(
                    child: Text(
                      '${(progress * 100).toInt()}%',
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Daily Shift Progress',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${data.todayHours.toStringAsFixed(1)}h of ${data.targetDailyHours.toStringAsFixed(1)}h completed',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WeeklyGoalCard extends StatelessWidget {
  final HomeDataEntity data;

  const _WeeklyGoalCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final progress = data.targetWeeklyHours > 0
        ? (data.weekHours / data.targetWeeklyHours).clamp(0.0, 1.0)
        : 0.0;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Weekly Target',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  '${data.weekHours.toStringAsFixed(1)}h / ${data.targetWeeklyHours.toStringAsFixed(1)}h',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 10,
                backgroundColor: colorScheme.surfaceContainerHighest,
                color: Colors.blue,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UpcomingScheduleCard extends StatelessWidget {
  final HomeDataEntity data;

  const _UpcomingScheduleCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final formatter = DateFormat('EEE, d MMM');

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
            color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.event_note_rounded,
                    color: colorScheme.primary, size: 24),
                const SizedBox(width: 8),
                Text(
                  "What's Next",
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (data.nextShiftStartTime != null) ...[
              Row(
                children: [
                  Icon(Icons.schedule_rounded,
                      size: 20, color: colorScheme.secondary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Next Shift',
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colorScheme.onSurfaceVariant),
                        ),
                        Text(
                          data.nextShiftDate != null
                              ? '${data.nextShiftStartTime!} (${formatter.format(data.nextShiftDate!)})'
                              : data.nextShiftStartTime!,
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (data.upcomingHolidayName != null) const Divider(height: 24),
            ],
            if (data.upcomingHolidayName != null &&
                data.upcomingHolidayDate != null)
              Row(
                children: [
                  Icon(Icons.celebration_rounded,
                      size: 20, color: Colors.orange),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Upcoming Holiday',
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colorScheme.onSurfaceVariant),
                        ),
                        Text(
                          '${data.upcomingHolidayName} (${formatter.format(data.upcomingHolidayDate!)})',
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
