import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/core/services/time_service.dart';
import 'package:tk_clocking_system/features/leaves/presentation/bloc/leaves_bloc.dart';
import 'package:tk_clocking_system/features/leaves/presentation/bloc/leaves_event.dart';
import 'package:tk_clocking_system/features/leaves/presentation/bloc/leaves_state.dart';

class LeaveRequestFormPage extends StatefulWidget {
  final bool isPermissionTab;
  const LeaveRequestFormPage({super.key, this.isPermissionTab = false});

  @override
  State<LeaveRequestFormPage> createState() => _LeaveRequestFormPageState();
}

class _LeaveRequestFormPageState extends State<LeaveRequestFormPage> {
  final _formKey = GlobalKey<FormState>();
  late String _leaveType;
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonController = TextEditingController();

  late final List<String> _leaveTypes;

  @override
  void initState() {
    super.initState();
    _leaveTypes = widget.isPermissionTab
        ? ['EXCUSED', 'ERRAND']
        : ['SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER'];
    _leaveType = _leaveTypes.first;
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      if (_startDate == null || _endDate == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select both start and end dates.')),
        );
        return;
      }
      if (_endDate!.isBefore(_startDate!)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('End date must be after start date.')),
        );
        return;
      }

      if (widget.isPermissionTab && _reasonController.text.trim().length < 5) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('A detailed reason (min 5 characters) is required for permissions.')),
        );
        return;
      }

      context.read<LeavesBloc>().add(
            SubmitLeaveRequest(
              leaveType: _leaveType,
              startDate: _startDate!,
              endDate: _endDate!,
              reason: _reasonController.text.trim(),
            ),
          );
    }
  }

  Future<void> _selectDate(BuildContext context, bool isStart) async {
    final now = await sl<TimeService>().getGhanaTimeAsync();
    if (!context.mounted) return;
    
    final initialDate = isStart ? (_startDate ?? now) : (_endDate ?? _startDate ?? now);
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate != null && _endDate!.isBefore(picked)) {
            _endDate = null;
          }
        } else {
          _endDate = picked;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, yyyy');

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isPermissionTab ? 'Request Permission' : 'Request Leave'),
      ),
      body: BlocListener<LeavesBloc, LeavesState>(
        listener: (context, state) {
          if (state is LeaveSubmissionSuccess) {
            Navigator.pop(context);
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Form(
            key: _formKey,
            child: ListView(
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _leaveType,
                  decoration: InputDecoration(
                    labelText: widget.isPermissionTab ? 'Permission Type' : 'Leave Type',
                    border: const OutlineInputBorder(),
                  ),
                  items: _leaveTypes.map((type) {
                    return DropdownMenuItem(
                      value: type,
                      child: Text(_getLeaveTypeDisplayLabel(type)),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _leaveType = val);
                  },
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => _selectDate(context, true),
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'Start Date',
                            border: OutlineInputBorder(),
                          ),
                          child: Text(
                            _startDate == null ? 'Select Date' : dateFormat.format(_startDate!),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: InkWell(
                        onTap: () => _selectDate(context, false),
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'End Date',
                            border: OutlineInputBorder(),
                          ),
                          child: Text(
                            _endDate == null ? 'Select Date' : dateFormat.format(_endDate!),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _reasonController,
                  maxLines: 3,
                  validator: (val) {
                    if (widget.isPermissionTab && (val == null || val.trim().length < 5)) {
                      return 'A detailed reason is required';
                    }
                    return null;
                  },
                  decoration: InputDecoration(
                    labelText: widget.isPermissionTab ? 'Reason *' : 'Reason (Optional)',
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 24),
                BlocBuilder<LeavesBloc, LeavesState>(
                  builder: (context, state) {
                    if (state is LeaveSubmissionInProgress) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    return ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        textStyle: const TextStyle(fontSize: 18),
                      ),
                      onPressed: _submit,
                      child: const Text('Submit Request'),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _getLeaveTypeDisplayLabel(String type) {
    switch (type) {
      case 'EXCUSED':
        return 'Absent with Permission';
      case 'ERRAND':
        return 'Official Duty (Errand)';
      case 'SICK':
        return 'Sick Leave';
      case 'CASUAL':
        return 'Casual Leave';
      case 'ANNUAL':
        return 'Annual Leave';
      case 'MATERNITY':
        return 'Maternity Leave';
      case 'PATERNITY':
        return 'Paternity Leave';
      case 'UNPAID':
        return 'Unpaid Leave';
      case 'OTHER':
        return 'Other Leave';
      default:
        return type;
    }
  }
}
