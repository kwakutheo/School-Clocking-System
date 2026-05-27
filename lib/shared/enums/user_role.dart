/// RBAC roles that match the backend CHECK constraint on the users table.
enum UserRole {
  employee('employee'),
  supervisor('supervisor'),
  hrAdmin('hr_admin'),
  superAdmin('super_admin');

  const UserRole(this.value);

  final String value;

  static UserRole fromValue(String value) => UserRole.values.firstWhere(
        (e) => e.value == value,
        orElse: () => throw ArgumentError('Unknown UserRole: $value'),
      );

  bool get canAccessDashboard =>
      this == UserRole.supervisor ||
      this == UserRole.hrAdmin ||
      this == UserRole.superAdmin;
}
