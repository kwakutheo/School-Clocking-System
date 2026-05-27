import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_bloc.dart';
import 'package:tk_clocking_system/features/attendance/presentation/pages/qr_scan_page.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_event.dart';
import 'package:tk_clocking_system/features/attendance/presentation/bloc/attendance_state.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_state.dart';
import 'package:tk_clocking_system/shared/enums/attendance_type.dart';
import 'package:tk_clocking_system/shared/enums/sync_status.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/services/biometric_service.dart';
import 'package:tk_clocking_system/core/services/notification_service.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';

/// The main clock-in / clock-out screen for employees.
class ClockInPage extends StatefulWidget {
  const ClockInPage({super.key});

  @override
  State<ClockInPage> createState() => _ClockInPageState();
}

class _ClockInPageState extends State<ClockInPage> {
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    final available = await sl<BiometricService>().isBiometricAvailable();
    if (mounted) {
      setState(() => _biometricEnabled = available);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Time Clock')),
      body: BlocConsumer<AttendanceBloc, AttendanceState>(
        listener: (context, state) {
          if (state is AttendanceRecorded) {
            // Notification logic: Schedule reminder on clock-in, cancel on clock-out
            if (state.record.type == AttendanceType.clockIn) {
              sl<NotificationService>().scheduleClockOutReminder();
            } else if (state.record.type == AttendanceType.clockOut) {
              sl<NotificationService>().cancelClockOutReminder();
            }

            final isOffline = state.record.syncStatus == SyncStatus.pending;
            showDialog(
              context: context,
              barrierDismissible: false,
              builder: (ctx) => AlertDialog(
                icon: Icon(
                  isOffline
                      ? Icons.cloud_off_rounded
                      : Icons.check_circle_outline_rounded,
                  size: 40,
                  color: isOffline ? Colors.orange : Colors.green,
                ),
                title: Text(
                  isOffline ? 'Saved Offline' : 'Success',
                  textAlign: TextAlign.center,
                ),
                content: Text(
                  isOffline
                      ? '${_label(state.record.type)} saved offline. It will sync automatically when you are connected to the internet.'
                      : '${_label(state.record.type)} recorded successfully!',
                  textAlign: TextAlign.center,
                ),
                actions: [
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('OK'),
                    ),
                  ),
                ],
              ),
            );
          } else if (state is AttendanceEarlyClockOutWarning) {
            showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                icon: const Icon(Icons.access_time_rounded,
                    size: 40, color: Colors.orange),
                title: const Text('Clock Out Early?'),
                content: Text(state.message),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(false),
                    child: const Text('Cancel'),
                  ),
                  FilledButton(
                    style:
                        FilledButton.styleFrom(backgroundColor: Colors.orange),
                    onPressed: () => Navigator.of(ctx).pop(true),
                    child: const Text('Clock Out Anyway'),
                  ),
                ],
              ),
            ).then((confirmed) {
              if (confirmed == true && context.mounted) {
                if (state.pendingQrCode != null) {
                  context.read<AttendanceBloc>().add(
                        AttendanceQrRecordEvent(
                          qrCode: state.pendingQrCode!,
                          type: state.pendingType,
                          forceEarlyOut: true,
                        ),
                      );
                } else {
                  context.read<AttendanceBloc>().add(
                        AttendanceRecordEvent(
                          employeeId: state.pendingEmployeeId,
                          type: state.pendingType,
                          branchId: state.pendingBranchId,
                          deviceId: state.pendingDeviceId,
                          forceEarlyOut: true,
                        ),
                      );
                }
              }
            });
          } else if (state is AttendanceFailure) {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                icon: Icon(Icons.error_outline_rounded,
                    size: 40, color: Theme.of(ctx).colorScheme.error),
                title: const Text('Action Denied'),
                content: Text(state.message),
                actions: [
                  FilledButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: const Text('OK'),
                  ),
                ],
              ),
            );
          }
        },
        builder: (context, state) {
          final authState = context.read<AuthBloc>().state;
          final user = authState is AuthAuthenticated ? authState.user : null;
          final isLoading = state is AttendanceLoading;

          final disableButtons = isLoading;

          return Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Theme.of(context).colorScheme.surface,
                  Theme.of(context)
                      .colorScheme
                      .primaryContainer
                      .withValues(alpha: 0.1),
                  Theme.of(context).colorScheme.surface,
                ],
              ),
            ),
            child: Stack(
              children: [
                SafeArea(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _StaggeredEntry(index: 0, child: _ClockDisplay()),
                        const SizedBox(height: 10),
                        _StaggeredEntry(
                          index: 1,
                          child: _StatusCard(userName: user?.fullName ?? ''),
                        ),
                        const SizedBox(height: 16),
                        _StaggeredEntry(
                          index: 3,
                          child: Text(
                            'Actions',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        _StaggeredEntry(
                          index: 4,
                          child: _ActionGrid(
                            employeeId: user?.id ?? '',
                            isDisabled: disableButtons,
                            isBiometricEnabled: _biometricEnabled,
                          ),
                        ),
                        const SizedBox(height: 30),
                        _StaggeredEntry(
                          index: 5,
                          child: _QrScanButton(
                            isLoading: isLoading,
                            isDisabled: disableButtons,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (isLoading) const _LoadingOverlay(),
              ],
            ),
          );
        },
      ),
    );
  }

  String _label(AttendanceType type) => switch (type) {
        AttendanceType.clockIn => 'Clock In',
        AttendanceType.clockOut => 'Clock Out',
        AttendanceType.breakIn => 'Break Start',
        AttendanceType.breakOut => 'Break End',
      };
}

