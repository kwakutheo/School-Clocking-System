import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:tk_clocking_system/core/di/injection_container.dart';
import 'package:tk_clocking_system/features/leaves/presentation/bloc/leaves_bloc.dart';
import 'package:tk_clocking_system/features/leaves/presentation/bloc/leaves_event.dart';
import 'package:tk_clocking_system/features/leaves/presentation/bloc/leaves_state.dart';
import 'package:tk_clocking_system/features/leaves/presentation/pages/leave_request_form_page.dart';
import 'package:tk_clocking_system/features/leaves/data/models/leave_request_model.dart';

class LeavesPage extends StatelessWidget {
  const LeavesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<LeavesBloc>()..add(LoadMyLeaves()),
      child: const LeavesView(),
    );
  }
}

class LeavesView extends StatelessWidget {
  const LeavesView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Leaves'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => BlocProvider.value(
                    value: context.read<LeavesBloc>(),
                    child: const LeaveRequestFormPage(),
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: BlocConsumer<LeavesBloc, LeavesState>(
        listener: (context, state) {
          if (state is LeaveSubmissionFailure) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message), backgroundColor: Colors.red),
            );
          } else if (state is LeaveSubmissionSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Leave request submitted!'), backgroundColor: Colors.green),
            );
          }
        },
        builder: (context, state) {
          if (state is LeavesLoading || state is LeavesInitial) {
            return const Center(child: CircularProgressIndicator());
          } else if (state is LeavesError) {
            return Center(child: Text(state.message));
          } else if (state is LeavesLoaded) {
            if (state.leaves.isEmpty) {
              return const Center(child: Text('No leave requests found.'));
            }
            return RefreshIndicator(
              onRefresh: () async {
                context.read<LeavesBloc>().add(LoadMyLeaves());
              },
              child: ListView.builder(
                padding: const EdgeInsets.all(16.0),
                itemCount: state.leaves.length,
                itemBuilder: (context, index) {
                  final leave = state.leaves[index];
                  return _buildLeaveCard(context, leave);
                },
              ),
            );
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildLeaveCard(BuildContext context, LeaveRequestModel leave) {
    final dateFormat = DateFormat('MMM d, yyyy');
    Color statusColor = Colors.grey;
    if (leave.status == 'APPROVED') statusColor = Colors.green;
    if (leave.status == 'REJECTED') statusColor = Colors.red;
    if (leave.status == 'PENDING') statusColor = Colors.orange;

    return Card(
      margin: const EdgeInsets.only(bottom: 16.0),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  leave.leaveType,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor),
                  ),
                  child: Text(
                    leave.status,
                    style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${dateFormat.format(leave.startDate)} - ${dateFormat.format(leave.endDate)}',
              style: TextStyle(color: Colors.grey[700]),
            ),
            if (leave.reason != null && leave.reason!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('Reason: ${leave.reason}', style: const TextStyle(fontStyle: FontStyle.italic)),
            ],
            if (leave.reviewNote != null && leave.reviewNote!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                color: Colors.grey[100],
                child: Text('Note: ${leave.reviewNote}'),
              )
            ],
            if (leave.status == 'PENDING') ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () {
                    context.read<LeavesBloc>().add(CancelLeaveRequest(leave.id));
                  },
                  child: const Text('Cancel Request', style: TextStyle(color: Colors.red)),
                ),
              ),
            ]
          ],
        ),
      ),
    );
  }
}
