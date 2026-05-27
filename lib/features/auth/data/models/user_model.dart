import 'dart:convert';

import 'package:tk_clocking_system/features/auth/domain/entities/user_entity.dart';
import 'package:tk_clocking_system/shared/enums/user_role.dart';

/// Data model that extends [UserEntity] with JSON serialisation.
class UserModel extends UserEntity {
  const UserModel({
    required super.id,
    required super.fullName,
    required super.email,
    required super.phone,
    required super.username,
    required super.role,
    super.tenantId,
    super.schoolName,
    super.employeeId,
    super.employeeCode,
    super.photoUrl,
    super.departmentId,
    super.branchId,
    super.branchName,
    super.departmentName,
    super.position,
    super.hireDate,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    // The /employees/me endpoint returns nested objects for branch & department.
    final branchObj = json['branch'] as Map<String, dynamic>?;
    final deptObj = json['department'] as Map<String, dynamic>?;
    final hireDateRaw = json['hire_date'] ?? json['hireDate'];

    // Extract school/tenant info from the nested tenant object or flat fields
    final tenantObj = json['tenant'] as Map<String, dynamic>?;
    final tenantId = (tenantObj?['id'] ?? json['tenantId'] ?? json['tenant_id']) as String?;
    final schoolName = (tenantObj?['name'] ?? json['schoolName'] ?? json['school_name']) as String?;

    return UserModel(
      id: json['id'] as String,
      tenantId: tenantId,
      schoolName: schoolName,
      employeeId: (json['employee_id'] ?? json['employeeId']) as String?,
      fullName: (json['full_name'] ?? json['fullName']) as String,
      email: (json['email'] as String?) ?? '',
      phone: (json['phone'] as String?) ?? '',
      username: (json['username'] as String?) ?? '',
      role: UserRole.fromValue(json['role'] as String),
      employeeCode:
          (json['employee_code'] ?? json['employeeCode']) as String?,
      photoUrl: (json['photo_url'] ?? json['photoUrl']) as String?,
      departmentId:
          (json['department_id'] ?? json['departmentId']) as String?,
      branchId: (json['branch_id'] ?? json['branchId']) as String?,
      branchName: (branchObj?['name'] ?? json['branchName']) as String?,
      departmentName: (deptObj?['name'] ?? json['departmentName']) as String?,
      position: (json['position']) as String?,
      hireDate: hireDateRaw != null ? DateTime.tryParse(hireDateRaw as String) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'tenantId': tenantId,
        'schoolName': schoolName,
        'employee_id': employeeId,
        'full_name': fullName,
        'email': email,
        'phone': phone,
        'username': username,
        'role': role.value,
        'employee_code': employeeCode,
        'photo_url': photoUrl,
        'department_id': departmentId,
        'branch_id': branchId,
        'branchName': branchName,
        'departmentName': departmentName,
        'position': position,
        'hireDate': hireDate?.toIso8601String(),
      };

  /// Serialises to a JSON string for [StorageService].
  String toJsonString() => jsonEncode(toJson());

  /// Deserialises from a JSON string stored in [StorageService].
  static UserModel fromJsonString(String jsonString) =>
      UserModel.fromJson(jsonDecode(jsonString) as Map<String, dynamic>);
}
