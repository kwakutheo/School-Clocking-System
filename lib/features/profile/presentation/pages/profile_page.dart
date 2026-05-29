import 'dart:async';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:visibility_detector/visibility_detector.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/router/app_router.dart';
import 'package:go_router/go_router.dart';
import 'package:tk_clocking_system/core/network/api_client.dart';
import 'package:tk_clocking_system/core/network/api_endpoints.dart';
import 'package:tk_clocking_system/core/services/storage_service.dart';
import 'package:tk_clocking_system/features/auth/data/models/user_model.dart';
import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_event.dart';
import 'package:tk_clocking_system/features/auth/presentation/bloc/auth_state.dart';
import 'package:tk_clocking_system/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:tk_clocking_system/features/profile/presentation/bloc/profile_event.dart';
import 'package:tk_clocking_system/features/profile/presentation/bloc/profile_state.dart';
import 'package:tk_clocking_system/shared/enums/user_role.dart';
import 'package:intl/intl.dart';
import 'package:tk_clocking_system/shared/widgets/app_text_field.dart';
import 'package:tk_clocking_system/shared/widgets/primary_button.dart';

/// Profile tab — shows user info and allows editing.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool _isEditing = false;
  bool _isSaving = false;
  bool _isChangingPassword = false;
  String? _lastSyncedUserId;
  String _usernameStatus = 'idle'; // 'idle', 'checking', 'available', 'taken'
  List<String> _usernameSuggestions = [];
  Timer? _usernameDebounce;
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _fullNameController;
  late TextEditingController _usernameController;
  late TextEditingController _passwordController;
  late TextEditingController _confirmPasswordController;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final user = _currentUser;
    _fullNameController = TextEditingController(text: user?.fullName ?? '');
    _usernameController = TextEditingController(text: user?.username ?? '');
    _usernameController.addListener(_onUsernameChanged);
    _passwordController = TextEditingController();
    _confirmPasswordController = TextEditingController();

    // Re-sync profile whenever a different account logs in.
    // This handles the case where the page is already visible inside the
    // IndexedStack so VisibilityDetector.onVisibilityChanged won't re-fire.
    if (user != null && user.id != _lastSyncedUserId) {
      _lastSyncedUserId = user.id;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          context.read<AuthBloc>().add(const AuthSyncProfileEvent());
        }
      });
    }
  }

  void _onUsernameChanged() {
    if (_usernameDebounce?.isActive ?? false) _usernameDebounce!.cancel();
    
    final username = _usernameController.text.trim();
    if (username.isEmpty || username == _currentUser?.username) {
      setState(() {
        _usernameStatus = 'idle';
        _usernameSuggestions = [];
      });
      return;
    }

    setState(() => _usernameStatus = 'checking');

    _usernameDebounce = Timer(const Duration(milliseconds: 400), () async {
      try {
        final api = sl<ApiClient>();
        final response = await api.get<Map<String, dynamic>>(
          ApiEndpoints.checkUsername,
          queryParameters: {
            'username': username,
            'fullName': _currentUser?.fullName,
          },
        );
        if (mounted) {
          final data = response.data!;
          setState(() {
            if (data['available'] == true) {
              _usernameStatus = 'available';
              _usernameSuggestions = [];
            } else {
              _usernameStatus = 'taken';
              _usernameSuggestions = List<String>.from(data['suggestions'] ?? []);
            }
          });
        }
      } catch (e) {
        if (mounted) setState(() => _usernameStatus = 'idle');
      }
    });
  }

  @override
  void dispose() {
    _usernameDebounce?.cancel();
    _usernameController.removeListener(_onUsernameChanged);
    _fullNameController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  UserEntity? get _currentUser {
    final authState = context.read<AuthBloc>().state;
    return authState is AuthAuthenticated ? authState.user : null;
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    if (_usernameStatus == 'taken') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please choose an available username'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final api = sl<ApiClient>();
      final payload = <String, dynamic>{
        'username': _usernameController.text.trim(),
      };
      final password = _passwordController.text.trim();
      final confirmPassword = _confirmPasswordController.text.trim();

      if (_isChangingPassword) {
        if (password != confirmPassword) {
          setState(() => _isSaving = false);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Passwords do not match'),
                backgroundColor: Colors.red,
              ),
            );
          }
          return;
        }
        payload['password'] = password;
      }

      final response = await api.patch<Map<String, dynamic>>(
        ApiEndpoints.employeeMeUpdate,
        data: payload,
      );

      final data = response.data!;
      final updatedUser = UserModel.fromJson(
        data['user'] as Map<String, dynamic>? ?? data,
      );

      // Cache updated user
      final storage = sl<StorageService>();
      await storage.saveUserJson(updatedUser.toJsonString());

      // Refresh auth bloc user
      if (mounted) {
        final authBloc = context.read<AuthBloc>();
        authBloc.add(const AuthCheckSessionEvent());
      }

      if (mounted) {
        setState(() => _isEditing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated successfully.')),
        );
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['message'];
      final errorText = msg is String
          ? msg
          : msg is List
              ? msg.join(', ')
              : e.message ?? 'Failed to update profile.';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorText), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update profile: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final authState = context.watch<AuthBloc>().state;
    final user = authState is AuthAuthenticated ? authState.user : null;

    return MultiBlocProvider(
      providers: [
        BlocProvider<ProfileBloc>(
          create: (context) => sl<ProfileBloc>()
            ..add(const LoadWorkHistoryEvent()),
        ),
      ],
      child: BlocListener<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthUnauthenticated) {
            AppRouter.router.go('/login');
          }
        },
        child: Builder(
          builder: (context) {
            return Scaffold(
              body: VisibilityDetector(
                key: const Key('profile-page'),
                onVisibilityChanged: (info) {
                  if (info.visibleFraction > 0.5 && !_isEditing) {
                    context.read<AuthBloc>().add(const AuthSyncProfileEvent());
                    context.read<ProfileBloc>().add(const LoadWorkHistoryEvent());
                  }
                },
                child: RefreshIndicator(
                  onRefresh: () async {
                    context.read<AuthBloc>().add(const AuthSyncProfileEvent());
                    context.read<ProfileBloc>().add(const LoadWorkHistoryEvent());
                    await Future.delayed(const Duration(seconds: 1));
                  },
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverAppBar(
                    expandedHeight: 240,
                    pinned: true,
                    stretch: true,
                    elevation: 4,
                    scrolledUnderElevation: 4,
                    backgroundColor: const Color(0xFFF602E2),
                    title: const Text(
                      'Profile',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                      ),
                    ),
                    centerTitle: false,
                    actions: const [],
                    flexibleSpace: FlexibleSpaceBar(
                      stretchModes: const [StretchMode.zoomBackground],
                      background: Stack(
                        fit: StackFit.expand,
                        children: [
                          _AnimatedMeshBackground(colorScheme: cs),
                          if (user != null)
                            Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.black.withValues(alpha: 0.2),
                                    Colors.transparent,
                                    Colors.black.withValues(alpha: 0.3),
                                  ],
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const SizedBox(height: 30),
                                  // ── Avatar ──────────────────────────────────
                                  Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color:
                                            Colors.white.withValues(alpha: 0.3),
                                        width: 2,
                                      ),
                                    ),
                                    child: Hero(
                                      tag: 'profile-avatar',
                                      child: CircleAvatar(
                                        radius: 42,
                                        backgroundColor:
                                            Colors.white.withValues(alpha: 0.2),
                                        child: Text(
                                          user.initials,
                                          style: theme.textTheme.headlineLarge
                                              ?.copyWith(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: -1,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  // ── Name ────────────────────────────────────
                                  Text(
                                    user.fullName,
                                    style:
                                        theme.textTheme.headlineSmall?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: -0.5,
                                      shadows: [
                                        Shadow(
                                          color: Colors.black
                                              .withValues(alpha: 0.3),
                                          blurRadius: 15,
                                          offset: const Offset(0, 4),
                                        )
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  // ── Role Badge ──────────────────────────────
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: BackdropFilter(
                                      filter: ui.ImageFilter.blur(
                                          sigmaX: 10, sigmaY: 10),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 14, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: Colors.white
                                              .withValues(alpha: 0.15),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                          border: Border.all(
                                              color: Colors.white
                                                  .withValues(alpha: 0.2)),
                                        ),
                                        child: Text(
                                          _roleLabel(user.role).toUpperCase(),
                                          style: theme.textTheme.labelSmall
                                              ?.copyWith(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 1.2,
                                            fontSize: 10,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 16),
                        child: Column(
                          children: [
                            if (user != null) ...[
                              if (_isEditing) ...[
                                Form(
                                  key: _formKey,
                                  child: _EditSection(
                                    title: 'Edit Profile',
                                    children: [
                                      AppTextField(
                                        controller: _usernameController,
                                        label: 'Username',
                                        prefixIcon:
                                            Icons.alternate_email_outlined,
                                        suffixIcon: IconButton(
                                          icon: const Icon(Icons.close_rounded),
                                          onPressed: () => setState(() {
                                            _isEditing = false;
                                            _isChangingPassword = false;
                                            _usernameController.text = _currentUser?.username ?? '';
                                            _usernameStatus = 'idle';
                                          }),
                                        ),
                                        validator: (v) => v == null || v.isEmpty
                                            ? 'Username is required'
                                            : null,
                                      ),
                                      if (_usernameStatus == 'checking')
                                        const Padding(
                                          padding: EdgeInsets.only(top: 4, left: 16),
                                          child: Text('Checking availability...', style: TextStyle(color: Colors.grey, fontSize: 12)),
                                        ),
                                      if (_usernameStatus == 'available')
                                        const Padding(
                                          padding: EdgeInsets.only(top: 4, left: 16),
                                          child: Text('✓ Username is available', style: TextStyle(color: Colors.green, fontSize: 12)),
                                        ),
                                      if (_usernameStatus == 'taken')
                                        Padding(
                                          padding: const EdgeInsets.only(top: 4, left: 16),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text('✗ Username already taken', style: TextStyle(color: Colors.red, fontSize: 12)),
                                              if (_usernameSuggestions.isNotEmpty) ...[
                                                const SizedBox(height: 8),
                                                const Text('Suggestions:', style: TextStyle(color: Colors.grey, fontSize: 12)),
                                                const SizedBox(height: 4),
                                                Wrap(
                                                  spacing: 8,
                                                  children: _usernameSuggestions.map((sug) {
                                                    return ActionChip(
                                                      label: Text(sug),
                                                      onPressed: () {
                                                        _usernameController.text = sug;
                                                        // Move cursor to end
                                                        _usernameController.selection = TextSelection.fromPosition(TextPosition(offset: sug.length));
                                                      },
                                                    );
                                                  }).toList(),
                                                ),
                                              ]
                                            ],
                                          ),
                                        ),
                                      const SizedBox(height: 12),
                                      if (!_isChangingPassword)
                                        Center(
                                          child: TextButton.icon(
                                            onPressed: () => setState(() =>
                                                _isChangingPassword = true),
                                            icon: const Icon(
                                                Icons.lock_open_rounded),
                                            label:
                                                const Text('Change Password'),
                                          ),
                                        )
                                      else ...[
                                        Row(
                                          children: [
                                            const Expanded(
                                                child: Text('Update Password',
                                                    style: TextStyle(
                                                        fontWeight:
                                                            FontWeight.bold))),
                                            TextButton(
                                              onPressed: () => setState(() =>
                                                  _isChangingPassword = false),
                                              child: const Text('Cancel'),
                                            ),
                                          ],
                                        ),
                                        AppTextField(
                                          controller: _passwordController,
                                          label: 'New Password',
                                          prefixIcon: Icons.lock_outline,
                                          obscureText: true,
                                          validator: (v) =>
                                              v == null || v.isEmpty
                                                  ? 'Password is required'
                                                  : null,
                                        ),
                                        const SizedBox(height: 12),
                                        AppTextField(
                                          controller:
                                              _confirmPasswordController,
                                          label: 'Confirm New Password',
                                          prefixIcon: Icons.lock_reset_outlined,
                                          obscureText: true,
                                          validator: (v) {
                                            if (v == null || v.isEmpty) {
                                              return 'Please confirm your password';
                                            }
                                            if (v != _passwordController.text) {
                                              return 'Passwords do not match';
                                            }
                                            return null;
                                          },
                                        ),
                                      ],
                                      const SizedBox(height: 16),
                                      PrimaryButton(
                                        label: 'Save Changes',
                                        isLoading: _isSaving,
                                        onPressed: _saveProfile,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ] else ...[
                                _InfoSection(
                                  title: 'Account Details',
                                  items: [
                                    _InfoItem(
                                      icon: Icons.alternate_email_outlined,
                                      label: 'Username',
                                      value: user.username.isNotEmpty
                                          ? user.username
                                          : '—',
                                      trailing: IconButton(
                                        icon: Icon(Icons.edit_outlined,
                                            size: 20, color: cs.primary),
                                        onPressed: () => _confirmEdit(context),
                                      ),
                                    ),
                                    if (user.employeeCode != null)
                                      _InfoItem(
                                        icon: Icons.numbers_outlined,
                                        label: 'Employee Code',
                                        value: user.employeeCode!,
                                      ),
                                    if (user.schoolName != null)
                                      _InfoItem(
                                        icon: Icons.school_outlined,
                                        label: 'School',
                                        value: user.schoolName!,
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                // ── Work & Employment ──────────────────────
                                if (user.branchName != null ||
                                    user.departmentName != null ||
                                    user.position != null ||
                                    user.hireDate != null)
                                  _InfoSection(
                                    title: 'Work & Employment',
                                    items: [
                                      if (user.branchName != null)
                                        _InfoItem(
                                          icon: Icons.business_outlined,
                                          label: 'Designated Branch',
                                          value: user.branchName!,
                                        ),
                                      if (user.departmentName != null ||
                                          user.position != null)
                                        _InfoItem(
                                          icon: Icons.work_outline_rounded,
                                          label: 'Role & Department',
                                          value: [
                                            if (user.position != null)
                                              user.position!,
                                            if (user.departmentName != null)
                                              user.departmentName!,
                                          ].join(' • '),
                                        ),
                                      if (user.hireDate != null)
                                        _InfoItem(
                                          icon: Icons.calendar_month_outlined,
                                          label: 'Member Since',
                                          value:
                                              _formatHireDate(user.hireDate!),
                                        ),
                                    ],
                                  ),
                                const SizedBox(height: 16),
                                // ── Work History Preview (latest 3) ───────
                                _InfoSection(
                                  title: 'Work History',
                                  items: [],
                                  customBody:
                                      BlocBuilder<ProfileBloc, ProfileState>(
                                    builder: (context, state) {
                                      if (state is ProfileLoading ||
                                          state is ProfileInitial) {
                                        return const Padding(
                                          padding: EdgeInsets.all(16.0),
                                          child: Center(
                                              child:
                                                  CircularProgressIndicator()),
                                        );
                                      } else if (state is ProfileError) {
                                        return Padding(
                                          padding: const EdgeInsets.all(16.0),
                                          child: Center(
                                              child: Text(state.message,
                                                  style: TextStyle(
                                                      color: cs.error))),
                                        );
                                      } else if (state
                                          is ProfileHistoryLoaded) {
                                        final history = state.history;
                                        if (history.isEmpty) {
                                          return const Padding(
                                            padding: EdgeInsets.all(16.0),
                                            child: Center(
                                                child: Text(
                                                    'No work history found.')),
                                          );
                                        }

                                        // Show only the 3 most recent entries
                                        final preview = history.take(3).toList();
                                        final hasMore = history.length > 3;

                                        return Column(
                                          children: [
                                            Padding(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      vertical: 8.0,
                                                      horizontal: 16.0),
                                              child: Column(
                                                children: List.generate(
                                                    preview.length, (index) {
                                                  final log = preview[index];
                                                  final isLast = index ==
                                                          preview.length - 1 &&
                                                      !hasMore;
                                                  return _TimelineTile(
                                                    status: log.status,
                                                    startDate: log.startDate,
                                                    endDate: log.endDate,
                                                    isLast: isLast,
                                                  );
                                                }),
                                              ),
                                            ),
                                            // ── View Full History button ──
                                            InkWell(
                                              onTap: () => context.go(
                                                  '/home/work-history'),
                                              borderRadius:
                                                  const BorderRadius.only(
                                                bottomLeft: Radius.circular(14),
                                                bottomRight:
                                                    Radius.circular(14),
                                              ),
                                              child: Container(
                                                width: double.infinity,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        vertical: 14),
                                                decoration: BoxDecoration(
                                                  color: cs.primaryContainer
                                                      .withValues(alpha: 0.4),
                                                  borderRadius:
                                                      const BorderRadius.only(
                                                    bottomLeft:
                                                        Radius.circular(14),
                                                    bottomRight:
                                                        Radius.circular(14),
                                                  ),
                                                  border: Border(
                                                    top: BorderSide(
                                                        color: cs.outline
                                                            .withValues(
                                                                alpha: 0.1)),
                                                  ),
                                                ),
                                                child: Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment.center,
                                                  children: [
                                                    Icon(
                                                      Icons.history_rounded,
                                                      size: 16,
                                                      color: cs.primary,
                                                    ),
                                                    const SizedBox(width: 8),
                                                    Text(
                                                      hasMore
                                                          ? 'View Full History (${history.length} entries)'
                                                          : 'View Full History',
                                                      style: theme.textTheme
                                                          .labelLarge
                                                          ?.copyWith(
                                                        color: cs.primary,
                                                        fontWeight:
                                                            FontWeight.w700,
                                                      ),
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Icon(
                                                      Icons
                                                          .chevron_right_rounded,
                                                      size: 18,
                                                      color: cs.primary,
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ],
                                        );
                                      }
                                      return const SizedBox.shrink();
                                    },
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],
                            ],
                            _InfoSection(
                              title: 'App Settings',
                              items: [
                                _InfoItem(
                                  icon: Icons.fingerprint_rounded,
                                  label: 'Require Biometrics',
                                  value: ' Required for clocking',
                                  trailing: const Icon(
                                      Icons.check_circle_rounded,
                                      color: Colors.green,
                                      size: 20),
                                ),
                                _InfoItem(
                                  icon: Icons.gps_fixed_outlined,
                                  label: 'Location Services',
                                  value: 'Required for clocking',
                                  trailing: const Icon(
                                      Icons.check_circle_rounded,
                                      color: Colors.green,
                                      size: 20),
                                ),
                                _InfoItem(
                                  icon: Icons.notifications_outlined,
                                  label: 'In-app notifications',
                                  value: 'Enabled',
                                  trailing: const Icon(
                                      Icons.check_circle_rounded,
                                      color: Colors.green,
                                      size: 20),
                                ),
                              ],
                            ),
                            const SizedBox(height: 32),
                            SizedBox(
                              width: double.infinity,
                              child: InkWell(
                                onTap: () => _confirmSignOut(context),
                                borderRadius: BorderRadius.circular(16),
                                child: Ink(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 16),
                                  decoration: BoxDecoration(
                                    color: cs.error.withValues(alpha: 0.1),
                                    border: Border.all(
                                        color: cs.error.withValues(alpha: 0.3)),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.logout_rounded,
                                          color: cs.error),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Sign Out',
                                        style: TextStyle(
                                          color: cs.error,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 48),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    ),
  ),
);
  }

  String _roleLabel(UserRole role) {
    switch (role) {
      case UserRole.employee:
        return 'Employee';
      case UserRole.supervisor:
        return 'Supervisor';
      case UserRole.hrAdmin:
        return 'HR Admin';
      case UserRole.superAdmin:
        return 'Super Admin';
    }
  }

  String _formatHireDate(DateTime date) {
    const months = [
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
    ];
    return '${months[date.month]} ${date.year}';
  }

  void _confirmSignOut(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              context.read<AuthBloc>().add(const AuthLogoutEvent());
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  void _confirmEdit(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: Icon(Icons.edit_outlined,
            color: Theme.of(context).colorScheme.primary),
        title: const Text('Edit Profile'),
        content: const Text(
            'Are you sure you want to change you username or password?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              setState(() => _isEditing = true);
            },
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }
}

// ── Header Components ──────────────────────────────────────────────────────────

class _AnimatedMeshBackground extends StatefulWidget {
  const _AnimatedMeshBackground({required this.colorScheme});
  final ColorScheme colorScheme;

  @override
  State<_AnimatedMeshBackground> createState() =>
      _AnimatedMeshBackgroundState();
}

class _AnimatedMeshBackgroundState extends State<_AnimatedMeshBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 15),
    )..repeat(reverse: true);
    _animation =
        CurvedAnimation(parent: _controller, curve: Curves.easeInOutSine);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        // Shift stops and alignment based on animation
        final value = _animation.value;
        const deepMagenta = Color(0xFF700166);
        const vibrantMagenta = Color(0xFFF602E2);
        const lightMagenta = Color(0xFFFF71F3);

        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment(-1.0 + (value * 0.2), -1.0 + (value * 0.2)),
              end: Alignment(1.0 - (value * 0.2), 1.0 - (value * 0.2)),
              colors: [
                vibrantMagenta,
                Color.lerp(vibrantMagenta, deepMagenta, 0.5 + (value * 0.2)) ??
                    deepMagenta,
                deepMagenta,
              ],
              stops: const [0.0, 0.6, 1.0],
            ),
          ),
          child: Stack(
            children: [
              // ── Top Light ───────────────────────────────────────────────
              Positioned(
                top: -100 + (value * 50),
                right: -50 + (value * 100),
                child: Container(
                  width: 350,
                  height: 350,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        lightMagenta.withValues(alpha: 0.15),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
              // ── Bottom Light ────────────────────────────────────────────
              Positioned(
                bottom: -150 + (value * 120),
                left: -100 + (value * 60),
                child: Container(
                  width: 400,
                  height: 400,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Colors.white.withValues(alpha: 0.1),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ── Info section ──────────────────────────────────────────────────────────────
class _EditSection extends StatelessWidget {
  const _EditSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title.toUpperCase(),
            style: theme.textTheme.labelSmall?.copyWith(
              color: cs.onSurfaceVariant,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
        ),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: cs.outline.withValues(alpha: 0.15)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: children,
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoSection extends StatelessWidget {
  const _InfoSection(
      {required this.title, required this.items, this.customBody});

  final String title;
  final List<_InfoItem> items;
  final Widget? customBody;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title.toUpperCase(),
            style: theme.textTheme.labelSmall?.copyWith(
              color: cs.onSurfaceVariant,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
        ),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: cs.outline.withValues(alpha: 0.15)),
          ),
          child: customBody ??
              Column(
                children: [
                  for (int i = 0; i < items.length; i++) ...[
                    items[i],
                    if (i < items.length - 1)
                      Divider(
                        height: 1,
                        indent: 52,
                        endIndent: 16,
                        color: cs.outline.withValues(alpha: 0.1),
                      ),
                  ],
                ],
              ),
        ),
      ],
    );
  }
}

// ── Info item ─────────────────────────────────────────────────────────────────
class _InfoItem extends StatelessWidget {
  const _InfoItem({
    required this.icon,
    required this.label,
    required this.value,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, size: 20, color: cs.primary),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: cs.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

// ── Work History Timeline ───────────────────────────────────────────────────
class _TimelineTile extends StatelessWidget {
  const _TimelineTile({
    required this.status,
    required this.startDate,
    this.endDate,
    required this.isLast,
  });

  final String status;
  final DateTime startDate;
  final DateTime? endDate;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final DateFormat formatter = DateFormat('MMM d, yyyy');

    Color statusColor;
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        statusColor = Colors.green;
        break;
      case 'ON_LEAVE':
        statusColor = Colors.orange;
        break;
      case 'TERMINATED':
      case 'SUSPENDED':
        statusColor = Colors.red;
        break;
      default:
        statusColor = cs.primary;
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Timeline Line & Dot ──
          SizedBox(
            width: 30,
            child: Column(
              children: [
                Container(
                  width: 14,
                  height: 14,
                  margin: const EdgeInsets.only(top: 18),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: statusColor,
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.3),
                      width: 4,
                    ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: cs.outlineVariant.withValues(alpha: 0.5),
                      margin: const EdgeInsets.symmetric(vertical: 4),
                    ),
                  )
                else
                  const SizedBox(height: 16), // Padding for the last item
              ],
            ),
          ),
          // ── Timeline Content ──
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 12, top: 14, bottom: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                      border:
                          Border.all(color: statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      status.toUpperCase().replaceAll('_', ' '),
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    endDate != null
                        ? '${formatter.format(startDate)} — ${formatter.format(endDate!)}'
                        : '${formatter.format(startDate)} — Present',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: cs.onSurfaceVariant,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
