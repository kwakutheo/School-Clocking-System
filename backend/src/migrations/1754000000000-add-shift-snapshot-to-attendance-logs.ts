import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShiftSnapshotToAttendanceLogs1754000000000 implements MigrationInterface {
  name = 'AddShiftSnapshotToAttendanceLogs1754000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendance_logs"
        ADD COLUMN IF NOT EXISTS "scheduled_start_time" character varying(8),
        ADD COLUMN IF NOT EXISTS "scheduled_end_time"   character varying(8),
        ADD COLUMN IF NOT EXISTS "scheduled_grace_minutes" integer,
        ADD COLUMN IF NOT EXISTS "late_minutes"         integer,
        ADD COLUMN IF NOT EXISTS "early_out_minutes"    integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendance_logs"
        DROP COLUMN IF EXISTS "scheduled_start_time",
        DROP COLUMN IF EXISTS "scheduled_end_time",
        DROP COLUMN IF EXISTS "scheduled_grace_minutes",
        DROP COLUMN IF EXISTS "late_minutes",
        DROP COLUMN IF EXISTS "early_out_minutes"`,
    );
  }
}
