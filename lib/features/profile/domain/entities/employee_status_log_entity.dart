import 'package:equatable/equatable.dart';

class EmployeeStatusLogEntity extends Equatable {
  final String id;
  final String status;
  final DateTime startDate;
  final DateTime? endDate;
  final DateTime createdAt;

  const EmployeeStatusLogEntity({
    required this.id,
    required this.status,
    required this.startDate,
    this.endDate,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id, status, startDate, endDate, createdAt];
}