// ── Live clock display (Glassmorphism) ──────────────────────────────────────
class _ClockDisplay extends StatefulWidget {
  const _ClockDisplay();

  @override
  State<_ClockDisplay> createState() => _ClockDisplayState();
}

class _ClockDisplayState extends State<_ClockDisplay>
    with SingleTickerProviderStateMixin {
  late final Stream<DateTime> _clock;
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;
  StreamSubscription? _pulseSub;

  @override
  void initState() {
    super.initState();
    _clock = sl<TimeService>().trueTimeStream;

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _pulseSub = Stream.periodic(const Duration(seconds: 1)).listen((_) {
      if (mounted) {
        _pulseController
            .forward(from: 0)
            .then((_) => _pulseController.reverse());
      }
    });
  }

  @override
  void dispose() {
    _pulseSub?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return StreamBuilder<DateTime>(
      stream: _clock,
      initialData: sl<TimeService>().currentGhanaTime,
      builder: (context, snapshot) {
        final now = snapshot.data ?? sl<TimeService>().currentGhanaTime;

        final hour = now.hour % 12 == 0 ? 12 : now.hour % 12;
        final amPm = now.hour < 12 ? 'AM' : 'PM';
        final hhmm =
            '${hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
        final ss = now.second.toString().padLeft(2, '0');
        final dateStr =
            '${_weekday(now.weekday)}, ${now.day} ${_month(now.month)} ${now.year}';

        return ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: colorScheme.surface.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: colorScheme.primary.withValues(alpha: 0.2),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: colorScheme.primary.withValues(alpha: 0.05),
                    blurRadius: 20,
                    spreadRadius: -5,
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        hhmm,
                        style: theme.textTheme.displayMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1.5,
                          color: colorScheme.primary,
                        ),
                      ),
                      const SizedBox(width: 4),
                      ScaleTransition(
                        scale: _pulseAnimation,
                        child: Text(
                          ':$ss',
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: colorScheme.primary.withValues(alpha: 0.6),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        amPm,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colorScheme.primary.withValues(alpha: 0.4),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(
                        Icons.calendar_today_rounded,
                        size: 14,
                        color: colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        dateStr.toUpperCase(),
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.1,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _weekday(int d) => const [
        '',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ][d];

  String _month(int m) => const [
        '',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m];
}

// ── Status card ───────────────────────────────────────────────────────────────
class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.userName});

  final String userName;

  String _getGreeting(DateTime time) {
    final hour = time.hour;
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: colorScheme.primary.withValues(alpha: 0.1),
            child: Text(
              userName.isNotEmpty ? userName[0].toUpperCase() : '?',
              style: TextStyle(
                color: colorScheme.primary,
                fontWeight: FontWeight.w800,
                fontSize: 20,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StreamBuilder<DateTime>(
                  stream: sl<TimeService>().trueTimeStream,
                  initialData: sl<TimeService>().currentGhanaTime,
                  builder: (context, snapshot) {
                    final time = snapshot.data ?? sl<TimeService>().currentGhanaTime;
                    return Text(
                      _getGreeting(time),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                    );
                  },
                ),
                Text(
                  userName,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
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

// ── Action grid ───────────────────────────────────────────────────────────────
class _ActionGrid extends StatelessWidget {
  const _ActionGrid({
    required this.employeeId,
    required this.isDisabled,
    required this.isBiometricEnabled,
  });

  final String employeeId;
  final bool isDisabled;
  final bool isBiometricEnabled;

  @override
  Widget build(BuildContext context) {
    final actions = [
      (AttendanceType.clockIn, Icons.login_rounded, 'Clock In', Colors.green),
      (AttendanceType.clockOut, Icons.logout_rounded, 'Clock Out', Colors.red),
      (
        AttendanceType.breakIn,
        Icons.free_breakfast_rounded,
        'Break Start',
        Colors.orange
      ),
      (AttendanceType.breakOut, Icons.replay_rounded, 'Break End', Colors.blue),
    ];

    return GridView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        mainAxisExtent: 85,
      ),
      children: actions.map((action) {
        final (type, icon, label, color) = action;

        return Material(
          elevation: 5,
          borderRadius: BorderRadius.circular(12),
          child: _ActionTile(
            type: type,
            icon: icon,
            label: label,
            color: color,
            employeeId: employeeId,
            isDisabled: isDisabled,
            isBiometricEnabled: isBiometricEnabled,
          ),
        );
      }).toList(),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.type,
    required this.icon,
    required this.label,
    required this.color,
    required this.employeeId,
    required this.isDisabled,
    required this.isBiometricEnabled,
  });

  final AttendanceType type;
  final IconData icon;
  final String label;
  final Color color;
  final String employeeId;
  final bool isDisabled;
  final bool isBiometricEnabled;

  @override
  Widget build(BuildContext context) {
    return _BouncingWidget(
      onTap: isDisabled
          ? null
          : () async {
              HapticFeedback.lightImpact();
              final confirmed =
                  await _showConfirmDialog(context, label, icon, color);
              if (confirmed == true && context.mounted) {
                HapticFeedback.mediumImpact();
                // Biometric/PIN Verification
                final biometricService = sl<BiometricService>();
                if (await biometricService.isBiometricAvailable()) {
                  final authenticated = await biometricService.authenticate(
                    'Please verify your identity to $label',
                  );
                  if (!authenticated) return;
                }

                if (context.mounted) {
                  context.read<AttendanceBloc>().add(
                        AttendanceRecordEvent(
                          employeeId: employeeId,
                          type: type,
                        ),
                      );
                }
              }
            },
      child: Opacity(
        opacity: isDisabled ? 0.4 : 1.0,
        child: Stack(
          children: [
            Container(
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: color.withValues(alpha: 0.2)),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, color: color, size: 28),
                    const SizedBox(height: 4),
                    Text(
                      label,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: color,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
              ),
            ),
            if (isBiometricEnabled && !isDisabled)
              Positioned(
                top: 8,
                right: 10,
                child: Icon(
                  Icons.fingerprint_rounded,
                  size: 14,
                  color: color.withValues(alpha: 0.7),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── QR Scan Button ──────────────────────────────────────────────────────────
class _QrScanButton extends StatelessWidget {
  const _QrScanButton({required this.isLoading, required this.isDisabled});

  final bool isLoading;
  final bool isDisabled;

  @override
  Widget build(BuildContext context) {
    return _BouncingWidget(
      onTap: (isLoading || isDisabled)
          ? null
          : () async {
              HapticFeedback.lightImpact();
              final qrCode = await Navigator.of(context).push<String>(
                MaterialPageRoute(
                  builder: (_) => const QrScanPage(),
                ),
              );
              if (qrCode != null && qrCode.isNotEmpty && context.mounted) {
                _showTypeSelector(context, qrCode);
              }
            },
      child: Opacity(
        opacity: isDisabled ? 0.4 : 1.0,
        child: Material(
          elevation: 3,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF7C3AED).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                  color: const Color(0xFF7C3AED).withValues(alpha: 0.2)),
            ),
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.qr_code_scanner_rounded,
                  color: Color(0xFF7C3AED),
                  size: 24,
                ),
                const SizedBox(width: 12),
                Text(
                  'Scan QR Code',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: const Color(0xFF7C3AED),
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showTypeSelector(BuildContext context, String qrCode) {
    final bloc = context.read<AttendanceBloc>();
    final colorScheme = Theme.of(context).colorScheme;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Select Action',
                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  'QR code detected. What would you like to record?',
                  style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 20),
                _QrTypeTile(
                  icon: Icons.login_rounded,
                  label: 'Clock In',
                  color: Colors.green,
                  onTap: () async {
                    final confirmed = await _showConfirmDialog(
                        ctx, 'Clock In', Icons.login_rounded, Colors.green);
                    if (confirmed == true && context.mounted) {
                      // Biometric/PIN Verification
                      final biometricService = sl<BiometricService>();
                      if (await biometricService.isBiometricAvailable()) {
                        final authenticated =
                            await biometricService.authenticate(
                          'Please verify your identity to Clock In',
                        );
                        if (!authenticated) return;
                      }

                      if (context.mounted) {
                        Navigator.pop(ctx);
                        bloc.add(
                          AttendanceQrRecordEvent(
                            qrCode: qrCode,
                            type: AttendanceType.clockIn,
                          ),
                        );
                      }
                    }
                  },
                ),
                const SizedBox(height: 8),
                _QrTypeTile(
                  icon: Icons.logout_rounded,
                  label: 'Clock Out',
                  color: Colors.red,
                  onTap: () async {
                    final confirmed = await _showConfirmDialog(
                        ctx, 'Clock Out', Icons.logout_rounded, Colors.red);
                    if (confirmed == true && context.mounted) {
                      // Biometric/PIN Verification
                      final biometricService = sl<BiometricService>();
                      if (await biometricService.isBiometricAvailable()) {
                        final authenticated =
                            await biometricService.authenticate(
                          'Please verify your identity to Clock Out',
                        );
                        if (!authenticated) return;
                      }

                      if (context.mounted) {
                        Navigator.pop(ctx);
                        bloc.add(
                          AttendanceQrRecordEvent(
                            qrCode: qrCode,
                            type: AttendanceType.clockOut,
                          ),
                        );
                      }
                    }
                  },
                ),
                const SizedBox(height: 8),
                _QrTypeTile(
                  icon: Icons.free_breakfast_rounded,
                  label: 'Break Start',
                  color: Colors.orange,
                  onTap: () async {
                    final confirmed = await _showConfirmDialog(
                        ctx,
                        'Break Start',
                        Icons.free_breakfast_rounded,
                        Colors.orange);
                    if (confirmed == true && context.mounted) {
                      // Biometric/PIN Verification
                      final biometricService = sl<BiometricService>();
                      if (await biometricService.isBiometricAvailable()) {
                        final authenticated =
                            await biometricService.authenticate(
                          'Please verify your identity to record Break Start',
                        );
                        if (!authenticated) return;
                      }

                      if (context.mounted) {
                        Navigator.pop(ctx);
                        bloc.add(
                          AttendanceQrRecordEvent(
                            qrCode: qrCode,
                            type: AttendanceType.breakIn,
                          ),
                        );
                      }
                    }
                  },
                ),
                const SizedBox(height: 8),
                _QrTypeTile(
                  icon: Icons.replay_rounded,
                  label: 'Break End',
                  color: Colors.blue,
                  onTap: () async {
                    final confirmed = await _showConfirmDialog(
                        ctx, 'Break End', Icons.replay_rounded, Colors.blue);
                    if (confirmed == true && context.mounted) {
                      // Biometric/PIN Verification
                      final biometricService = sl<BiometricService>();
                      if (await biometricService.isBiometricAvailable()) {
                        final authenticated =
                            await biometricService.authenticate(
                          'Please verify your identity to record Break End',
                        );
                        if (!authenticated) return;
                      }

                      if (context.mounted) {
                        Navigator.pop(ctx);
                        bloc.add(
                          AttendanceQrRecordEvent(
                            qrCode: qrCode,
                            type: AttendanceType.breakOut,
                          ),
                        );
                      }
                    }
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _QrTypeTile extends StatelessWidget {
  const _QrTypeTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 3,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.15)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(width: 16),
              Text(
                label,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const Spacer(),
              Icon(
                Icons.arrow_forward_ios_rounded,
                color: color.withValues(alpha: 0.5),
                size: 16,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Helper Methods ─────────────────────────────────────────────────────────
Future<bool?> _showConfirmDialog(
  BuildContext context,
  String label,
  IconData icon,
  Color color,
) {
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: Icon(icon, color: color, size: 40),
      title: Text('Confirm $label'),
      content: Text('Are you sure you want to record a $label?'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: color),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text('Confirm $label'),
        ),
      ],
    ),
  );
}

// ── Interactive UI Helpers ──────────────────────────────────────────────────

/// Provides a "bouncing" scale effect when tapped, along with haptics.
class _BouncingWidget extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;

  const _BouncingWidget({required this.child, this.onTap});

  @override
  State<_BouncingWidget> createState() => _BouncingWidgetState();
}

class _BouncingWidgetState extends State<_BouncingWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => widget.onTap != null ? _controller.forward() : null,
      onTapUp: (_) => _controller.reverse(),
      onTapCancel: () => _controller.reverse(),
      onTap: widget.onTap,
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: widget.child,
      ),
    );
  }
}

/// Animates its child by sliding and fading it in, staggered by [index].
class _StaggeredEntry extends StatelessWidget {
  final Widget child;
  final int index;

  const _StaggeredEntry({required this.child, required this.index});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (index * 100)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 30 * (1 - value)),
            child: child,
          ),
        );
      },
      child: child,
    );
  }
}

// ── Loading Overlay ─────────────────────────────────────────────────────────
class _LoadingOverlay extends StatelessWidget {
  const _LoadingOverlay();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withValues(alpha: 0.3),
      child: Center(
        child: Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text(
                'Processing...',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
