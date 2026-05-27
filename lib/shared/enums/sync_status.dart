/// Tracks whether an offline attendance record has been synced to the backend.
///
/// Using an enum instead of a plain boolean allows distinguishing
/// failed sync attempts from pending ones.
enum SyncStatus {
  pending('pending'),
  synced('synced'),
  failed('failed');

  const SyncStatus(this.value);

  final String value;

  static SyncStatus fromValue(String value) => SyncStatus.values.firstWhere(
        (e) => e.value == value,
        orElse: () => SyncStatus.pending,
      );
}
